use crate::error::TimetrackResult;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};

const SHOW: &str = "show";
const QUIT: &str = "quit";

fn reveal<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// Gives the tray icon declared in `tauri.conf.json` its menu and its click behaviour.
///
/// Quit is the only way out once closing the window hides it, so it has to stay in this menu: a
/// desktop with no tray host would otherwise leave the app running with nothing to bring it back.
pub fn attach<R: Runtime>(app: &AppHandle<R>) -> TimetrackResult<()> {
    let Some(tray) = app.tray_by_id("main") else {
        return Ok(());
    };

    let show = MenuItem::with_id(app, SHOW, "Show Timetrack", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, "Quit", true, None::<&str>)?;

    tray.set_menu(Some(Menu::with_items(app, &[&show, &quit])?))?;
    tray.on_menu_event(|app, event| match event.id.as_ref() {
        SHOW => reveal(app),
        QUIT => app.exit(0),
        _ => {}
    });
    tray.on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            reveal(tray.app_handle());
        }
    });

    Ok(())
}

/// Hides the window instead of closing it, so the collectors keep running once it is out of the way.
pub fn hide_instead_of_closing<R: Runtime>(window: &tauri::Window<R>, event: &tauri::WindowEvent) {
    let tauri::WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };

    api.prevent_close();
    let _ = window.hide();
}
