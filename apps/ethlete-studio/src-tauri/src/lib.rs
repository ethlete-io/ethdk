mod agent;
mod agent_claude;
mod agent_codex;
mod error;

use std::path::PathBuf;
use std::process::Command;

/// The top level of the repository the host was started in. Every git command runs from there, so a
/// path it prints is relative to the repository and not to the crate directory.
fn repository_root() -> Option<PathBuf> {
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let path = String::from_utf8_lossy(&output.stdout).trim().to_owned();

    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

fn git(args: &[&str]) -> Result<std::process::Output, String> {
    let root = repository_root().ok_or_else(|| "The host does not run inside a git repository.".to_owned())?;

    Command::new("git")
        .current_dir(root)
        .args(args)
        .output()
        .map_err(|error| format!("Unable to run git: {error}"))
}

#[tauri::command]
fn workspace_root() -> String {
    repository_root().map(|root| root.to_string_lossy().into_owned()).unwrap_or_default()
}

#[tauri::command]
fn workspace_status() -> String {
    match git(&["status", "--short"]) {
        Ok(output) => String::from_utf8_lossy(&output.stdout).trim().to_owned(),
        Err(message) => message,
    }
}

#[tauri::command]
fn workspace_check() -> String {
    match git(&["diff", "--check"]) {
        Ok(output) if output.status.success() => "git diff --check passed.".to_owned(),
        Ok(output) => String::from_utf8_lossy(&output.stdout).trim().to_owned(),
        Err(message) => message,
    }
}

#[tauri::command]
fn workspace_diff() -> String {
    match git(&["diff", "--stat"]) {
        Ok(output) => String::from_utf8_lossy(&output.stdout).trim().to_owned(),
        Err(message) => message,
    }
}

/// A desktop launcher starts the app with a trimmed PATH, and then no agent CLI is found at all.
/// `fix_path_env` reads the login shell's PATH, but it *replaces* PATH with whatever that shell
/// printed - and a shell that also prints a clear-screen escape leaves PATH empty, so not even git
/// is reachable. Widen instead: what the shell adds goes in front, what the launcher gave stays.
fn widen_path() {
    let inherited = std::env::var("PATH").unwrap_or_default();

    let _ = fix_path_env::fix();

    let mut widened: Vec<String> = Vec::new();

    for entry in std::env::var("PATH").unwrap_or_default().split(':').chain(inherited.split(':')) {
        let entry = entry.trim();

        if entry.is_empty() || widened.iter().any(|seen| seen == entry) {
            continue;
        }

        widened.push(entry.to_owned());
    }

    std::env::set_var("PATH", widened.join(":"));
}

pub fn run() {
    widen_path();

    tauri::Builder::default()
        .manage(agent::AgentRuns::default())
        .invoke_handler(tauri::generate_handler![
            agent::agent_cancel,
            agent::agent_list,
            agent::agent_run,
            workspace_check,
            workspace_diff,
            workspace_root,
            workspace_status
        ])
        .run(tauri::generate_context!())
        .expect("Ethlete Studio failed to run");
}
