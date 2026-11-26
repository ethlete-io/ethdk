use crate::error::TimetrackResult;
use crate::tray;
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

/// The second window's label. The webview reads its own label to decide which root it boots, so this
/// string is also what tells the bundle it is the widget rather than the app.
const LABEL: &str = "widget";

/// Big enough for four short lines and the two buttons, small enough to leave beside real work.
const WIDTH: f64 = 340.0;
const HEIGHT: f64 = 148.0;

/// How far the widget sits from the working area's bottom-right corner.
const MARGIN: f64 = 24.0;

/// Places the widget in the bottom-right corner of the monitor the app is on.
///
/// A compositor is free to ignore this — a tiling one will place the window by its own rules — so a
/// monitor it cannot read is not an error: the widget opens wherever the compositor puts it.
fn corner<R: Runtime>(app: &AppHandle<R>) -> Option<(f64, f64)> {
    let monitor = app.primary_monitor().ok()??;
    let scale = monitor.scale_factor();
    let size = monitor.size().to_logical::<f64>(scale);
    let position = monitor.position().to_logical::<f64>(scale);

    Some((
        position.x + size.width - WIDTH - MARGIN,
        position.y + size.height - HEIGHT - MARGIN,
    ))
}

/// Opens the always-on-top readout, or reveals the one that is already open.
///
/// It loads the same bundle as the main window because there is only one: the webview branches on its
/// own window label at bootstrap, which keeps the widget out of a second build and, more importantly,
/// out of a second set of collectors.
#[tauri::command]
pub async fn widget_open<R: Runtime>(app: AppHandle<R>) -> TimetrackResult<()> {
    if let Some(window) = app.get_webview_window(LABEL) {
        window.show()?;
        window.set_focus()?;

        return Ok(());
    }

    // A title of its own, not the app's: on a tiling compositor a window rule is the only way to make
    // this one float, and a rule cannot tell two windows apart that are called the same thing.
    let mut builder = WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::default())
        .title("Timetrack readout")
        .inner_size(WIDTH, HEIGHT)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true);

    if let Some((x, y)) = corner(&app) {
        builder = builder.position(x, y);
    }

    builder.build()?;

    Ok(())
}

#[tauri::command]
pub async fn widget_close<R: Runtime>(app: AppHandle<R>) -> TimetrackResult<()> {
    if let Some(window) = app.get_webview_window(LABEL) {
        window.close()?;
    }

    Ok(())
}

#[tauri::command]
pub async fn widget_is_open<R: Runtime>(app: AppHandle<R>) -> TimetrackResult<bool> {
    Ok(app.get_webview_window(LABEL).is_some())
}

/// Brings the app's own window back, which is what the widget is the shortest way to on a desktop
/// whose bar hosts no tray.
#[tauri::command]
pub async fn widget_reveal_app<R: Runtime>(app: AppHandle<R>) -> TimetrackResult<()> {
    tray::reveal(&app);

    Ok(())
}
