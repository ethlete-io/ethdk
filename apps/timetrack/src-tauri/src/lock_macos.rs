//! The desktop's own lock, as the login window announces it.
//!
//! It is the trigger the idle timer cannot be: idleness is only seen while the window source is
//! running, and a user who locks the screen and walks off has said exactly what they mean. The Linux
//! side of this is `lock_linux.rs`, and the two behave the same way.

use crate::lock;
use block2::RcBlock;
use objc2_foundation::{NSDistributedNotificationCenter, NSNotification, NSString};
use std::ptr::NonNull;
use tauri::{AppHandle, Runtime};

const LOCKED: &str = "com.apple.screenIsLocked";
const UNLOCKED: &str = "com.apple.screenIsUnlocked";

/// Watches the login window's two announcements.
///
/// Called from `setup`, so the observers are registered on the main thread and the main run loop is
/// what delivers to them. A thread of its own would need a run loop of its own to receive anything.
pub fn start<R: Runtime>(app: AppHandle<R>) {
    let center = NSDistributedNotificationCenter::defaultCenter();

    observe(&center, LOCKED, {
        let app = app.clone();

        move || lock::lock(&app)
    });

    // The desktop unlocking is not our unlock: ours takes the account password, and following the
    // screen's would make this the weaker of the two gates. It only restarts the idle wait.
    observe(&center, UNLOCKED, move || {
        if let Some(state) = tauri::Manager::try_state::<lock::WindowLock>(&app) {
            state.came_back();
        }
    });
}

fn observe(center: &NSDistributedNotificationCenter, name: &str, act: impl Fn() + 'static) {
    let block = RcBlock::new(move |_: NonNull<NSNotification>| act());
    let token = unsafe {
        center.addObserverForName_object_queue_usingBlock(Some(&NSString::from_str(name)), None, None, &block)
    };

    // The token is the registration. Releasing it would stop the delivery, and there is no point in
    // this process's life where the screen locking should stop reaching the window lock.
    std::mem::forget(token);
}
