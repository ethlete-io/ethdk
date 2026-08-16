use crate::error::{TimetrackError, TimetrackResult};
use crate::samples::{SampleBatch, SampleBuffer};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

/// The shape of the contract with a reporter. A reporter refuses a discovery file whose version it
/// does not know, so bumping this turns every older reporter off rather than letting it guess.
const PROTOCOL_VERSION: u32 = 1;

const DISCOVERY_FILENAME: &str = "ingest.json";
const PATH: &str = "/ingest";

/// The largest body the endpoint reads. A heartbeat is a few hundred bytes, and a reporter that has
/// been holding events while the app was closed sends at most a few dozen of them.
const MAX_BODY_BYTES: usize = 256 * 1024;

/// Records taken from one request. The rest are refused rather than truncated, so a reporter finds out
/// it is posting more than the endpoint accepts instead of silently losing the tail.
const MAX_RECORDS: usize = 512;

/// How long a connection may take to send its request before it is dropped. A socket that opens and
/// says nothing must not be able to hold a task open.
const READ_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestPayload {
    /// Which reporter posted it, from the envelope rather than from the record.
    pub reporter: String,
    pub kind: String,
    /// Everything the reporter sent beyond the instant and the kind, uninterpreted.
    pub payload: serde_json::Map<String, serde_json::Value>,
}

