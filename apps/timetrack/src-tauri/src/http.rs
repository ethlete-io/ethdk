use crate::error::{TimetrackError, TimetrackResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRequest {
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<serde_json::Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: serde_json::Value,
}

pub struct Http(pub reqwest::Client);

/// Issues the call the core described, and reports the response whatever its status is.
///
/// A non-2xx is data, not a failure: the providers read the status and the error body to tell a
/// quota breach from a bad token, and Google answers a breach with 403 as often as 429.
#[tauri::command]
pub async fn http_request(http: State<'_, Http>, request: HostRequest) -> TimetrackResult<HostResponse> {
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| TimetrackError::Rejected(format!("unsupported method {}", request.method)))?;
    let mut builder = http.0.request(method, &request.url);

    for (name, value) in request.headers.unwrap_or_default() {
        builder = builder.header(name, value);
    }
    if let Some(body) = request.body {
        builder = builder.json(&body);
    }

    let response = builder.send().await?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| value.to_str().ok().map(|value| (name.to_string(), value.to_string())))
        .collect();
    let text = response.text().await?;
    let body = if text.is_empty() {
        serde_json::Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text))
    };

    Ok(HostResponse { status, headers, body })
}
