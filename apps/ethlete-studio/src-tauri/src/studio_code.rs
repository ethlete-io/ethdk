use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

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
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PushState {
    unpushed: u32,
    oldest_age_hours: Option<f64>,
    gate: String,
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
}

async fn run_script(command: &str) -> StudioResult<(String, Vec<String>)> {
    let output = crate::child_env::command("node")
        .arg(SCRIPT)
        .arg(command)
        .current_dir(repo_root())
        .stdin(Stdio::null())
        .kill_on_drop(true)
        .output()
        .await
        .map_err(|error| match error.kind() {
            std::io::ErrorKind::NotFound => StudioError::NotInstalled("node".to_owned()),
            _ => StudioError::Io(error),
        })?;
    let lines: Vec<String> = String::from_utf8_lossy(&output.stderr)
        .lines()
        .map(str::to_owned)
        .collect();

    if !output.status.success() {
        return Err(StudioError::Rejected(format!(
            "{SCRIPT} {command} failed.\n{}",
            lines.join("\n")
        )));
    }

    Ok((String::from_utf8_lossy(&output.stdout).trim().to_owned(), lines))
}

fn parsed<T: for<'de> Deserialize<'de>>(text: &str) -> StudioResult<T> {
    serde_json::from_str(text).map_err(|error| StudioError::Rejected(format!("{SCRIPT} answered no JSON: {error}")))
}

pub async fn cli_copy() -> StudioResult<(CliCopy, Vec<String>)> {
    let (stdout, mut lines) = run_script("cli-copy").await?;

    lines.drain(..lines.len().saturating_sub(PREFACE_LINES));

    Ok((parsed(&stdout)?, lines))
}

#[derive(Deserialize)]
pub struct AppCopy {
    pub switched: bool,
}

pub async fn app_copy() -> StudioResult<AppCopy> {
    parsed(&run_script("app-copy").await?.0)
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

    let areas: Areas = parsed(&run_script("state").await?.0)?;

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
