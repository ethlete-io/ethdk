use crate::error::TimetrackResult;
use serde::Serialize;
use tauri::State;

/// What the window manager will actually honour, so the titlebar can hide the controls it would not.
#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowCapabilities {
    pub minimize: bool,
    pub maximize: bool,
    pub fullscreen: bool,
}

impl WindowCapabilities {
    /// xdg-shell only advertises capabilities from version 5, and the spec reads silence as "all of
    /// them" — a compositor that says nothing must not be rendered as one that allows nothing.
    pub const ALL: Self = Self {
        minimize: true,
        maximize: true,
        fullscreen: true,
    };
}

pub fn detect() -> WindowCapabilities {
    #[cfg(target_os = "linux")]
    {
        crate::decorations_wayland::probe().unwrap_or(WindowCapabilities::ALL)
    }

    #[cfg(not(target_os = "linux"))]
    {
        WindowCapabilities::ALL
    }
}

#[tauri::command]
pub async fn window_capabilities(capabilities: State<'_, WindowCapabilities>) -> TimetrackResult<WindowCapabilities> {
    Ok(*capabilities.inner())
}
