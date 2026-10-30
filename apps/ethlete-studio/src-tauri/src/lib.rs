mod agent;
mod agent_claude;
mod agent_codex;
mod call_source;
mod call_status;
mod child_env;
mod design;
mod design_roots;
mod design_server;
mod error;
mod tools;
mod update;
#[cfg(target_os = "macos")]
mod webview_rebuild;

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

const PANIC_LOG: &str = "ethlete-studio-panics.log";

fn panic_report(thread: Option<&str>, message: &str, backtrace: &str) -> String {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default();

    format!(
        "Studio panic at unix {seconds} on thread {}: {message}\n{backtrace}\n",
        thread.unwrap_or("<unnamed>")
    )
}

fn append_panic_report(path: &std::path::Path, report: &str) {
    use std::io::Write;

    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(report.as_bytes());
    }
}

pub fn run() {
    if let Some(context) = tools::ToolContext::from_arguments(std::env::args().skip(1)) {
        tools::serve(&context);

        return;
    }

    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        previous_hook(info);
        let report = panic_report(
            std::thread::current().name(),
            &info.to_string(),
            &std::backtrace::Backtrace::force_capture().to_string(),
        );
        eprintln!("{report}");
        append_panic_report(&std::env::temp_dir().join(PANIC_LOG), &report);
    }));

    widen_path();
    child_env::remember();

    let builder = tauri::Builder::default();
    #[cfg(target_os = "linux")]
    let builder = builder.runtime(tauri_runtime_cef::Cef::default());
    #[cfg(not(target_os = "linux"))]
    let builder = builder.runtime(tauri_runtime_wry::Wry::default());
    #[cfg(target_os = "macos")]
    let builder = builder.on_web_content_process_terminate(webview_rebuild::on_terminate);

    builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(agent::AgentRuns::default())
        .manage(design_server::DesignServers::default())
        .manage(call_status::StatusWatch::default())
        .manage(update::PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            agent::agent_cancel,
            agent::agent_list,
            agent::agent_run,
            call_status::design_status_watch,
            design::design_project,
            design_roots::design_roots,
            design_roots::design_roots_add,
            design_roots::design_roots_forget,
            design_roots::design_roots_search,
            design_roots::design_scan,
            design_server::design_server_start,
            design_server::design_server_state,
            design_server::design_server_stop,
            design_server::design_server_restart,
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
    fn a_panic_report_is_appended_after_the_earlier_ones() {
        let path = std::env::temp_dir().join(format!("studio-panic-test-{}.log", std::process::id()));
        let _ = std::fs::remove_file(&path);

        append_panic_report(&path, &panic_report(Some("tokio-rt-worker"), "first", "frame a"));
        append_panic_report(&path, &panic_report(None, "second", "frame b"));

        let log = std::fs::read_to_string(&path).unwrap();
        let _ = std::fs::remove_file(&path);

        assert!(log.contains("on thread tokio-rt-worker: first\nframe a\n"));
        assert!(log.contains("on thread <unnamed>: second\nframe b\n"));
        assert!(log.find("first").unwrap() < log.find("second").unwrap());
    }

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
