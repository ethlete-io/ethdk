use crate::error::{TimetrackError, TimetrackResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

/// The shape of the contract with a caller. A caller refuses a discovery file whose version it does
/// not know, so bumping this turns every older caller off rather than letting it guess.
const PROTOCOL_VERSION: u32 = 2;

const DISCOVERY_FILENAME: &str = "agent.json";
const PATH: &str = "/agent";
/// Where a caller asks the server to prove it holds this run's token, before it sends its own.
const PROOF_PATH: &str = "/agent/proof?nonce=";

/// The event the window answers. Matches `AGENT_REQUEST_EVENT` in `events.ts`.
const REQUEST_EVENT: &str = "agent-request";

/// The window that carries out an operation. Named rather than broadcast: a second window would run
/// the same operation a second time, and creating one issue twice is not a mistake a reply can undo.
const WINDOW_LABEL: &str = "main";

/// The largest body the endpoint reads. Every operation is a handful of fields; the description of a
/// ticket is the longest of them.
const MAX_BODY_BYTES: usize = 64 * 1024;

/// How long a connection may take to send its request before it is dropped.
const READ_TIMEOUT: Duration = Duration::from_secs(5);

/// How long the window may take to answer. A Jira search behind a slow instance is the long case, and
/// a caller waiting forever for a window that will never answer is the case this bounds.
const ANSWER_TIMEOUT: Duration = Duration::from_secs(60);

/// How many connections may be open at once, authorized or not.
///
/// Every accepted socket costs a task and a buffer before the token is even read, and the endpoint
/// answers one caller at a time in practice. Another account on the machine can connect without the
/// token, so the count is what stops it from taking memory and sockets without limit.
const MAX_CONNECTIONS: usize = 16;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    /// `listening` once the socket is bound, `none` when it could not be.
    pub kind: String,
    /// Why there is no endpoint, for the row that has to say what is degraded.
    pub detail: Option<String>,
    pub port: Option<u16>,
    /// Where a caller finds the port and the token.
    pub discovery_path: Option<String>,
    /// Requests the window answered since the app started, however it answered them.
    pub answered: u64,
    /// Requests turned away for a missing or wrong token — a caller left over from an earlier run.
    pub refused: u64,
}

/// What the discovery file holds. It is written at every start, with a token that lives no longer than
/// the run: there is no durable secret to leak, and a caller left over from an earlier run is refused
/// rather than trusted.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Discovery {
    version: u32,
    port: u16,
    token: String,
}

/// One request, as the window receives it. `body` is whatever the caller sent, uninterpreted.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentRequest {
    id: u64,
    body: serde_json::Value,
}

