use crate::error::TimetrackResult;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

const ACTIVITY: &str = "activity";
const TOTAL: &str = "total";
const TIMER: &str = "timer";
const PAUSE: &str = "pause";
const SHOW: &str = "show";
const QUIT: &str = "quit";

/// What the tray asks the webview to do when the timer entry is picked.
///
/// The webview owns the timer, not the tray: it is what knows whether a run is going, and it is where
/// the store and the day the run belongs to already live.
pub const TIMER_TOGGLE_EVENT: &str = "timer-toggle";

/// The same arrangement for the pause: the tray asks, the webview acts. It is in the menu because the
/// tray is the one surface that is there whether or not the window is, and a pause you have to go
/// looking for is one you take too late.
pub const COLLECTION_PAUSE_TOGGLE_EVENT: &str = "collection-pause-toggle";

/// The menu entries the webview writes, so the tray reflects a day it does not itself reconstruct.
///
/// The readout has to live in the menu rather than in the tooltip or the icon's title: a tooltip is
/// unsupported on Linux, and a title is drawn into the panel itself, where it costs every other tray
/// icon the space it takes. The two readout entries reveal the window, because on Linux a left click
/// opens the menu instead of the app, which makes the top entry the shortest way in.
pub struct Readout<R: Runtime> {
    activity: MenuItem<R>,
    total: MenuItem<R>,
    timer: MenuItem<R>,
    pause: MenuItem<R>,
}

/// Brings the window back from hidden, minimised or unfocused, whichever of those it is.
pub fn reveal<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// Writes what the day looks like right now into the tray menu.
///
/// Both lines arrive already worded, because every duration and every label the app shows is formatted
/// by the core the review UI uses, and a second implementation here would drift from it. A desktop
/// that gave us no tray icon has no readout to write, which is not an error the webview can act on.
#[tauri::command]
pub async fn tray_set_readout<R: Runtime>(
    app: AppHandle<R>,
    activity: String,
    total: String,
    timer: String,
    pause: String,
) -> TimetrackResult<()> {
    let Some(readout) = app.try_state::<Readout<R>>() else {
        return Ok(());
    };

    readout.activity.set_text(activity)?;
    readout.total.set_text(total)?;
    readout.timer.set_text(timer)?;
    readout.pause.set_text(pause)?;

    Ok(())
}

/// Gives the tray icon declared in `tauri.conf.json` its menu and its click behaviour.
///
/// Quit is the only way out once closing the window hides it, so it has to stay in this menu: a
/// desktop with no tray host would otherwise leave the app running with nothing to bring it back.
pub fn attach<R: Runtime>(app: &AppHandle<R>) -> TimetrackResult<()> {
    let Some(tray) = app.tray_by_id("main") else {
        return Ok(());
    };

    let activity = MenuItem::with_id(app, ACTIVITY, "Starting up…", true, None::<&str>)?;
    let total = MenuItem::with_id(app, TOTAL, "No time reconstructed yet", true, None::<&str>)?;
    let timer = MenuItem::with_id(app, TIMER, "Start timer", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, PAUSE, "Pause collection", true, None::<&str>)?;
    let show = MenuItem::with_id(app, SHOW, "Show Timetrack", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    tray.set_menu(Some(Menu::with_items(
        app,
        &[&activity, &total, &separator, &timer, &pause, &show, &quit],
    )?))?;
    app.manage(Readout {
        activity,
        total,
        timer,
        pause,
    });

    tray.on_menu_event(|app, event| match event.id.as_ref() {
        QUIT => app.exit(0),
        TIMER => {
            let _ = app.emit(TIMER_TOGGLE_EVENT, ());
        }
        PAUSE => {
            let _ = app.emit(COLLECTION_PAUSE_TOGGLE_EVENT, ());
        }
        ACTIVITY | TOTAL | SHOW => reveal(app),
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
