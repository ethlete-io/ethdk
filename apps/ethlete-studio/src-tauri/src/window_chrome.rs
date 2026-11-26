use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;

use crate::error::{StudioError, StudioResult};

const SCHEMA: &str = "org.gnome.desktop.wm.preferences";
const KEY: &str = "button-layout";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Os {
    Macos,
    Windows,
    Linux,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WindowButton {
    Minimize,
    Maximize,
    Close,
}

/// The window buttons Studio draws on each side of its title bar.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowChrome {
    pub os: Os,
    pub left: Vec<WindowButton>,
    pub right: Vec<WindowButton>,
    pub prefer_no_csd: bool,
}

const DEFAULT_RIGHT: [WindowButton; 3] = [WindowButton::Minimize, WindowButton::Maximize, WindowButton::Close];

fn button(name: &str) -> Option<WindowButton> {
    match name.trim() {
        "minimize" => Some(WindowButton::Minimize),
        "maximize" => Some(WindowButton::Maximize),
        "close" => Some(WindowButton::Close),
        _ => None,
    }
}

fn buttons(side: &str, taken: &[WindowButton]) -> Vec<WindowButton> {
    let mut found: Vec<WindowButton> = Vec::new();

    for button in side.split(',').filter_map(button) {
        if !found.contains(&button) && !taken.contains(&button) {
            found.push(button);
        }
    }

    found
}

/// Splits a GNOME `button-layout` value (`left:right`, comma separated) into the buttons Studio draws.
fn layout(button_layout: Option<&str>) -> (Vec<WindowButton>, Vec<WindowButton>) {
    let Some(raw) = button_layout.map(str::trim).filter(|raw| !raw.is_empty()) else {
        return (Vec::new(), DEFAULT_RIGHT.to_vec());
    };

    let (left, right) = raw.split_once(':').unwrap_or((raw, ""));
    let left = buttons(left, &[]);
    let right = buttons(right, &left);

    (left, right)
}

pub fn chrome(os: Os, button_layout: Option<&str>, prefer_no_csd: bool) -> WindowChrome {
    let (left, right) = match os {
        Os::Macos => (Vec::new(), Vec::new()),
        Os::Windows => (Vec::new(), DEFAULT_RIGHT.to_vec()),
        Os::Linux if prefer_no_csd => {
            let close_only = |side: Vec<WindowButton>| -> Vec<WindowButton> {
                side.into_iter()
                    .filter(|button| *button == WindowButton::Close)
                    .collect()
            };
            let (left, right) = layout(button_layout);
            let (left, right) = (close_only(left), close_only(right));

            if left.is_empty() && right.is_empty() {
                (left, vec![WindowButton::Close])
            } else {
                (left, right)
            }
        }
        Os::Linux => layout(button_layout),
    };

    WindowChrome {
        os,
        left,
        right,
        prefer_no_csd,
    }
}

/// Reads one GVariant string as `gsettings get` prints it, or a `gsettings monitor` line (`key: 'value'`).
fn gsettings_value(line: &str) -> Option<&str> {
    let line = line.trim();
    let value = line
        .strip_prefix(KEY)
        .and_then(|rest| rest.strip_prefix(':'))
        .unwrap_or(line)
        .trim();

    value.strip_prefix('\'').and_then(|value| value.strip_suffix('\''))
}

fn current_os() -> Os {
    if cfg!(target_os = "macos") {
        Os::Macos
    } else if cfg!(target_os = "windows") {
        Os::Windows
    } else {
        Os::Linux
    }
}

fn read_button_layout() -> Option<String> {
    let output = Command::new("gsettings").args(["get", SCHEMA, KEY]).output().ok()?;

    output
        .status
        .success()
        .then(|| gsettings_value(&String::from_utf8_lossy(&output.stdout)).map(str::to_owned))
        .flatten()
}