/// What the window sends back. `ok` is the operation's own verdict, not the endpoint's: a key Jira
/// does not know is a failed operation over a working endpoint.
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAnswer {
    ok: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    value: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

impl AgentAnswer {
    fn value(value: serde_json::Value) -> Self {
        Self {
            ok: true,
            value: Some(value),
            message: None,
        }
    }

    fn failed(message: String) -> Self {
        Self {
            ok: false,
            value: None,
            message: Some(message),
        }
    }
}

struct Tallies {
    answered: u64,
    refused: u64,
}

/// The endpoint's own state: what it can say about itself, and the requests the window has not
/// answered yet.
#[derive(Clone)]
pub struct AgentEndpoint {
    status: Arc<Mutex<AgentStatus>>,
    tallies: Arc<Mutex<Tallies>>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<AgentAnswer>>>>,
    next_id: Arc<AtomicU64>,
}

impl AgentEndpoint {
    pub fn new() -> Self {
        Self {
            status: Arc::new(Mutex::new(AgentStatus {
                kind: "none".to_string(),
                detail: Some("the agent endpoint has not started yet".to_string()),
                port: None,
                discovery_path: None,
                answered: 0,
                refused: 0,
            })),
            tallies: Arc::new(Mutex::new(Tallies {
                answered: 0,
                refused: 0,
            })),
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(AtomicU64::new(1)),
        }
    }

    fn refuse(&self) {
        if let Ok(mut tallies) = self.tallies.lock() {
            tallies.refused += 1;
        }
    }

    fn answered(&self) {
        if let Ok(mut tallies) = self.tallies.lock() {
            tallies.answered += 1;
        }
    }

    fn listening_on(&self, port: u16, discovery: TimetrackResult<PathBuf>) {
        if let Ok(mut status) = self.status.lock() {
            status.kind = "listening".to_string();
            status.port = Some(port);

            match discovery {
                Ok(path) => {
                    status.detail = None;
                    status.discovery_path = Some(path.to_string_lossy().into_owned());
                }
                Err(error) => {
                    status.detail = Some(format!("no caller can find the endpoint: {error}"));
                    status.discovery_path = None;
                }
            }
        }
    }

    fn failed(&self, detail: String) {
        if let Ok(mut status) = self.status.lock() {
            status.kind = "none".to_string();
            status.detail = Some(detail);
            status.port = None;
        }
    }

    /// Hands one request to the window and waits for the answer it sends back.
    ///
    /// The window is where every operation is carried out: the Jira client, the settings and the day
    /// are all there, and a second implementation of any of them here would be a second set of rules
    /// about what may be written.
    async fn ask(&self, app: &AppHandle, body: serde_json::Value) -> AgentAnswer {
        if app.get_webview_window(WINDOW_LABEL).is_none() {
            return AgentAnswer::failed("the Timetrack window is not open".to_string());
        }

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = oneshot::channel();

        match self.pending.lock() {
            Ok(mut pending) => pending.insert(id, sender),
            Err(_) => return AgentAnswer::failed("the endpoint can no longer be trusted; restart".to_string()),
        };

        if app
            .emit_to(WINDOW_LABEL, REQUEST_EVENT, AgentRequest { id, body })
            .is_err()
        {
            self.forget(id);

            return AgentAnswer::failed("the Timetrack window is not listening".to_string());
        }

        match tokio::time::timeout(ANSWER_TIMEOUT, receiver).await {
            Ok(Ok(answer)) => answer,
            // The window is up but nothing there handled the operation, or it took longer than a
            // caller can be asked to wait. Either way the request is dropped rather than left open.
            _ => {
                self.forget(id);

                AgentAnswer::failed(format!(
                    "the Timetrack window did not answer within {} seconds",
                    ANSWER_TIMEOUT.as_secs()
                ))
            }
        }
    }

    fn forget(&self, id: u64) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.remove(&id);
        }
    }

    fn reply(&self, id: u64, answer: AgentAnswer) -> TimetrackResult<()> {
        let sender = self.pending.lock().map_err(|_| TimetrackError::Poisoned)?.remove(&id);

        // A reply for a request that already timed out is dropped rather than reported: the caller is
        // gone, and the window has no way to know that before it answers.
        if let Some(sender) = sender {
            let _ = sender.send(answer);
        }

        Ok(())
    }

    pub(crate) fn status(&self) -> TimetrackResult<AgentStatus> {
        let tallies = self.tallies.lock().map_err(|_| TimetrackError::Poisoned)?;
        let status = self.status.lock().map_err(|_| TimetrackError::Poisoned)?;

        Ok(AgentStatus {
            answered: tallies.answered,
            refused: tallies.refused,
            ..status.clone()
        })
    }
}

impl Default for AgentEndpoint {
    fn default() -> Self {
        Self::new()
    }
}

