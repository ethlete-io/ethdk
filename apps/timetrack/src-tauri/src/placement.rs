use crate::error::TimetrackResult;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, Runtime, Webview, Window, WindowEvent};

/// The window whose geometry is remembered. The widget has a size and a corner of its own.
const MAIN: &str = "main";

const FILE: &str = "window-placement.json";

/// The size in logical pixels, so the window keeps the size it looked like on a screen whose scale
/// factor has changed.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
struct Size {
    width: f64,
    height: f64,
}

/// The position in physical pixels. Two screens with different scale factors share no logical origin,
/// so a logical position is not comparable with the monitor list this is checked against.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
struct Position {
    x: i32,
    y: i32,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Placement {
    size: Option<Size>,
    position: Option<Position>,
    maximized: bool,
    minimized: bool,
}

/// What the window looked like when it last showed its own geometry.
///
/// A quit from the tray has to write something for a window that is by then hidden, and a hidden
/// window no longer reports where it was.
pub struct Remembered(Mutex<Placement>);

impl Remembered {
    pub fn new(placement: Placement) -> Self {
        Self(Mutex::new(placement))
    }

    fn get(&self) -> Placement {
        self.0.lock().map(|placement| *placement).unwrap_or_default()
    }

    fn set(&self, placement: Placement) {
        if let Ok(mut current) = self.0.lock() {
            *current = placement;
        }
    }
}

/// Puts the window back where it was and shows it, and answers what it was told to restore.
///
/// The window is declared invisible in `tauri.conf.json` and this is the only thing that shows it. A
/// window the compositor has already mapped would draw the default size first and then jump to the
/// stored one.
pub fn restore<R: Runtime>(app: &AppHandle<R>) -> Placement {
    let stored = read(app);

    let Some(window) = main_window(app) else {
        return stored;
    };

    apply(app, &window, stored);

    let _ = window.show();

    // After the show: a compositor that has not mapped the window yet has nothing to minimise.
    if stored.minimized {
        let _ = window.minimize();
    } else {
        let _ = window.set_focus();
    }

    // After the show as well, and this is what a tiling compositor honours: it decides the geometry of
    // every window it maps, and the size it gives one is not up for discussion until it is mapped.
    apply(app, &window, stored);

    stored
}

/// Puts the remembered geometry back onto a window that has just been mapped again.
///
/// A window hidden to the tray is unmapped, so a compositor that sizes and places windows by its own
/// rules applies them again the next time it comes back.
pub fn reapply<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = main_window(app) else {
        return;
    };

    let Some(remembered) = app.try_state::<Remembered>() else {
        return;
    };

    apply(app, &window, remembered.get());
}

fn apply<R: Runtime>(app: &AppHandle<R>, window: &Window<R>, placement: Placement) {
    if let Some(size) = placement.size {
        let _ = window.set_size(LogicalSize::new(size.width, size.height));
    }

    if let Some(position) = placement
        .position
        .filter(|position| is_on_a_screen(*position, &screens(app)))
    {
        let _ = window.set_position(PhysicalPosition::new(position.x, position.y));
    }

    if placement.maximized {
        let _ = window.maximize();
    }
}

/// Follows the window as it is moved, resized and put away.
///
/// Nothing is written while the window is being dragged: a resize emits one event per frame. The
/// geometry is kept in memory instead, and written when the window is closed to the tray and when the
/// app exits.
pub fn remember<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if window.label() != MAIN {
        return;
    }

    match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            if let Some(remembered) = window.try_state::<Remembered>() {
                remembered.set(restorable(remembered.get(), live(window)));
            }
        }
        WindowEvent::CloseRequested { .. } => persist(window.app_handle()),
        _ => {}
    }
}

/// Writes what the window looks like now, merged with what it looked like when it last showed its own
/// geometry.
pub fn persist<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = main_window(app) else {
        return;
    };

    let Some(remembered) = app.try_state::<Remembered>() else {
        return;
    };

    let placement = restorable(remembered.get(), live(&window));

    remembered.set(placement);

    if let Err(error) = write(app, &placement) {
        eprintln!("could not store where the window was: {error}");
    }
}

/// The geometry to go back to. A maximised, minimised or hidden window is not showing the geometry it
/// should return to, so what it had before that is kept.
fn restorable(previous: Placement, live: Placement) -> Placement {
    Placement {
        size: live.size.or(previous.size),
        position: live.position.or(previous.position),
        ..live
    }
}

/// `Manager::get_window` is behind Tauri's `unstable` feature, so the window is reached through the
/// webview that is mounted in it.
fn main_window<R: Runtime>(app: &AppHandle<R>) -> Option<Window<R>> {
    app.get_webview_window(MAIN)
        .map(|webview| AsRef::<Webview<R>>::as_ref(&webview).window())
}

