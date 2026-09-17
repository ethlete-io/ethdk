use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::Channel;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use crate::agent_claude::ClaudeCli;
use crate::agent_codex::CodexCli;
use crate::error::{StudioError, StudioResult};

/// One agent CLI that Studio can drive. A second CLI is another implementation of this trait, never
/// a flag on an existing one.
pub trait AgentCli: Send + Sync {
    fn id(&self) -> &'static str;

    fn label(&self) -> &'static str;

    fn binary(&self) -> &'static str;

    /// Model names to offer first. A run accepts any other name as well, because the list belongs to
    /// the CLI and changes without Studio changing.
    fn suggested_models(&self) -> Vec<String>;

    /// The arguments that answer one prompt without a terminal and print newline-delimited JSON.
    /// A request that names a session continues it instead of starting a new one.
    fn arguments(&self, request: &AgentRequest) -> Vec<String>;

    /// The session a printed line belongs to, so the next run can continue it.
    fn session_of(&self, line: &str) -> Option<String> {
        let value = serde_json::from_str::<Value>(line).ok()?;

        ["session_id", "thread_id"]
            .iter()
            .find_map(|key| value.get(key).and_then(Value::as_str))
            .map(str::to_owned)
    }

    /// Turns one line the CLI printed into what the UI shows. A line can carry several events, or
    /// none at all.
    fn read_line(&self, line: &str) -> Vec<AgentEvent>;
}

fn every_cli() -> Vec<Box<dyn AgentCli>> {
    vec![Box::new(ClaudeCli), Box::new(CodexCli)]
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDescriptor {
    pub id: String,
    pub label: String,
    pub binary: String,
    pub version: String,
    pub suggested_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AgentEvent {
    #[serde(rename_all = "camelCase")]
    Started { cli: String, model: Option<String> },
    /// The session the run belongs to. Naming it in the next request continues this conversation.
    #[serde(rename_all = "camelCase")]
    Session { id: String },
    #[serde(rename_all = "camelCase")]
    Message { text: String },
    #[serde(rename_all = "camelCase")]
    Action { action: String, detail: String },
    #[serde(rename_all = "camelCase")]
    Failed { message: String },
    #[serde(rename_all = "camelCase")]
    Finished { ok: bool, summary: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRequest {
    pub cli: String,
    pub model: Option<String>,
    pub prompt: String,
    /// The checkout the agent works in. A project's design work lives in that project's own repo, so
    /// every run names the directory it writes to.
    pub cwd: String,
    /// The session to continue. Left out by a run that starts a new conversation.
    pub resume: Option<String>,
}

#[derive(Default, Clone)]
pub struct AgentRuns(Arc<Mutex<HashMap<String, Child>>>);

/// Where a run's events go. A Tauri channel is the one the app uses; a test uses its own.
pub trait EventSink: Send + Sync + 'static {
    fn emit(&self, event: AgentEvent) -> bool;
}

impl EventSink for Channel<AgentEvent> {
    fn emit(&self, event: AgentEvent) -> bool {
        self.send(event).is_ok()
    }
}

static NEXT_RUN: AtomicU64 = AtomicU64::new(1);

const DETAIL_KEYS: [&str; 6] = ["file_path", "command", "pattern", "path", "url", "description"];

/// A short readable stand-in for a tool's whole argument object, so the stream reads as a list of
/// actions and not as a wall of JSON.
pub fn detail(input: Option<&Value>) -> String {
    let Some(input) = input else {
        return String::new();
    };

    if let Some(text) = input.as_str() {
        return clip(text);
    }

    for key in DETAIL_KEYS {
        if let Some(found) = input.get(key).and_then(Value::as_str) {
            return clip(found);
        }
    }

    clip(&input.to_string())
}

pub fn clip(text: &str) -> String {
    let text = text.trim();

    if text.chars().count() <= 160 {
        return text.to_owned();
    }

    let mut short: String = text.chars().take(159).collect();
    short.push('…');
    short
}

#[tauri::command]
pub async fn agent_list() -> Vec<AgentDescriptor> {
    let mut installed = Vec::new();

    for cli in every_cli() {
        let Ok(output) = Command::new(cli.binary()).arg("--version").output().await else {
            continue;
        };

        if !output.status.success() {
            continue;
        }

        installed.push(AgentDescriptor {
            id: cli.id().to_owned(),
            label: cli.label().to_owned(),
            binary: cli.binary().to_owned(),
            version: String::from_utf8_lossy(&output.stdout).trim().to_owned(),
            suggested_models: cli.suggested_models(),
        });
    }

    installed
}

/// Starts one agent run and returns its id at once, so the UI can cancel a run that is still going.
/// Every later event arrives on `stream`.
#[tauri::command]
pub async fn agent_run(
    runs: tauri::State<'_, AgentRuns>,
    request: AgentRequest,
    stream: Channel<AgentEvent>,
) -> StudioResult<String> {
    let cli = every_cli()
        .into_iter()
        .find(|cli| cli.id() == request.cli)
        .ok_or_else(|| StudioError::Rejected(format!("No agent CLI is registered under {}.", request.cli)))?;

    start(cli, &request, runs.inner().clone(), Arc::new(stream)).await
}

/// Spawns the CLI and reads what it prints until it stops. It is split out of the command so a test
/// can drive this same path with a CLI it controls.
async fn start(
    cli: Box<dyn AgentCli>,
    request: &AgentRequest,
    table: AgentRuns,
    sink: Arc<dyn EventSink>,
) -> StudioResult<String> {
    let cwd = PathBuf::from(&request.cwd);

    if !cwd.is_dir() {
        return Err(StudioError::Rejected(format!("{} is not a directory.", request.cwd)));
    }

    let mut child = Command::new(cli.binary())
        .current_dir(&cwd)
        .args(cli.arguments(request))
        // Codex reads a prompt from stdin when it is a pipe, and then waits for input that never
        // comes.
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| match error.kind() {
            std::io::ErrorKind::NotFound => StudioError::NotInstalled(cli.binary().to_owned()),
            _ => StudioError::Io(error),
        })?;

    let stdout = child
        .stdout
        .take()
        .ok_or(StudioError::Rejected("The agent printed nowhere.".to_owned()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or(StudioError::Rejected("The agent printed nowhere.".to_owned()))?;

    let id = format!("run-{}", NEXT_RUN.fetch_add(1, Ordering::Relaxed));

    table
        .0
        .lock()
        .map_err(|_| StudioError::Poisoned)?
        .insert(id.clone(), child);

    sink.emit(AgentEvent::Started {
        cli: cli.id().to_owned(),
        model: request.model.clone(),
    });

    let complaints = Arc::new(Mutex::new(String::new()));
    let pen = complaints.clone();

    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(mut pen) = pen.lock() else {
                return;
            };

            pen.push_str(&line);
            pen.push('\n');
        }
    });

    let reader_id = id.clone();

    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        let mut reported = false;
        let mut named = false;

        while let Ok(Some(line)) = lines.next_line().await {
            if !named {
                if let Some(id) = cli.session_of(&line) {
                    named = true;
                    sink.emit(AgentEvent::Session { id });
                }
            }

            for event in cli.read_line(&line) {
                reported = reported || matches!(event, AgentEvent::Finished { .. });

                if !sink.emit(event) {
                    break;
                }
            }
        }

        let taken = table.0.lock().ok().and_then(|mut table| table.remove(&reader_id));
        let status = match taken {
            Some(mut child) => child.wait().await.ok(),
            None => None,
        };

        if reported {
            return;
        }

        let summary = complaints.lock().map(|text| clip(text.trim())).unwrap_or_default();

        sink.emit(AgentEvent::Finished {
            ok: status.is_some_and(|status| status.success()),
            summary,
        });
    });

    Ok(id)
}