fn prefer_no_csd() -> bool {
    #[cfg(target_os = "linux")]
    {
        crate::window_chrome_wayland::prefers_server_side()
    }

    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

/// The `gsettings monitor` one window armed. Arming it again replaces the one before it.
#[derive(Default)]
pub struct ChromeWatch(Mutex<Option<Child>>);

impl ChromeWatch {
    pub fn stop(&self) {
        if let Some(mut child) = self.0.lock().ok().and_then(|mut slot| slot.take()) {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// Sends the title bar's window buttons now and again whenever the GNOME `button-layout` changes.
#[tauri::command]
pub fn window_chrome_watch(watch: State<'_, ChromeWatch>, changes: Channel<WindowChrome>) -> StudioResult<()> {
    let os = current_os();
    let no_csd = os == Os::Linux && prefer_no_csd();
    let button_layout = (os == Os::Linux).then(read_button_layout).flatten();

    changes
        .send(chrome(os, button_layout.as_deref(), no_csd))
        .map_err(|error| StudioError::Rejected(format!("window chrome: {error}")))?;

    watch.stop();

    if os != Os::Linux {
        return Ok(());
    }

    let Ok(mut child) = Command::new("gsettings")
        .args(["monitor", SCHEMA, KEY])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    else {
        return Ok(());
    };

    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Some(value) = gsettings_value(&line) {
                    let _ = changes.send(chrome(os, Some(value), no_csd));
                }
            }
        });
    }

    *watch.0.lock().map_err(|_| StudioError::Poisoned)? = Some(child);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::WindowButton::{Close, Maximize, Minimize};
    use super::*;

    fn sides(chrome: WindowChrome) -> (Vec<WindowButton>, Vec<WindowButton>) {
        (chrome.left, chrome.right)
    }

    #[test]
    fn appmenu_close_shows_only_close_on_the_right() {
        assert_eq!(
            sides(chrome(Os::Linux, Some("appmenu:close"), false)),
            (vec![], vec![Close])
        );
    }

    #[test]
    fn a_right_layout_keeps_its_order() {
        assert_eq!(
            sides(chrome(Os::Linux, Some(":minimize,maximize,close"), false)),
            (vec![], vec![Minimize, Maximize, Close])
        );
    }

    #[test]
    fn a_left_layout_puts_every_button_on_the_left() {
        assert_eq!(
            sides(chrome(Os::Linux, Some("close,minimize:"), false)),
            (vec![Close, Minimize], vec![])
        );
    }

    #[test]
    fn an_unset_layout_puts_all_three_on_the_right() {
        assert_eq!(
            sides(chrome(Os::Linux, None, false)),
            (vec![], vec![Minimize, Maximize, Close])
        );
        assert_eq!(
            sides(chrome(Os::Linux, Some("  "), false)),
            (vec![], vec![Minimize, Maximize, Close])
        );
    }

    #[test]
    fn unknown_and_repeated_entries_are_dropped() {
        assert_eq!(
            sides(chrome(
                Os::Linux,
                Some("icon,close:spacer,close,maximize,maximize"),
                false
            )),
            (vec![Close], vec![Maximize])
        );
    }

    #[test]
    fn a_layout_without_a_colon_is_all_left() {
        assert_eq!(
            sides(chrome(Os::Linux, Some("close,maximize"), false)),
            (vec![Close, Maximize], vec![])
        );
    }

    #[test]
    fn no_csd_keeps_only_close_on_the_side_the_layout_gives() {
        assert_eq!(
            sides(chrome(Os::Linux, Some("appmenu:close"), true)),
            (vec![], vec![Close])
        );
        assert_eq!(
            sides(chrome(Os::Linux, Some("close,minimize:"), true)),
            (vec![Close], vec![])
        );
        assert_eq!(
            sides(chrome(Os::Linux, Some(":minimize,maximize,close"), true)),
            (vec![], vec![Close])
        );
    }

    #[test]
    fn no_csd_puts_close_on_the_right_when_the_layout_has_none() {
        assert_eq!(sides(chrome(Os::Linux, None, true)), (vec![], vec![Close]));
        assert_eq!(
            sides(chrome(Os::Linux, Some("minimize:maximize"), true)),
            (vec![], vec![Close])
        );
    }

    #[test]
    fn macos_draws_no_buttons_and_windows_draws_three_on_the_right() {
        assert_eq!(sides(chrome(Os::Macos, Some("close:"), false)), (vec![], vec![]));
        assert_eq!(
            sides(chrome(Os::Windows, Some("close:"), false)),
            (vec![], vec![Minimize, Maximize, Close])
        );
    }

    #[test]
    fn gsettings_output_and_monitor_lines_are_read() {
        assert_eq!(gsettings_value("'appmenu:close'\n"), Some("appmenu:close"));
        assert_eq!(
            gsettings_value("button-layout: ':minimize,maximize,close'"),
            Some(":minimize,maximize,close")
        );
        assert_eq!(gsettings_value("No such schema"), None);
    }

    #[test]
    fn the_chrome_serializes_the_way_the_webview_reads_it() {
        let json = serde_json::to_value(chrome(Os::Linux, Some("appmenu:close"), true)).unwrap();

        assert_eq!(
            json,
            serde_json::json!({ "os": "linux", "left": [], "right": ["close"], "preferNoCsd": true })
        );
    }
}