fn random_hex() -> String {
    let bytes: [u8; 32] = rand::random();

    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// What a request line and its headers say, or `None` for something that is not a request at all.
struct RequestHead {
    method: String,
    target: String,
    content_length: usize,
    authorization: Option<String>,
    /// Set by a browser and by nothing else, which is what makes it worth refusing.
    origin: Option<String>,
}

fn parse_head(head: &str) -> Option<RequestHead> {
    let mut lines = head.split("\r\n");
    let mut request_line = lines.next()?.split_whitespace();
    let method = request_line.next()?.to_string();
    let target = request_line.next()?.to_string();
    let mut parsed = RequestHead {
        method,
        target,
        content_length: 0,
        authorization: None,
        origin: None,
    };

    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        let value = value.trim();

        match name.trim().to_ascii_lowercase().as_str() {
            "content-length" => parsed.content_length = value.parse().unwrap_or(usize::MAX),
            "authorization" => parsed.authorization = Some(value.to_string()),
            "origin" => parsed.origin = Some(value.to_string()),
            _ => {}
        }
    }

    Some(parsed)
}

/// The answer to a caller's challenge: `HMAC-SHA256` of its nonce under this run's token, in hex.
///
/// The port is ephemeral, so anything on the machine can bind it once the app stops and answer the
/// questions a stale discovery file leads a caller to ask. The caller therefore asks this first and
/// sends nothing until the answer matches: a process that has not read the discovery file cannot
/// produce it, and one that has needs no impersonation.
fn proof_for(token: &str, nonce: &str) -> String {
    use hmac::Mac;

    let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(token.as_bytes()).expect("hmac takes a key of any length");

    mac.update(nonce.as_bytes());

    mac.finalize()
        .into_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Whether the request carries this run's token, in constant time over the token's length.
///
/// A comparison that stops at the first wrong byte leaks where it stopped, and a caller that may make
/// as many attempts as it likes is exactly the caller that can measure it.
fn authorized(header: Option<&str>, token: &str) -> bool {
    let Some(offered) = header.and_then(|value| value.strip_prefix("Bearer ")) else {
        return false;
    };

    if offered.len() != token.len() {
        return false;
    }

    offered
        .bytes()
        .zip(token.bytes())
        .fold(0u8, |difference, (a, b)| difference | (a ^ b))
        == 0
}

async fn respond(stream: &mut TcpStream, status: &str) -> TimetrackResult<()> {
    let response = format!("HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");

    stream.write_all(response.as_bytes()).await?;
    stream.shutdown().await?;

    Ok(())
}

async fn respond_json(stream: &mut TcpStream, status: &str, answer: &AgentAnswer) -> TimetrackResult<()> {
    let body = serde_json::to_vec(answer)?;
    let head = format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );

    stream.write_all(head.as_bytes()).await?;
    stream.write_all(&body).await?;
    stream.shutdown().await?;

    Ok(())
}