pub type IngestBatch = SampleBatch<IngestPayload>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReporterTally {
    pub reporter: String,
    /// Records taken from this reporter since the app started, before the core interpreted any of them.
    pub received: u64,
    /// When it last posted, by this machine's clock rather than by the instants it reported.
    pub last_at_ms: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestStatus {
    /// `listening` once the socket is bound, `none` when it could not be.
    pub kind: String,
    /// Why there is no endpoint, for the row that has to say what is degraded.
    pub detail: Option<String>,
    pub port: Option<u16>,
    /// Where a reporter finds the port and the token.
    pub discovery_path: Option<String>,
    pub reporters: Vec<ReporterTally>,
    /// Requests turned away for a missing or wrong token — a reporter left over from an earlier run.
    pub refused: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Envelope {
    reporter: String,
    events: Vec<Record>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    at_ms: i64,
    kind: String,
    /// The fields this host does not read. Serde collects them here so the core can.
    #[serde(flatten)]
    payload: serde_json::Map<String, serde_json::Value>,
}

/// What the discovery file holds. It is written at every start, with a token that lives no longer than
/// the run: there is no durable secret to leak, and a reporter left over from an earlier run is
/// refused rather than trusted.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Discovery {
    version: u32,
    port: u16,
    token: String,
}

struct Tallies {
    reporters: BTreeMap<String, ReporterTally>,
    refused: u64,
}

/// The records reporters have posted and nothing has stored yet, and what the endpoint can say about
/// itself.
#[derive(Clone)]
pub struct IngestSource {
    samples: SampleBuffer<IngestPayload>,
    status: Arc<Mutex<IngestStatus>>,
    tallies: Arc<Mutex<Tallies>>,
}

impl IngestSource {
    pub fn new() -> Self {
        Self {
            samples: SampleBuffer::new(),
            status: Arc::new(Mutex::new(IngestStatus {
                kind: "none".to_string(),
                detail: Some("the ingest endpoint has not started yet".to_string()),
                port: None,
                discovery_path: None,
                reporters: Vec::new(),
                refused: 0,
            })),
            tallies: Arc::new(Mutex::new(Tallies {
                reporters: BTreeMap::new(),
                refused: 0,
            })),
        }
    }

    pub fn set_paused(&self, paused: bool) {
        self.samples.set_paused(paused);
    }

    pub fn is_paused(&self) -> bool {
        self.samples.is_paused()
    }

    /// Takes what a reporter posted, or drops it while collection is paused.
    ///
    /// A pause drops the records and still answers the reporter with a success. That is the honest
    /// answer: the app did what a pause means, and telling the reporter it failed would only make it
    /// hold the same records and offer them again at every interval until the pause ended.
    fn accept(&self, reporter: &str, records: Vec<Record>, now_ms: i64) {
        if self.is_paused() {
            return;
        }

        for record in records {
            self.samples.push(
                record.at_ms,
                IngestPayload {
                    reporter: reporter.to_string(),
                    kind: record.kind,
                    payload: record.payload,
                },
            );
        }

        if let Ok(mut tallies) = self.tallies.lock() {
            let tally = tallies
                .reporters
                .entry(reporter.to_string())
                .or_insert_with(|| ReporterTally {
                    reporter: reporter.to_string(),
                    received: 0,
                    last_at_ms: now_ms,
                });

            tally.received += 1;
            tally.last_at_ms = now_ms;
        }
    }

    fn refuse(&self) {
        if let Ok(mut tallies) = self.tallies.lock() {
            tallies.refused += 1;
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
                    status.detail = Some(format!("no reporter can find the endpoint: {error}"));
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

    pub(crate) fn drain_after(&self, after_seq: u64) -> TimetrackResult<IngestBatch> {
        self.samples.drain_after(after_seq)
    }

    pub(crate) fn status(&self) -> TimetrackResult<IngestStatus> {
        let tallies = self.tallies.lock().map_err(|_| TimetrackError::Poisoned)?;
        let status = self.status.lock().map_err(|_| TimetrackError::Poisoned)?;

        Ok(IngestStatus {
            reporters: tallies.reporters.values().cloned().collect(),
            refused: tallies.refused,
            ..status.clone()
        })
    }
}

impl Default for IngestSource {
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

/// Reads one request and answers the status it earned.
///
/// Nothing here interprets a record: `atMs` and `kind` are lifted so the buffer can be drained and
/// dated, and everything else is passed through. What a `kind` means belongs to the core, which is
/// also what keeps a reporter from reaching the database with a shape this host invented a meaning for.
async fn serve(stream: &mut TcpStream, source: &IngestSource, token: &str, now_ms: i64) -> TimetrackResult<()> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 4096];

    let head_end = loop {
        if let Some(index) = find_head_end(&buffer) {
            break index;
        }

        if buffer.len() > MAX_BODY_BYTES {
            return respond(stream, "431 Request Header Fields Too Large").await;
        }

        let read = stream.read(&mut chunk).await?;

        if read == 0 {
            return Ok(());
        }

        buffer.extend_from_slice(&chunk[..read]);
    };

    let Some(head) = std::str::from_utf8(&buffer[..head_end]).ok().and_then(parse_head) else {
        return respond(stream, "400 Bad Request").await;
    };

    // A browser is the one caller that cannot be a reporter: no extension of this app posts from a
    // page, and refusing every request that carries an origin is what keeps a site the user happens to
    // have open from writing to a port it guessed.
    if head.origin.is_some() {
        source.refuse();

        return respond(stream, "403 Forbidden").await;
    }

    if !authorized(head.authorization.as_deref(), token) {
        source.refuse();

        return respond(stream, "401 Unauthorized").await;
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
        let read = stream.read(&mut chunk).await?;

        if read == 0 {
            return respond(stream, "400 Bad Request").await;
        }

        body.extend_from_slice(&chunk[..read]);
    }

    let Ok(envelope) = serde_json::from_slice::<Envelope>(&body[..head.content_length]) else {
        return respond(stream, "400 Bad Request").await;
    };

    if envelope.reporter.trim().is_empty() {
        return respond(stream, "400 Bad Request").await;
    }

    if envelope.events.len() > MAX_RECORDS {
        return respond(stream, "413 Payload Too Large").await;
    }

    source.accept(&envelope.reporter, envelope.events, now_ms);

    respond(stream, "204 No Content").await
}

fn find_head_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Writes the discovery file so only its owner can read it.
///
/// The permissions are the whole point on a shared machine: the token is what stands between the
/// endpoint and any other account, and a world-readable file would hand it to all of them.
fn write_discovery(path: &Path, discovery: &Discovery) -> TimetrackResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(path, serde_json::to_vec(discovery)?)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
    }

    Ok(())
}

pub fn discovery_path(data_dir: &Path) -> PathBuf {
    data_dir.join(DISCOVERY_FILENAME)
}

/// Binds the endpoint on the loopback address and serves it until the app stops.
///
/// The port is whatever the OS hands out, and the discovery file is what turns that into an address a
/// reporter can find — so two accounts running this app never collide over one port, and nothing has
/// to be registered anywhere.
pub fn start(source: IngestSource, data_dir: PathBuf) {
    let token = random_hex();

    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind("127.0.0.1:0").await {
            Ok(listener) => listener,
            Err(error) => return source.failed(format!("the ingest endpoint could not be opened ({error})")),
        };
        let port = match listener.local_addr() {
            Ok(address) => address.port(),
            Err(error) => return source.failed(format!("the ingest endpoint has no address ({error})")),
        };
        let path = discovery_path(&data_dir);
        let discovery = Discovery {
            version: PROTOCOL_VERSION,
            port,
            token: token.clone(),
        };

        // The socket is up either way, so the endpoint is reported as listening even when the file
        // could not be written. Only the finding of it is broken, and the status is where that is said.
        source.listening_on(port, write_discovery(&path, &discovery).map(|()| path));

        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                continue;
            };
            let source = source.clone();
            let token = token.clone();

            tauri::async_runtime::spawn(async move {
                let _ = tokio::time::timeout(READ_TIMEOUT, serve(&mut stream, &source, &token, now_ms())).await;
            });
        }
    });
}

