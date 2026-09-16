use crate::error::{TimetrackError, TimetrackResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tauri::State;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRequest {
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<serde_json::Value>,
    pub form: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: serde_json::Value,
}

pub struct Http(pub reqwest::Client);

/// How long one provider call may take in total, and how long it may stall with nothing arriving.
///
/// Reqwest sets neither by default, so a provider that accepts the connection and then says nothing
/// holds the call open for as long as it likes.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const READ_TIMEOUT: Duration = Duration::from_secs(30);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

/// The largest answer that is read into memory. The widest page a provider returns is a thousand
/// worklogs; anything past this is a response no screen here shows.
const MAX_RESPONSE_BYTES: usize = 16 * 1024 * 1024;

/// The transport every provider call goes through, with the deadlines a call has to hold to.
///
/// Redirects are refused rather than followed. A provider that answers a call with a redirect to
/// another host would otherwise be handed the credential the call carries.
pub fn client() -> reqwest::Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(concat!("ethlete-timetrack/", env!("CARGO_PKG_VERSION")))
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
}

/// Whether the call may carry a credential to this URL.
///
/// A provider host is configured by hand, and `http://jira.example` reads as a host like any other
/// while putting the token and everything it answers on the wire in the clear. The loopback exception
/// is the OAuth redirect the host itself listens on, which never leaves the machine.
fn is_private_enough(url: &reqwest::Url) -> bool {
    if url.scheme() == "https" {
        return true;
    }

    url.scheme() == "http" && matches!(url.host_str(), Some("127.0.0.1") | Some("::1") | Some("localhost"))
}

/// Issues the call the core described, and reports the response whatever its status is.
///
/// A non-2xx is data, not a failure: the providers read the status and the error body to tell a
/// quota breach from a bad token, and Google answers a breach with 403 as often as 429.
///
/// A `form` wins over a `body`, because an OAuth token endpoint takes only the form encoding.
#[tauri::command]
pub async fn http_request(http: State<'_, Http>, request: HostRequest) -> TimetrackResult<HostResponse> {
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| TimetrackError::Rejected(format!("unsupported method {}", request.method)))?;
    let url = reqwest::Url::parse(&request.url)
        .map_err(|_| TimetrackError::Rejected(format!("{} is not a URL", request.url)))?;

    if !is_private_enough(&url) {
        return Err(TimetrackError::Rejected(format!(
            "{} is not https, so the credentials this call carries would go over the wire in the clear",
            request.url
        )));
    }

    let mut builder = http.0.request(method, url);

    for (name, value) in request.headers.unwrap_or_default() {
        builder = builder.header(name, value);
    }
    if let Some(form) = request.form {
        builder = builder.form(&form);
    } else if let Some(body) = request.body {
        builder = builder.json(&body);
    }

    let response = builder.send().await?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| value.to_str().ok().map(|value| (name.to_string(), value.to_string())))
        .collect();
    let text = read_bounded(response).await?;
    let body = if text.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text))
    };

    Ok(HostResponse { status, headers, body })
}

/// Reads the body a chunk at a time and stops at `MAX_RESPONSE_BYTES`.
///
/// `text()` buffers whatever arrives, so a provider answering with an endless body is answered with
/// all of this process's memory.
async fn read_bounded(response: reqwest::Response) -> TimetrackResult<String> {
    let mut response = response;
    let mut buffer: Vec<u8> = Vec::new();

    while let Some(chunk) = response.chunk().await? {
        buffer.extend_from_slice(&chunk);

        if buffer.len() > MAX_RESPONSE_BYTES {
            return Err(TimetrackError::Rejected(format!(
                "the answer is longer than the {MAX_RESPONSE_BYTES} bytes this app reads"
            )));
        }
    }

    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allows(url: &str) -> bool {
        is_private_enough(&reqwest::Url::parse(url).unwrap())
    }

    #[test]
    fn carries_credentials_only_over_tls() {
        assert!(allows("https://ethlete.atlassian.net/rest/api/3/myself"));
        assert!(!allows("http://ethlete.atlassian.net/rest/api/3/myself"));
        assert!(!allows("http://192.168.1.10/api"));
    }

    /// The OAuth redirect the host itself listens on never leaves the machine.
    #[test]
    fn keeps_the_loopback_exception_the_oauth_flow_needs() {
        assert!(allows("http://127.0.0.1:47713/"));
        assert!(allows("http://localhost:47713/"));
    }
}
