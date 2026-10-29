//! Workaround for a WebKit bug in Safari 18 (branches `safari-7621` to `7623`): when WebContent
//! dies while gesture replies are pending, `WebPageProxy` keeps the stale gesture queue, and every
//! later pinch kills the reloaded content process (`Received an invalid message
//! 'EventDispatcher_GestureEventReply'`). `safari-7624` clears it in `resetStateAfterProcessExited`.
//! A reload reuses the broken `WKWebView`, so the main window is rebuilt instead.
//!
//! The rebuilt window needs a new label: wry keys a webview's custom protocol handlers by its
//! label and drops them when the old webview is freed, which happens after the new one exists.

use std::sync::atomic::{AtomicU32, Ordering};

use tauri::utils::config::WindowConfig;
use tauri::webview::WebContentProcessTermination;
use tauri::{Manager, Runtime, Webview, WebviewUrl, WebviewWindowBuilder};

const MAIN: &str = "main";

static REBUILDS: AtomicU32 = AtomicU32::new(0);

pub fn on_terminate<R: Runtime>(webview: &Webview<R>, _termination: &WebContentProcessTermination) {
    let config = (webview.label() == MAIN || webview.label().starts_with("main-"))
        .then(|| rebuilt_config(webview))
        .flatten();

    let Some(config) = config else {
        let _ = webview.reload();

        return;
    };

    let webview = webview.clone();

    let _ = webview.clone().run_on_main_thread(move || {
        let handle = webview.app_handle();

        match WebviewWindowBuilder::from_config(handle, &config).and_then(WebviewWindowBuilder::build) {
            Ok(_) => {
                let _ = webview.window().destroy();
            }
            Err(error) => {
                eprintln!("Unable to rebuild the Studio window, reloading it: {error}");
                let _ = webview.reload();
            }
        }
    });
}

fn rebuilt_config<R: Runtime>(webview: &Webview<R>) -> Option<WindowConfig> {
    let window = webview.window();
    let scale = window.scale_factor().ok()?;
    let position = window.outer_position().ok()?.to_logical::<f64>(scale);
    let size = window.inner_size().ok()?.to_logical::<f64>(scale);

    let mut config = webview
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN)?
        .clone();

    config.label = format!("{MAIN}-{}", REBUILDS.fetch_add(1, Ordering::Relaxed) + 1);
    config.url = WebviewUrl::External(webview.url().ok()?);
    config.x = Some(position.x);
    config.y = Some(position.y);
    config.width = size.width;
    config.height = size.height;
    config.maximized = window.is_maximized().unwrap_or(false);
    config.fullscreen = window.is_fullscreen().unwrap_or(false);
    config.center = false;

    Some(config)
}