/// Reads one request, has the window carry it out, and writes back what it answered.
///
/// A status other than 200 means the endpoint could not carry the request at all. Whether the
/// operation itself succeeded is in the body, because a key Jira does not know says nothing about the
/// endpoint that looked it up.
async fn serve(stream: &mut TcpStream, endpoint: &AgentEndpoint, app: &AppHandle, token: &str) -> TimetrackResult<()> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];
    // The request has its own deadline, separate from the window's for answering it. Sharing one
    // would let a connection that sends nothing hold a slot for as long as an answer may take.
    let deadline = tokio::time::Instant::now() + READ_TIMEOUT;

    let head_end = loop {
        if let Some(index) = find_head_end(&buffer) {
            break index;
        }

        if buffer.len() > MAX_BODY_BYTES {
            return respond(stream, "431 Request Header Fields Too Large").await;
        }

        let read = read_more(stream, &mut chunk, deadline).await?;

        if read == 0 {
            return Ok(());
        }

        buffer.extend_from_slice(&chunk[..read]);
    };

    let Some(head) = std::str::from_utf8(&buffer[..head_end]).ok().and_then(parse_head) else {
        return respond(stream, "400 Bad Request").await;
    };

    // A browser is the one caller that cannot be an agent: nothing in this app calls the endpoint from
    // a page, and refusing every request that carries an origin is what keeps a site the user happens
    // to have open from reaching Jira through a port it guessed.
    if head.origin.is_some() {
        endpoint.refuse();

        return respond(stream, "403 Forbidden").await;
    }

    // Answered before the token check, because the caller has none to send yet, and before the lock,
    // because a locked app must read as Timetrack rather than as something else on its port.
    if let Some(nonce) = head.target.strip_prefix(PROOF_PATH) {
        if head.method != "GET" {
            return respond(stream, "405 Method Not Allowed").await;
        }

        if nonce.len() < 16 || nonce.len() > 128 || !nonce.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return respond(stream, "400 Bad Request").await;
        }

        return respond_json(
            stream,
            "200 OK",
            &AgentAnswer::value(serde_json::json!({ "proof": proof_for(token, nonce) })),
        )
        .await;
    }

    if !authorized(head.authorization.as_deref(), token) {
        endpoint.refuse();

        return respond(stream, "401 Unauthorized").await;
    }

    // The token is this run's, and it sits in a file every process of this account can read once the
    // app has started. The lock is therefore what decides whether an operation runs at all: a locked
    // app is one whose owner is away, and every operation here either reads the day's own evidence or
    // writes something to Jira in their name.
    if app
        .try_state::<crate::lock::WindowLock>()
        .is_some_and(|lock| lock.is_locked())
    {
        endpoint.refuse();

        return respond_json(
            stream,
            "200 OK",
            &AgentAnswer::failed("Timetrack is locked. Unlock it, then ask again.".to_string()),
        )
        .await;
    }

    if head.target != PATH {
        return respond(stream, "404 Not Found").await;
    }

    if head.method != "POST" {
        return respond(stream, "405 Method Not Allowed").await;
    }

    if head.content_length > MAX_BODY_BYTES {
        return respond(stream, "413 Payload Too Large").await;
    }

    let mut body = buffer.split_off(head_end + 4);

    while body.len() < head.content_length {
        let read = read_more(stream, &mut chunk, deadline).await?;

        if read == 0 {
            return respond(stream, "400 Bad Request").await;
        }

        body.extend_from_slice(&chunk[..read]);
    }

    let Ok(request) = serde_json::from_slice::<serde_json::Value>(&body[..head.content_length]) else {
        return respond(stream, "400 Bad Request").await;
    };

    // The one thing this host reads out of the body. What an operation means belongs to the window,
    // which is also what keeps a caller from reaching Jira through a shape invented here.
    let op = request.get("op").and_then(serde_json::Value::as_str);

    if !op.is_some_and(|op| !op.trim().is_empty()) {
        return respond(stream, "400 Bad Request").await;
    }

    let answer = endpoint.ask(app, request).await;

    endpoint.answered();

    respond_json(stream, "200 OK", &answer).await
}

/// Reads what has arrived, or gives up once the request deadline has passed.
async fn read_more(stream: &mut TcpStream, chunk: &mut [u8], deadline: tokio::time::Instant) -> TimetrackResult<usize> {
    tokio::time::timeout_at(deadline, stream.read(chunk))
        .await
        .map_err(|_| TimetrackError::Rejected("the request was not sent in time".to_string()))?
        .map_err(TimetrackError::Io)
}

fn find_head_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

/// Writes the discovery file so only its owner can read it. See `discovery::write_private`.
fn write_discovery(path: &Path, discovery: &Discovery) -> TimetrackResult<()> {
    crate::discovery::write_private(path, &serde_json::to_vec(discovery)?)
}

pub fn discovery_path(data_dir: &Path) -> PathBuf {
    data_dir.join(DISCOVERY_FILENAME)
}

