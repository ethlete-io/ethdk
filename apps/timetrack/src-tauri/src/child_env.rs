use std::ffi::{OsStr, OsString};
use std::sync::OnceLock;

use tokio::process::Command;

static INHERITED_GDK_BACKEND: OnceLock<Option<OsString>> = OnceLock::new();

/// Must run before the Tauri runtime starts: on Linux the CEF runtime sets `GDK_BACKEND=x11` for the
/// whole process, and the processes Timetrack starts must not inherit that.
pub fn remember() {
    INHERITED_GDK_BACKEND.get_or_init(|| std::env::var_os("GDK_BACKEND"));
}

pub fn command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);

    match INHERITED_GDK_BACKEND.get() {
        Some(Some(backend)) => {
            command.env("GDK_BACKEND", backend);
        }
        Some(None) => {
            command.env_remove("GDK_BACKEND");
        }
        None => {}
    }

    command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[tokio::test]
    async fn a_child_sees_the_gdk_backend_timetrack_was_started_with() {
        let inherited = std::env::var_os("GDK_BACKEND");
        remember();
        std::env::set_var("GDK_BACKEND", "timetrack-runtime");

        let output = command("sh")
            .arg("-c")
            .arg("printf %s \"${GDK_BACKEND-unset}\"")
            .output()
            .await
            .expect("sh runs");

        std::env::remove_var("GDK_BACKEND");
        if let Some(inherited) = &inherited {
            std::env::set_var("GDK_BACKEND", inherited);
        }

        let expected = inherited.map_or("unset".to_string(), |value| value.to_string_lossy().into_owned());
        assert_eq!(String::from_utf8_lossy(&output.stdout), expected);
    }
}
