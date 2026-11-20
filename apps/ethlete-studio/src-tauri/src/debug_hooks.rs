use std::path::{Path, PathBuf};

const PORT_VAR: &str = "ETHLETE_STUDIO_CDP_PORT";
const ROOT_VAR: &str = "ETHLETE_STUDIO_OPEN_ROOT";

pub fn cdp_port() -> Option<u16> {
    std::env::var(PORT_VAR).ok()?.trim().parse().ok()
}

fn cache_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    let base = std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Library/Caches"));
    #[cfg(not(target_os = "macos"))]
    let base = std::env::var_os("XDG_CACHE_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".cache")));

    base.map(|base| base.join("io.ethlete.studio").join("cef").join("Local State"))
}

/// Chromium keeps `devtools.remote_debugging.allowed = false` in Local State once a run had the port
/// disabled, and reads it before the runtime's own preference applies (ADR 0251). Must run before CEF starts.
pub fn forget_disallowed_port() {
    if let Some(path) = cache_dir() {
        remove_disallowed_key(&path);
    }
}

fn remove_disallowed_key(path: &Path) {
    let Ok(text) = std::fs::read_to_string(path) else {
        return;
    };
    let Ok(mut state) = serde_json::from_str::<serde_json::Value>(&text) else {
        return;
    };

    let removed = state
        .get_mut("devtools")
        .and_then(|devtools| devtools.get_mut("remote_debugging"))
        .and_then(|debugging| debugging.as_object_mut())
        .and_then(|debugging| debugging.remove("allowed"))
        .is_some();

    if removed {
        if let Ok(text) = serde_json::to_string(&state) {
            let _ = std::fs::write(path, text);
        }
    }
}

/// The debug socket Chromium listens on is inherited by every child unless it is closed on exec (ADR 0251).
#[cfg(unix)]
pub fn close_inherited_sockets(command: &mut tokio::process::Command) {
    unsafe {
        command.pre_exec(|| {
            for fd in 3..1024 {
                let flags = libc::fcntl(fd, libc::F_GETFD);
                if flags >= 0 {
                    libc::fcntl(fd, libc::F_SETFD, flags | libc::FD_CLOEXEC);
                }
            }
            Ok(())
        });
    }
}

pub fn open_root(app: &tauri::AppHandle) {
    if let Some(root) = std::env::var_os(ROOT_VAR) {
        if let Err(error) = crate::design_roots::keep_only_root(app, &root.to_string_lossy()) {
            eprintln!("{ROOT_VAR}: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_stored_disallowed_key_is_dropped_and_the_rest_kept() {
        let path = std::env::temp_dir().join(format!("studio-local-state-{}.json", std::process::id()));
        std::fs::write(
            &path,
            r#"{"devtools":{"remote_debugging":{"allowed":false}},"other":1}"#,
        )
        .unwrap();

        remove_disallowed_key(&path);

        let state: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        let _ = std::fs::remove_file(&path);
        assert!(state["devtools"]["remote_debugging"].get("allowed").is_none());
        assert_eq!(state["other"], 1);
    }
}