/// Binds the endpoint on the loopback address and serves it until the app stops.
///
/// The port is whatever the OS hands out, and the discovery file is what turns that into an address a
/// caller can find — so two accounts running this app never collide over one port, and nothing has to
/// be registered anywhere.
pub fn start(endpoint: AgentEndpoint, app: AppHandle, data_dir: PathBuf) {
    let token = random_hex();

    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind("127.0.0.1:0").await {
            Ok(listener) => listener,
            Err(error) => return endpoint.failed(format!("the agent endpoint could not be opened ({error})")),
        };
        let port = match listener.local_addr() {
            Ok(address) => address.port(),
            Err(error) => return endpoint.failed(format!("the agent endpoint has no address ({error})")),
        };
        let path = discovery_path(&data_dir);
        let discovery = Discovery {
            version: PROTOCOL_VERSION,
            port,
            token: token.clone(),
        };

        // The socket is up either way, so the endpoint is reported as listening even when the file
        // could not be written. Only the finding of it is broken, and the status is where that is said.
        endpoint.listening_on(port, write_discovery(&path, &discovery).map(|()| path));

        let connections = Arc::new(tokio::sync::Semaphore::new(MAX_CONNECTIONS));

        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                continue;
            };
            let Ok(permit) = connections.clone().try_acquire_owned() else {
                // Dropping the socket is the answer: a caller that cannot be served now is better off
                // failing at once than queued behind a limit that is already reached.
                continue;
            };
            let endpoint = endpoint.clone();
            let app = app.clone();
            let token = token.clone();

            tauri::async_runtime::spawn(async move {
                // Long enough to cover both halves: reading the request, which has its own deadline
                // inside `serve`, and the window's for answering it inside `ask`.
                let deadline = READ_TIMEOUT + ANSWER_TIMEOUT;
                let served = serve(&mut stream, &endpoint, &app, &token);

                let _ = tokio::time::timeout(deadline, served).await;
                drop(permit);
            });
        }
    });
}

#[tauri::command]
pub async fn agent_reply(endpoint: State<'_, AgentEndpoint>, id: u64, answer: AgentAnswer) -> TimetrackResult<()> {
    endpoint.reply(id, answer)
}

#[tauri::command]
pub async fn agent_status(endpoint: State<'_, AgentEndpoint>) -> TimetrackResult<AgentStatus> {
    endpoint.status()
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "0123456789abcdef";

    fn head(request: &str) -> RequestHead {
        parse_head(request).unwrap()
    }

    #[test]
    fn reads_the_bearer_token_regardless_of_header_case() {
        let parsed = head("POST /agent HTTP/1.1\r\nAUTHORIZATION: Bearer abc\r\nContent-Length: 2\r\n");

        assert_eq!(parsed.authorization.as_deref(), Some("Bearer abc"));
        assert_eq!(parsed.content_length, 2);
    }

    #[test]
    fn accepts_only_this_runs_token() {
        assert!(authorized(Some(&format!("Bearer {TOKEN}")), TOKEN));
        assert!(!authorized(Some("Bearer 0123456789abcdee"), TOKEN));
        assert!(!authorized(Some("Bearer short"), TOKEN));
        assert!(!authorized(Some(TOKEN), TOKEN));
        assert!(!authorized(None, TOKEN));
    }

    #[test]
    fn proves_the_run_token_without_being_told_it() {
        let nonce = "a1b2c3d4e5f60718";
        let proof = proof_for(TOKEN, nonce);

        // The value Node's `createHmac('sha256', token).update(nonce)` produces. The CLI computes the
        // proof that way and compares it, so the two sides have to agree byte for byte.
        assert_eq!(
            proof,
            "2fe46ab918d17fb2c92cc26e9107c9a99e5c9a550fa0e762a155c9314b396c38"
        );
        assert_ne!(proof, proof_for("fedcba9876543210", nonce));
        assert_ne!(proof, proof_for(TOKEN, "0000000000000000"));
        assert_eq!(proof, proof_for(TOKEN, nonce));
    }

    #[test]
    fn an_answer_serializes_without_the_halves_it_does_not_have() {
        let json = serde_json::to_string(&AgentAnswer::failed("no".to_string())).unwrap();

        assert_eq!(json, r#"{"ok":false,"message":"no"}"#);
    }
}