fn live<R: Runtime>(window: &Window<R>) -> Placement {
    let visible = window.is_visible().unwrap_or(true);
    let maximized = window.is_maximized().unwrap_or(false);
    // A window hidden to the tray is not remembered as minimised. Bringing it back is what the user
    // does to ask for it, and a start with no window at all looks like an app that failed to open.
    let minimized = visible && window.is_minimized().unwrap_or(false);
    let settled = visible && !maximized && !minimized;
    let scale = window.scale_factor().unwrap_or(1.0);

    Placement {
        size: settled
            .then(|| window.inner_size().ok())
            .flatten()
            .map(|size| size.to_logical::<f64>(scale))
            .map(|size| Size {
                width: size.width,
                height: size.height,
            }),
        position: settled
            .then(|| window.outer_position().ok())
            .flatten()
            .map(|position| Position {
                x: position.x,
                y: position.y,
            }),
        maximized,
        minimized,
    }
}

/// Where every attached screen is, in physical pixels.
fn screens<R: Runtime>(app: &AppHandle<R>) -> Vec<(Position, Size)> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .map(|monitor| {
            (
                Position {
                    x: monitor.position().x,
                    y: monitor.position().y,
                },
                Size {
                    width: monitor.size().width as f64,
                    height: monitor.size().height as f64,
                },
            )
        })
        .collect()
}

/// Whether the window's top left corner still lands on a screen. A position from a monitor that has
/// been unplugged is one the user cannot reach, so it is dropped and the compositor places the window.
fn is_on_a_screen(position: Position, screens: &[(Position, Size)]) -> bool {
    screens.iter().any(|(origin, size)| {
        let x = f64::from(position.x - origin.x);
        let y = f64::from(position.y - origin.y);

        x >= 0.0 && x < size.width && y >= 0.0 && y < size.height
    })
}

fn file<R: Runtime>(app: &AppHandle<R>) -> TimetrackResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join(FILE))
}

fn read<R: Runtime>(app: &AppHandle<R>) -> Placement {
    file(app)
        .ok()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|document| serde_json::from_str(&document).ok())
        .unwrap_or_default()
}

fn write<R: Runtime>(app: &AppHandle<R>, placement: &Placement) -> TimetrackResult<()> {
    let path = file(app)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(path, serde_json::to_string(placement)?)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn placed(x: i32, y: i32, width: f64, height: f64) -> Placement {
        Placement {
            size: Some(Size { width, height }),
            position: Some(Position { x, y }),
            maximized: false,
            minimized: false,
        }
    }

    fn screen(x: i32, y: i32, width: f64, height: f64) -> (Position, Size) {
        (Position { x, y }, Size { width, height })
    }

    #[test]
    fn takes_the_geometry_the_window_reports_while_it_shows_it() {
        let next = restorable(placed(0, 0, 800.0, 600.0), placed(40, 20, 1100.0, 760.0));

        assert_eq!(next, placed(40, 20, 1100.0, 760.0));
    }

    #[test]
    fn keeps_the_earlier_geometry_for_a_window_that_reports_none() {
        let maximized = Placement {
            size: None,
            position: None,
            maximized: true,
            minimized: false,
        };

        let next = restorable(placed(40, 20, 1100.0, 760.0), maximized);

        assert_eq!(
            next.size,
            Some(Size {
                width: 1100.0,
                height: 760.0
            })
        );
        assert_eq!(next.position, Some(Position { x: 40, y: 20 }));
        assert!(next.maximized);
    }

    #[test]
    fn accepts_a_position_on_a_screen_that_is_left_of_the_first_one() {
        let screens = [screen(0, 0, 1920.0, 1080.0), screen(-1920, 0, 1920.0, 1080.0)];

        assert!(is_on_a_screen(Position { x: -1800, y: 300 }, &screens));
    }

    #[test]
    fn refuses_a_position_on_a_screen_that_is_no_longer_attached() {
        let screens = [screen(0, 0, 1920.0, 1080.0)];

        assert!(!is_on_a_screen(Position { x: 2400, y: 300 }, &screens));
    }

    #[test]
    fn reads_a_document_written_before_a_field_existed() {
        let placement: Placement = serde_json::from_str("{}").unwrap();

        assert_eq!(placement, Placement::default());
    }

    #[test]
    fn round_trips_what_it_stores() {
        let placement = Placement {
            minimized: true,
            ..placed(40, 20, 1100.0, 760.0)
        };

        let document = serde_json::to_string(&placement).unwrap();

        assert_eq!(serde_json::from_str::<Placement>(&document).unwrap(), placement);
    }
}
