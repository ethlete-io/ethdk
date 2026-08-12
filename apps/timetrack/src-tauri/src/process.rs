use crate::error::{TimetrackError, TimetrackResult};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

/// The only binaries the webview may ask the host to spawn. `git` drives the reconcile pass and the
/// two agent CLIs answer the reasoning prompts; nothing else in the plan needs a process, and an
/// open `run` command would turn any injected script in the webview into arbitrary code execution.
const ALLOWED_COMMANDS: [&str; 3] = ["git", "claude", "codex"];

const DEFAULT_TIMEOUT_MS: u64 = 30_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostProcessSpec {
    pub command: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub stdin: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostProcessResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub async fn run_process(spec: HostProcessSpec) -> TimetrackResult<HostProcessResult> {
    if !ALLOWED_COMMANDS.contains(&spec.command.as_str()) {
        return Err(TimetrackError::Rejected(format!(
            "{} is not one of the commands this app may run",
            spec.command
        )));
    }

    let mut command = tokio::process::Command::new(&spec.command);
    command
        .args(&spec.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(cwd) = &spec.cwd {
        command.current_dir(cwd);
    }

    let mut child = command.spawn()?;
    let pipe = child.stdin.take();
    let input = spec.stdin.clone();

    // Feeding stdin and draining stdout have to overlap: writing the whole input first deadlocks as
    // soon as the child answers with more than one pipe buffer before it has read everything.
    let feed = async move {
        match (pipe, input) {
            (Some(mut pipe), Some(input)) => {
                pipe.write_all(input.as_bytes()).await?;
                pipe.shutdown().await
            }
            _ => Ok(()),
        }
    };

    let timeout = Duration::from_millis(spec.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    let both = async move {
        let (fed, output) = tokio::join!(feed, child.wait_with_output());
        fed?;
        output
    };
    let output = match tokio::time::timeout(timeout, both).await {
        Ok(output) => output?,
        Err(_) => {
            return Err(TimetrackError::Rejected(format!(
                "{} did not finish within {}ms",
                spec.command,
                timeout.as_millis()
            )))
        }
    };

    Ok(HostProcessResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}
