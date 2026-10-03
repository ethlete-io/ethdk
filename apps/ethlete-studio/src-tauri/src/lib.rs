mod agent;
mod agent_claude;
mod agent_codex;
mod call_source;
mod design;
mod design_roots;
mod design_server;
mod design_watch;
mod error;
mod tools;
mod update;

use std::ffi::{OsStr, OsString};
use std::path::PathBuf;
use std::process::Command;

use tauri::Manager;

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
    repository_root()
        .map(|root| root.to_string_lossy().into_owned())
        .unwrap_or_default()
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
    let inherited = std::env::var_os("PATH").unwrap_or_default();

    let _ = fix_path_env::fix();

    let shell = std::env::var_os("PATH").unwrap_or_default();

    if let Some(widened) = widened(&shell, &inherited) {
        std::env::set_var("PATH", widened);
    }
}

fn widened(shell: &OsStr, inherited: &OsStr) -> Option<OsString> {
    let mut entries: Vec<PathBuf> = Vec::new();

    for entry in std::env::split_paths(shell).chain(std::env::split_paths(inherited)) {
        if entry.as_os_str().is_empty() || entries.contains(&entry) {
            continue;
        }

        entries.push(entry);
    }

    std::env::join_paths(entries).ok()
}

pub fn run() {
    if let Some(context) = tools::ToolContext::from_arguments(std::env::args().skip(1)) {
        tools::serve(&context);

        return;
    }

    widen_path();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(agent::AgentRuns::default())
        .manage(design_server::DesignServers::default())
        .manage(design_watch::DesignWatch::default())
        .manage(update::PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            agent::agent_cancel,
            agent::agent_list,
            agent::agent_run,
            design::design_project,
            design::design_set_verdict,
            design::design_set_mode,
            design::design_add_variants,
            design_roots::design_roots,
            design_roots::design_roots_add,
            design_roots::design_roots_forget,
            design_roots::design_roots_search,
            design_roots::design_scan,
            design_watch::design_watch,
            design_server::design_server_start,
            design_server::design_server_state,
            design_server::design_server_stop,
            tools::design_check,
            update::update_install,
            update::update_ready,
            workspace_check,
            workspace_diff,
            workspace_root,
            workspace_status
        ])
        .build(tauri::generate_context!())
        .expect("Ethlete Studio failed to run")
        .run(|handle, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                design_server::stop_every(&handle.state::<design_server::DesignServers>());
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_widened_path_keeps_every_entry_whole_once() {
        let shell = std::env::join_paths(["/opt/homebrew/bin", "/usr/bin"]).unwrap();
        let inherited = std::env::join_paths(["/usr/bin", "/bin"]).unwrap();
        let path = widened(&shell, &inherited).unwrap();

        assert_eq!(
            std::env::split_paths(&path).collect::<Vec<_>>(),
            ["/opt/homebrew/bin", "/usr/bin", "/bin"].map(PathBuf::from)
        );
    }

    #[cfg(windows)]
    #[test]
    fn a_widened_windows_path_keeps_its_drive_letters() {
        let shell = OsString::from(r"C:\Windows;C:\Program Files\nodejs");
        let inherited = OsString::from(r"C:\Windows;D:\tools");

        assert_eq!(
            widened(&shell, &inherited).unwrap(),
            OsString::from(r"C:\Windows;C:\Program Files\nodejs;D:\tools")
        );
    }

    fn registered_commands() -> Vec<String> {
        let source = include_str!("lib.rs");
        let list = source
            .split_once("generate_handler![")
            .expect("lib.rs registers commands")
            .1
            .split_once(']')
            .expect("the command list ends")
            .0;

        list.split(',')
            .map(|entry| entry.trim().rsplit("::").next().unwrap_or_default().to_owned())
            .filter(|entry| !entry.is_empty())
            .collect()
    }

    #[test]
    fn every_registered_command_has_a_generated_permission() {
        let build = include_str!("../build.rs");

        for command in registered_commands() {
            assert!(
                build.contains(&format!("\"{command}\"")),
                "build.rs does not list {command}"
            );
        }
    }

    #[test]
    fn every_registered_command_is_allowed_by_the_capability() {
        let capability = include_str!("../capabilities/default.json");

        for command in registered_commands() {
            let permission = format!("\"allow-{}\"", command.replace('_', "-"));

            assert!(
                capability.contains(&permission),
                "the default capability does not allow {command}"
            );
        }
    }
}
