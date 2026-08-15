use crate::error::{TimetrackError, TimetrackResult};
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

/// How long the flow waits for the redirect before it gives the thread back.
///
/// It has to cover a consent the user is doing by hand — signing in, picking an account, and reading
/// the unverified-app warning their own client makes Google show.
const DEFAULT_TIMEOUT_SECS: u64 = 300;

/// What the browser is shown once the code has arrived, so the tab does not sit on a blank page.
const DONE_PAGE: &str = "<!doctype html><meta charset=\"utf-8\"><title>Connected</title>\
<body style=\"font:16px system-ui;padding:3rem\">timetrack has the authorization. You can close this tab.</body>";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeRequest {
    pub authorization_endpoint: String,
    /// Everything the provider needs that does not depend on the loopback port or the verifier.
    pub query: HashMap<String, String>,
    pub timeout_secs: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeOutcome {
    pub code: String,
    /// The exact redirect the authorization used. The token exchange is rejected without the same one.
    pub redirect_uri: String,
    pub code_verifier: String,
}

fn random_hex() -> String {
    let bytes: [u8; 32] = rand::random();

    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// The S256 challenge: base64url of the verifier's SHA-256, with the padding dropped.
fn challenge_of(verifier: &str) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => (byte as char).to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

fn decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        match bytes[index] {
            b'+' => {
                out.push(b' ');
                index += 1;
            }
            b'%' if index + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or_default();

                match u8::from_str_radix(hex, 16) {
                    Ok(byte) => {
                        out.push(byte);
                        index += 3;
                    }
                    Err(_) => {
                        out.push(bytes[index]);
                        index += 1;
                    }
                }
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&out).into_owned()
}

/// The query of an HTTP request line — `GET /?code=… HTTP/1.1` — as pairs.
fn params_of(request_line: &str) -> HashMap<String, String> {
    request_line
        .split_whitespace()
        .nth(1)
        .and_then(|target| target.split_once('?'))
        .map(|(_, query)| {
            query
                .split('&')
                .filter_map(|pair| pair.split_once('='))
                .map(|(key, value)| (decode(key), decode(value)))
                .collect()
        })
        .unwrap_or_default()
}

async fn respond(stream: &mut TcpStream, status: &str, body: &str) -> TimetrackResult<()> {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );

    stream.write_all(response.as_bytes()).await?;
    stream.shutdown().await?;

    Ok(())
}

/// Waits for the one request that carries the provider's answer, and lets every other one pass.
///
/// A browser asks for `/favicon.ico` on its own, and answering that as the redirect would end the flow
/// before the user has consented to anything.
async fn wait_for_code(listener: &TcpListener, state: &str) -> TimetrackResult<String> {
    loop {
        let (mut stream, _) = listener.accept().await?;
        let mut line = String::new();

        BufReader::new(&mut stream).read_line(&mut line).await?;

        let params = params_of(&line);
        let code = params.get("code");
        let error = params.get("error");

        if code.is_none() && error.is_none() {
            respond(&mut stream, "404 Not Found", "").await?;
            continue;
        }

        // The state is what tells the user's own redirect from one another page talked this port into
        // sending, which is the whole reason the code is not accepted from the first caller.
        if params.get("state").map(String::as_str) != Some(state) {
            respond(&mut stream, "400 Bad Request", "This did not come from the authorization.").await?;
            continue;
        }

        if let Some(error) = error {
            respond(&mut stream, "200 OK", "The authorization was refused. You can close this tab.").await?;

            return Err(TimetrackError::Rejected(format!("the authorization was refused ({error})")));
        }

        respond(&mut stream, "200 OK", DONE_PAGE).await?;

        return Ok(code.cloned().unwrap_or_default());
    }
}

fn open_browser(url: &str) -> TimetrackResult<()> {
    #[cfg(target_os = "macos")]
    let (program, args): (&str, Vec<&str>) = ("open", vec![url]);
    #[cfg(target_os = "linux")]
    let (program, args): (&str, Vec<&str>) = ("xdg-open", vec![url]);
    #[cfg(target_os = "windows")]
    let (program, args): (&str, Vec<&str>) = ("cmd", vec!["/C", "start", "", url]);

    std::process::Command::new(program).args(args).spawn()?;

    Ok(())
}

/// Runs the browser half of an OAuth 2.0 authorization code flow with PKCE.
///
/// The port is only known once the socket is bound, so the redirect and the challenge are built here
/// rather than by the caller, and both are reported back — the token exchange is rejected unless it
/// repeats the same pair.
///
/// The listener is on 127.0.0.1 with a port the OS picks, which is what Google's own rules for an
/// installed application allow without the port being registered anywhere.
#[tauri::command]
pub async fn oauth_authorize(request: AuthorizeRequest) -> TimetrackResult<AuthorizeOutcome> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let redirect_uri = format!("http://127.0.0.1:{}", listener.local_addr()?.port());
    let code_verifier = random_hex();
    let state = random_hex();

    let mut query: Vec<(String, String)> = request.query.into_iter().collect();
    query.push(("redirect_uri".into(), redirect_uri.clone()));
    query.push(("code_challenge".into(), challenge_of(&code_verifier)));
    query.push(("code_challenge_method".into(), "S256".into()));
    query.push(("state".into(), state.clone()));

    let url = format!(
        "{}?{}",
        request.authorization_endpoint,
        query
            .iter()
            .map(|(key, value)| format!("{}={}", encode(key), encode(value)))
            .collect::<Vec<_>>()
            .join("&")
    );

    open_browser(&url)?;

    let timeout = Duration::from_secs(request.timeout_secs.unwrap_or(DEFAULT_TIMEOUT_SECS));
    let code = match tokio::time::timeout(timeout, wait_for_code(&listener, &state)).await {
        Ok(code) => code?,
        Err(_) => {
            return Err(TimetrackError::Rejected(
                "the browser did not come back with an authorization".into(),
            ))
        }
    };

    Ok(AuthorizeOutcome {
        code,
        redirect_uri,
        code_verifier,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_query_out_of_a_request_line() {
        let params = params_of("GET /?code=4%2F0AX&state=abc HTTP/1.1");

        assert_eq!(params.get("code"), Some(&"4/0AX".to_string()));
        assert_eq!(params.get("state"), Some(&"abc".to_string()));
    }

    #[test]
    fn treats_a_request_with_no_query_as_carrying_nothing() {
        assert!(params_of("GET /favicon.ico HTTP/1.1").is_empty());
    }

    #[test]
    fn keeps_a_percent_that_is_not_an_escape() {
        assert_eq!(decode("100%"), "100%");
    }

    #[test]
    fn encodes_everything_a_scope_contains() {
        assert_eq!(
            encode("https://www.googleapis.com/auth/calendar.readonly a b"),
            "https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.readonly%20a%20b"
        );
    }

    /// The one value in the flow that has to be exactly right, from RFC 7636's own example.
    #[test]
    fn derives_the_s256_challenge_the_way_the_rfc_does() {
        assert_eq!(
            challenge_of("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }
}
