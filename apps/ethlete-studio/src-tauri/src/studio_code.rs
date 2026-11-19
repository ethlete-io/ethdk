use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tokio::io::AsyncBufReadExt;

use crate::design_server::DesignServers;
use crate::error::{StudioError, StudioResult};

const SCRIPT: &str = "tools/scripts/studio-code.mjs";

const PREFACE_LINES: usize = 40;

/// `yarn studio` starts the app again when this file exists after the app quit.
const REBUILD_MARKER: &str = "tmp/studio-rebuild";

/// `yarn studio` names the last commit of the host it built, so a commit during the build still
/// reads as a change.
const HOST_SHA_ENV: &str = "ETHLETE_STUDIO_HOST_SHA";

pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

#[derive(Deserialize)]
struct Areas {
    cli: CliArea,
    frontend: Area,
    host: Area,
    #[serde(default)]
    push: Option<PushState>,
    #[serde(default)]
    uncommitted: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PushState {
    unpushed: u32,
    oldest_age_hours: Option<f64>,
}

#[derive(Deserialize)]
struct Area {
    latest: Option<String>,
}

#[derive(Deserialize)]
struct CliArea {
    latest: Option<String>,
    dirty: bool,
}

#[derive(Deserialize)]
pub struct CliCopy {
    pub entry: PathBuf,
    pub sha: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CliCode {
    running: Option<String>,
    latest: Option<String>,
    dirty: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FrontendCode {
    latest: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HostCode {
    running: Option<String>,
    latest: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodeState {
    cli: CliCode,
    frontend: FrontendCode,
    host: HostCode,
    push: Option<PushState>,
    uncommitted: Vec<String>,
}

const PHASE_PREFIX: &str = "phase: ";

async fn run_script(command: &str, on_phase: &(dyn Fn(&str) + Send + Sync)) -> StudioResult<(String, Vec<String>)> {
    let mut child = crate::child_env::command("node")
        .arg(SCRIPT)
        .arg(command)
        .current_dir(repo_root())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| match error.kind() {
            std::io::ErrorKind::NotFound => StudioError::NotInstalled("node".to_owned()),
            _ => StudioError::Io(error),
        })?;
    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| StudioError::Rejected("node has no stdout".to_owned()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| StudioError::Rejected("node has no stderr".to_owned()))?;
    let collected = async {
        let mut text = String::new();

        tokio::io::AsyncReadExt::read_to_string(&mut stdout, &mut text).await?;

        Ok::<_, std::io::Error>(text)
    };
    let streamed = async {
        let mut lines = Vec::new();
        let mut reader = tokio::io::BufReader::new(stderr).lines();

        while let Some(line) = reader.next_line().await? {
            if let Some(name) = line.strip_prefix(PHASE_PREFIX) {
                on_phase(name.trim());
            }

            lines.push(line);
        }

        Ok::<_, std::io::Error>(lines)
    };
    let (stdout, lines) = tokio::join!(collected, streamed);
    let status = child.wait().await.map_err(StudioError::Io)?;
    let (stdout, lines) = (stdout.map_err(StudioError::Io)?, lines.map_err(StudioError::Io)?);

    if !status.success() {
        return Err(StudioError::Rejected(format!(
            "{SCRIPT} {command} failed.\n{}",
            lines.join("\n")
        )));
    }

    Ok((stdout.trim().to_owned(), lines))
}

fn parsed<T: for<'de> Deserialize<'de>>(text: &str) -> StudioResult<T> {
    serde_json::from_str(text).map_err(|error| StudioError::Rejected(format!("{SCRIPT} answered no JSON: {error}")))
}

pub async fn cli_copy(on_phase: &(dyn Fn(&str) + Send + Sync)) -> StudioResult<(CliCopy, Vec<String>)> {
    let (stdout, mut lines) = run_script("cli-copy", on_phase).await?;

    lines.drain(..lines.len().saturating_sub(PREFACE_LINES));

    Ok((parsed(&stdout)?, lines))
}

#[derive(Deserialize)]
pub struct AppCopy {
    pub switched: bool,
}

pub async fn app_copy(on_phase: &(dyn Fn(&str) + Send + Sync)) -> StudioResult<AppCopy> {
    parsed(&run_script("app-copy", on_phase).await?.0)
}

/// Reloads every window once `app-copy` points the frontend server at another commit.
pub fn reload_on_switch(app: &AppHandle, copy: &AppCopy) {
    if !copy.switched {
        return;
    }

    for window in app.webview_windows().values() {
        let _ = window.reload();
    }
}

pub fn starts_from_repo_build(checkout: &Path) -> bool {
    if !cfg!(debug_assertions) || std::env::var_os("ETHLETE_CLI").is_some() {
        return false;
    }

    match (checkout.canonicalize(), repo_root().canonicalize()) {
        (Ok(checkout), Ok(root)) => checkout == root,
        _ => false,
    }
}

fn host_running(latest: &Option<String>) -> Option<String> {
    static RUNNING: OnceLock<Option<String>> = OnceLock::new();

    RUNNING
        .get_or_init(|| {
            std::env::var(HOST_SHA_ENV)
                .ok()
                .filter(|sha| !sha.is_empty())
                .or_else(|| latest.clone())
        })
        .clone()
}

#[tauri::command]
pub async fn studio_code_state(servers: tauri::State<'_, DesignServers>) -> StudioResult<Option<CodeState>> {
    if !cfg!(debug_assertions) {
        return Ok(None);
    }

    let areas: Areas = parsed(&run_script("state", &|_: &str| ()).await?.0)?;

    Ok(Some(CodeState {
        cli: CliCode {
            running: servers.cli_sha(),
            latest: areas.cli.latest,
            dirty: areas.cli.dirty,
        },
        frontend: FrontendCode {
            latest: areas.frontend.latest,
        },
        host: HostCode {
            running: host_running(&areas.host.latest),
            latest: areas.host.latest,
        },
        push: areas.push,
        uncommitted: areas.uncommitted,
    }))
}

#[tauri::command]
pub fn studio_quit_for_rebuild(app: AppHandle) -> StudioResult<()> {
    if !cfg!(debug_assertions) {
        return Err(StudioError::Rejected(
            "only a development build is rebuilt by yarn studio".into(),
        ));
    }

    let marker = repo_root().join(REBUILD_MARKER);

    if let Some(parent) = marker.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(marker, "")?;
    app.exit(0);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_state_script_answer() {
        let answer = r#"{"cli":{"latest":"cca99d29edc41999519067b02a4e7a2d546921bc","dirty":false},"frontend":{"latest":"e22ea7f6022fd40c6a153481548fe5383e502cc0"},"host":{"latest":"74d532e3d1fc831a93f4c16b11fe30897145ae19"},"push":{"unpushed":0,"oldestAgeHours":null}}"#;

        let areas: Areas = parsed(answer).expect("the state answer parses");

        assert_eq!(areas.push.map(|push| push.unpushed), Some(0));
        assert!(areas.uncommitted.is_empty());
    }

    #[test]
    fn parses_the_uncommitted_lines() {
        let answer = r#"{"cli":{"latest":"a","dirty":false},"frontend":{"latest":"b"},"host":{"latest":"c"},"uncommitted":["SKETCH UNTRACKED studio a.b: x"]}"#;

        let areas: Areas = parsed(answer).expect("the state answer parses");

        assert_eq!(areas.uncommitted, vec!["SKETCH UNTRACKED studio a.b: x".to_string()]);
    }
}