#[tauri::command]
pub async fn ingest_events(source: State<'_, IngestSource>, after_seq: u64) -> TimetrackResult<IngestBatch> {
    source.drain_after(after_seq)
}

#[tauri::command]
pub async fn ingest_status(source: State<'_, IngestSource>) -> TimetrackResult<IngestStatus> {
    source.status()
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "0123456789abcdef";

    fn head(request: &str) -> RequestHead {
        parse_head(request).unwrap()
    }

    /// Serves one request against a real socket and answers the status line the caller was given.
    async fn round_trip(source: &IngestSource, request: &str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let served = {
            let source = source.clone();

            tokio::spawn(async move {
                let (mut stream, _) = listener.accept().await.unwrap();

                serve(&mut stream, &source, TOKEN, 1_700_000_000_000).await.unwrap();
            })
        };

        let mut client = TcpStream::connect(("127.0.0.1", port)).await.unwrap();

        client.write_all(request.as_bytes()).await.unwrap();

        let mut answer = String::new();

        client.read_to_string(&mut answer).await.unwrap();
        served.await.unwrap();

        answer.lines().next().unwrap_or_default().to_string()
    }

    fn post(body: &str, headers: &str) -> String {
        format!(
            "POST /ingest HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\n{headers}Content-Length: {}\r\n\r\n{body}",
            body.len()
        )
    }

    fn heartbeat() -> String {
        r#"{"reporter":"vscode","events":[{"atMs":1700000000000,"kind":"editor-heartbeat","repoPath":"/home/tom/dev/sdk","editing":true}]}"#.to_string()
    }

    fn authorized_post(body: &str) -> String {
        post(body, &format!("Authorization: Bearer {TOKEN}\r\n"))
    }

    #[test]
    fn reads_the_method_the_target_and_the_headers_it_needs() {
        let parsed = head("POST /ingest HTTP/1.1\r\nContent-Length: 42\r\nAuthorization: Bearer abc\r\n");

        assert_eq!(parsed.method, "POST");
        assert_eq!(parsed.target, "/ingest");
        assert_eq!(parsed.content_length, 42);
        assert_eq!(parsed.authorization.as_deref(), Some("Bearer abc"));
    }

    #[test]
    fn reads_a_header_name_however_it_is_capitalised() {
        let parsed = head("POST /ingest HTTP/1.1\r\ncontent-length: 7\r\nORIGIN: https://example.com\r\n");

        assert_eq!(parsed.content_length, 7);
        assert_eq!(parsed.origin.as_deref(), Some("https://example.com"));
    }

    #[test]
    fn treats_a_content_length_that_is_not_a_number_as_more_than_it_will_ever_read() {
        assert_eq!(head("POST /ingest HTTP/1.1\r\nContent-Length: huge\r\n").content_length, usize::MAX);
    }

    #[test]
    fn takes_only_the_exact_token() {
        assert!(authorized(Some(&format!("Bearer {TOKEN}")), TOKEN));
        assert!(!authorized(Some("Bearer 0123456789abcdee"), TOKEN));
        assert!(!authorized(Some("Bearer 0123456789abcde"), TOKEN));
        assert!(!authorized(Some(TOKEN), TOKEN));
        assert!(!authorized(None, TOKEN));
    }

    #[tokio::test]
    async fn buffers_what_an_authorized_reporter_posts() {
        let source = IngestSource::new();

        assert_eq!(round_trip(&source, &authorized_post(&heartbeat())).await, "HTTP/1.1 204 No Content");

        let batch = source.drain_after(0).unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].at_ms, 1_700_000_000_000);
        assert_eq!(batch.events[0].payload.reporter, "vscode");
        assert_eq!(batch.events[0].payload.kind, "editor-heartbeat");
        assert_eq!(batch.events[0].payload.payload["repoPath"], "/home/tom/dev/sdk");
    }

    /// The host lifts the instant and the kind and keeps the rest whole, so a reporter that learns to
    /// send a new field reaches the core with it rather than having it dropped here.
    #[tokio::test]
    async fn passes_a_field_it_knows_nothing_about_straight_through() {
        let source = IngestSource::new();
        let body = r#"{"reporter":"chrome","events":[{"atMs":1,"kind":"browser-tab","host":"gitlab.com"}]}"#;

        round_trip(&source, &authorized_post(body)).await;

        assert_eq!(source.drain_after(0).unwrap().events[0].payload.payload["host"], "gitlab.com");
    }

    #[tokio::test]
    async fn refuses_a_post_with_no_token_and_counts_it() {
        let source = IngestSource::new();

        assert_eq!(round_trip(&source, &post(&heartbeat(), "")).await, "HTTP/1.1 401 Unauthorized");
        assert!(source.drain_after(0).unwrap().events.is_empty());
        assert_eq!(source.status().unwrap().refused, 1);
    }

    #[tokio::test]
    async fn refuses_a_post_from_a_browser_however_good_its_token_is() {
        let source = IngestSource::new();
        let request = post(
            &heartbeat(),
            &format!("Authorization: Bearer {TOKEN}\r\nOrigin: https://example.com\r\n"),
        );

        assert_eq!(round_trip(&source, &request).await, "HTTP/1.1 403 Forbidden");
        assert!(source.drain_after(0).unwrap().events.is_empty());
    }

    #[tokio::test]
    async fn answers_a_path_and_a_method_it_does_not_serve() {
        let source = IngestSource::new();
        let elsewhere = format!("POST /other HTTP/1.1\r\nAuthorization: Bearer {TOKEN}\r\nContent-Length: 0\r\n\r\n");
        let reading = format!("GET /ingest HTTP/1.1\r\nAuthorization: Bearer {TOKEN}\r\nContent-Length: 0\r\n\r\n");

        assert_eq!(round_trip(&source, &elsewhere).await, "HTTP/1.1 404 Not Found");
        assert_eq!(round_trip(&source, &reading).await, "HTTP/1.1 405 Method Not Allowed");
    }

    #[tokio::test]
    async fn refuses_a_body_larger_than_it_reads() {
        let source = IngestSource::new();
        let request = format!(
            "POST /ingest HTTP/1.1\r\nAuthorization: Bearer {TOKEN}\r\nContent-Length: {}\r\n\r\n",
            MAX_BODY_BYTES + 1
        );

        assert_eq!(round_trip(&source, &request).await, "HTTP/1.1 413 Payload Too Large");
    }

    #[tokio::test]
    async fn refuses_a_body_that_is_not_the_one_envelope() {
        let source = IngestSource::new();

        assert_eq!(round_trip(&source, &authorized_post("not json")).await, "HTTP/1.1 400 Bad Request");
        assert_eq!(
            round_trip(&source, &authorized_post(r#"{"reporter":"","events":[]}"#)).await,
            "HTTP/1.1 400 Bad Request"
        );
    }

    #[tokio::test]
    async fn keeps_a_paused_reporter_out_of_the_buffer_without_telling_it_to_retry() {
        let source = IngestSource::new();

        source.set_paused(true);

        assert_eq!(round_trip(&source, &authorized_post(&heartbeat())).await, "HTTP/1.1 204 No Content");
        assert!(source.drain_after(0).unwrap().events.is_empty());
    }

    #[tokio::test]
    async fn reports_which_reporters_have_arrived() {
        let source = IngestSource::new();

        round_trip(&source, &authorized_post(&heartbeat())).await;
        round_trip(&source, &authorized_post(&heartbeat())).await;

        let status = source.status().unwrap();

        assert_eq!(status.reporters.len(), 1);
        assert_eq!(status.reporters[0].reporter, "vscode");
        assert_eq!(status.reporters[0].received, 2);
        assert_eq!(status.reporters[0].last_at_ms, 1_700_000_000_000);
    }

    #[test]
    fn writes_a_discovery_file_only_its_owner_can_read() {
        let directory = std::env::temp_dir().join(format!("timetrack-ingest-{}", random_hex()));
        let path = discovery_path(&directory);

        let discovery = Discovery {
            version: PROTOCOL_VERSION,
            port: 51234,
            token: TOKEN.to_string(),
        };

        write_discovery(&path, &discovery).unwrap();

        let written: serde_json::Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();

        assert_eq!(written["version"], PROTOCOL_VERSION);
        assert_eq!(written["port"], 51234);
        assert_eq!(written["token"], TOKEN);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        }

        std::fs::remove_dir_all(&directory).unwrap();
    }
}
