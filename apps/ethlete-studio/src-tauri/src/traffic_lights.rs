//! Centres the macOS traffic lights on Studio's title bar and checks the result in the real window.

use tauri::{Runtime, WebviewWindow};

/// The height of `.st-title-bar` (`h-8`), the bar the traffic lights sit on.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const TITLE_BAR_HEIGHT: f64 = 32.0;
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const TRAFFIC_LIGHT_X: f64 = 12.0;
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
const CHECK_ENV: &str = "STUDIO_TRAFFIC_LIGHT_CHECK";
const TOLERANCE: f64 = 0.5;

/// The runtime makes the title-bar container `button height + y` tall from the window top and keeps the
/// button's offset from the container bottom, so the button centre lands `y + height / 2 - bottom` down.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn centred_inset_y(bar_height: f64, button_bottom: f64, button_height: f64) -> f64 {
    bar_height / 2.0 - button_height / 2.0 + button_bottom
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn verdict(close_centre: f64, bar_height: f64) -> (f64, bool) {
    let offset = close_centre - bar_height / 2.0;
    (offset, offset.abs() <= TOLERANCE)
}

#[cfg(target_os = "macos")]
struct CloseButton {
    bottom_in_container: f64,
    height: f64,
    centre_from_top: f64,
}

#[cfg(target_os = "macos")]
fn close_button<R: Runtime>(window: &WebviewWindow<R>) -> Option<CloseButton> {
    use objc2_app_kit::{NSWindow, NSWindowButton};

    let pointer = window.ns_window().ok()?;
    let nswindow: &NSWindow = unsafe { &*pointer.cast::<NSWindow>() };
    let close = nswindow.standardWindowButton(NSWindowButton::CloseButton)?;
    let container = unsafe { close.superview()?.superview()? };

    let in_container = close.convertRect_toView(close.bounds(), Some(&container));
    let bottom_in_container = if container.isFlipped() {
        container.frame().size.height - in_container.origin.y - in_container.size.height
    } else {
        in_container.origin.y
    };
    let in_window = close.convertRect_toView(close.bounds(), None);

    Some(CloseButton {
        bottom_in_container,
        height: in_container.size.height,
        centre_from_top: nswindow.frame().size.height - in_window.origin.y - in_window.size.height / 2.0,
    })
}

/// Insets the traffic lights so their centre sits on the title bar's centre. With `STUDIO_TRAFFIC_LIGHT_CHECK`
/// set, it measures the close button a few seconds later, prints one `traffic-light-check ... PASS|FAIL` line and
/// quits; under CEF the exit status always reaches the shell as 0, so read the line.
#[cfg(target_os = "macos")]
pub fn centre<R: Runtime>(window: &WebviewWindow<R>) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        let Some(close) = close_button(&target) else {
            return;
        };
        let y = centred_inset_y(TITLE_BAR_HEIGHT, close.bottom_in_container, close.height);
        let _ = target.set_traffic_light_position(tauri::LogicalPosition::new(TRAFFIC_LIGHT_X, y).into());
    });

    if std::env::var_os(CHECK_ENV).is_some() {
        schedule_check(window.clone());
    }
}

#[cfg(not(target_os = "macos"))]
pub fn centre<R: Runtime>(_window: &WebviewWindow<R>) {}

#[cfg(target_os = "macos")]
fn schedule_check<R: Runtime>(window: WebviewWindow<R>) {
    use tauri::Manager;

    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(4));
        let target = window.clone();
        let _ = window.run_on_main_thread(move || {
            let Some(close) = close_button(&target) else {
                println!("traffic-light-check no close button");
                target.app_handle().exit(2);
                return;
            };
            let (offset, centred) = verdict(close.centre_from_top, TITLE_BAR_HEIGHT);
            println!(
                "traffic-light-check close-centre={:.2} bar-centre={:.2} offset={:+.2} button-height={:.2} {}",
                close.centre_from_top,
                TITLE_BAR_HEIGHT / 2.0,
                offset,
                close.height,
                if centred { "PASS" } else { "FAIL" }
            );
            target.app_handle().exit(if centred { 0 } else { 1 });
        });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(path: &str) -> String {
        std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(path)).unwrap()
    }

    fn bar_height_in(source: &str) -> f64 {
        let class = source
            .split("st-title-bar ")
            .nth(1)
            .expect("the source draws .st-title-bar")
            .split(['"', '`'])
            .next()
            .unwrap();
        let steps: f64 = class
            .split_whitespace()
            .find_map(|token| token.strip_prefix("h-"))
            .expect("the bar has an h- class")
            .parse()
            .unwrap();
        steps * 4.0
    }

    #[test]
    fn the_title_bar_height_is_the_one_the_app_and_the_design_draw() {
        let app = read("../src/app/components/title-bar/title-bar.component.ts");
        let design = read("../../../.ethlete/design/studio/components/title-bar/title-bar.ts");

        assert_eq!(bar_height_in(&app), TITLE_BAR_HEIGHT);
        assert_eq!(bar_height_in(&design), TITLE_BAR_HEIGHT);
        assert!(design.contains(&format!("{TITLE_BAR_HEIGHT} px")));
    }

    #[test]
    fn the_inset_puts_the_button_centre_on_the_bar_centre() {
        let (bottom, height) = (3.0, 14.0);
        let y = centred_inset_y(TITLE_BAR_HEIGHT, bottom, height);

        assert_eq!(y + height / 2.0 - bottom, TITLE_BAR_HEIGHT / 2.0);
    }

    #[test]
    fn half_a_pixel_off_still_passes_and_more_fails() {
        assert_eq!(verdict(16.5, TITLE_BAR_HEIGHT), (0.5, true));
        assert!(!verdict(15.4, TITLE_BAR_HEIGHT).1);
        assert_eq!(verdict(18.0, TITLE_BAR_HEIGHT), (2.0, false));
    }
}
