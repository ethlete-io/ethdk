use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::utils::config::WindowConfig;
use tauri::{AppHandle, Manager, Runtime, WebviewWindowBuilder};

const LOG_ENV: &str = "ETHLETE_STUDIO_CONSOLE_LOG";
const SMOKE_VIEW_ENV: &str = "ETHLETE_STUDIO_SMOKE_VIEW";
const LOG_FILE: &str = "console.log";
const MAX_LOG_BYTES: u64 = 1024 * 1024;
const SMOKE_MARKER: &str = "[studio-release-smoke]";

#[cfg(any(target_os = "linux", target_os = "macos"))]
pub trait ConsoleRuntime: Runtime<RuntimeWebviewAttributes: tauri_runtime_cef::AsCefWebviewAttributes> {}
#[cfg(any(target_os = "linux", target_os = "macos"))]
impl<R: Runtime<RuntimeWebviewAttributes: tauri_runtime_cef::AsCefWebviewAttributes>> ConsoleRuntime for R {}

#[cfg(target_os = "windows")]
pub trait ConsoleRuntime: Runtime {}
#[cfg(target_os = "windows")]
impl<R: Runtime> ConsoleRuntime for R {}

pub fn path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    std::env::var_os(LOG_ENV)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| app.path().app_log_dir().ok().map(|dir| dir.join(LOG_FILE)))
}

pub fn build_window<R: ConsoleRuntime>(app: &AppHandle<R>, config: &WindowConfig) -> tauri::Result<()> {
    let builder = WebviewWindowBuilder::from_config(app, config)?;
    let builder = match std::env::var(SMOKE_VIEW_ENV) {
        Ok(view) if !view.is_empty() => builder.initialization_script(smoke_script(&view)),
        _ => builder,
    };

    with_console_log(builder, path(app)).build().map(|_| ())
}

pub fn start<R: ConsoleRuntime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(log) = path(app) {
        prepare(&log);
    }

    for config in app.config().app.windows.iter().filter(|window| !window.create) {
        build_window(app, config)?;
    }

    Ok(())
}

fn prepare(log: &Path) {
    if let Some(dir) = log.parent() {
        let _ = std::fs::create_dir_all(dir);
    }

    if std::fs::metadata(log).is_ok_and(|meta| meta.len() > MAX_LOG_BYTES) {
        let _ = std::fs::remove_file(log);
    }
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn with_console_log<'a, R: ConsoleRuntime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
    log: Option<PathBuf>,
) -> WebviewWindowBuilder<'a, R, M> {
    use tauri_runtime_cef::{ConsoleMessageLevel, WebviewWindowBuilderCefExt};

    let Some(log) = log else {
        return builder;
    };

    builder.on_console_message(move |message| {
        if matches!(message.level, ConsoleMessageLevel::Error | ConsoleMessageLevel::Fatal) {
            append(
                &log,
                &line(unix_millis(), &message.source, message.line, &message.message),
            );
        }
    })
}

#[cfg(target_os = "windows")]
fn with_console_log<'a, R: ConsoleRuntime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
    _log: Option<PathBuf>,
) -> WebviewWindowBuilder<'a, R, M> {
    builder
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or_default()
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn line(millis: u128, source: &str, line: i32, message: &str) -> String {
    let at = match (source.is_empty(), line) {
        (true, _) => String::new(),
        (false, 0) => format!(" {source}"),
        (false, line) => format!(" {source}:{line}"),
    };

    format!(
        "{millis} ERROR{at} {}\n",
        message.replace('\r', "").replace('\n', "\\n")
    )
}

#[cfg_attr(target_os = "windows", allow(dead_code))]
fn append(log: &Path, line: &str) {
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(log) {
        let _ = file.write_all(line.as_bytes());
    }
}

fn smoke_script(view: &str) -> String {
    let view = serde_json::to_string(view).unwrap_or_else(|_| "null".into());

    format!(
        r#"(() => {{
  const key = 'ethlete-studio.call-view';
  if (window.top !== window) return;
  if (localStorage.getItem(key) === null) localStorage.setItem(key, {view});
  const timer = setInterval(() => {{
    const live = document.querySelectorAll('ethlete-sketch-view iframe[data-state]').length;
    const painted = document.querySelectorAll('ethlete-sketch-view iframe[data-state]:not(.opacity-0)').length;
    if (!painted) return;
    clearInterval(timer);
    console.error(`{SMOKE_MARKER} painted ${{painted}} of ${{live}} live frames`);
  }}, 500);
}})();"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_console_error_is_one_line_naming_its_source() {
        assert_eq!(
            line(
                7,
                "http://tauri.localhost/main.js",
                12,
                "Refused to connect\nto http://localhost:4300"
            ),
            "7 ERROR http://tauri.localhost/main.js:12 Refused to connect\\nto http://localhost:4300\n"
        );
        assert_eq!(line(7, "", 0, "boom"), "7 ERROR boom\n");
    }

    #[test]
    fn the_smoke_script_embeds_the_view_as_a_string_literal() {
        let script = smoke_script(r#"{"checkout":"/a'b"}"#);

        assert!(script.contains(r#""{\"checkout\":\"/a'b\"}""#));
    }
}