#[tauri::command]
pub async fn agent_cancel(runs: tauri::State<'_, AgentRuns>, run_id: String) -> StudioResult<()> {
    let taken = runs.0.lock().map_err(|_| StudioError::Poisoned)?.remove(&run_id);

    if let Some(mut child) = taken {
        let _ = child.start_kill();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    struct ScriptedCli(&'static str);

    impl AgentCli for ScriptedCli {
        fn id(&self) -> &'static str {
            "scripted"
        }

        fn label(&self) -> &'static str {
            "Scripted"
        }

        fn binary(&self) -> &'static str {
            "sh"
        }

        fn suggested_models(&self) -> Vec<String> {
            Vec::new()
        }

        fn arguments(&self, _request: &AgentRequest) -> Vec<String> {
            vec!["-c".to_owned(), self.0.to_owned()]
        }

        fn read_line(&self, line: &str) -> Vec<AgentEvent> {
            ClaudeCli.read_line(line)
        }
    }

    #[derive(Default)]
    struct Collected(Mutex<Vec<AgentEvent>>);

    impl EventSink for Collected {
        fn emit(&self, event: AgentEvent) -> bool {
            self.0.lock().expect("the sink lock holds").push(event);
            true
        }
    }

    async fn drive(script: &'static str) -> Vec<AgentEvent> {
        let sink = Arc::new(Collected::default());

        let request = AgentRequest {
            cli: "scripted".to_owned(),
            model: None,
            prompt: String::new(),
            cwd: ".".to_owned(),
            resume: None,
        };

        start(
            Box::new(ScriptedCli(script)),
            &request,
            AgentRuns::default(),
            sink.clone(),
        )
        .await
        .expect("the scripted CLI starts");

        for _ in 0..300 {
            tokio::time::sleep(Duration::from_millis(10)).await;

            let seen = sink.0.lock().expect("the sink lock holds");

            if seen.iter().any(|event| matches!(event, AgentEvent::Finished { .. })) {
                return seen.clone();
            }
        }

        panic!("the run never finished");
    }

    #[tokio::test]
    async fn a_run_reports_what_the_agent_said_and_then_its_result() {
        let seen = drive(concat!(
            r#"printf '%s\n' '{"type":"system","subtype":"init"}'; "#,
            r#"printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"text","text":"ok"}]}}'; "#,
            r#"printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"ok"}'"#
        ))
        .await;

        assert!(matches!(seen.first(), Some(AgentEvent::Started { .. })));
        assert!(seen
            .iter()
            .any(|event| matches!(event, AgentEvent::Message { text } if text == "ok")));
        assert!(matches!(seen.last(), Some(AgentEvent::Finished { ok: true, summary }) if summary == "ok"));
    }

    #[tokio::test]
    async fn a_run_names_the_session_it_belongs_to() {
        let seen = drive(concat!(
            r#"printf '%s\n' '{"type":"system","subtype":"init","session_id":"s-1"}'; "#,
            r#"printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"result":"ok","session_id":"s-1"}'"#
        ))
        .await;

        let named: Vec<&AgentEvent> = seen
            .iter()
            .filter(|event| matches!(event, AgentEvent::Session { .. }))
            .collect();

        assert!(matches!(named.as_slice(), [AgentEvent::Session { id }] if id == "s-1"));
    }

    #[tokio::test]
    async fn a_run_that_prints_nothing_still_finishes() {
        let seen = drive("echo 'the CLI complained' >&2; exit 3").await;

        assert!(
            matches!(seen.last(), Some(AgentEvent::Finished { ok: false, summary }) if summary == "the CLI complained")
        );
    }
}
