use crate::error::{TimetrackError, TimetrackResult};
use chrono::Local;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// Moves a store and its journal aside, and answers where the store went.
///
/// A rename, not a delete: the file holds every day the user ever collected, and a store this build
/// cannot open is not always one a later build cannot read. The `-wal` and `-shm` files carry the pages
/// no checkpoint has folded in yet, so a store moved without them is not the store that was there.
pub fn move_aside(path: &Path) -> TimetrackResult<PathBuf> {
    let name = path
        .file_name()
        .ok_or_else(|| TimetrackError::Rejected("the store has no file name".into()))?
        .to_string_lossy()
        .into_owned();
    let aside = format!("{name}.broken-{}", Local::now().format("%Y%m%d-%H%M%S"));

    std::fs::rename(path, path.with_file_name(&aside))?;

    for suffix in ["-wal", "-shm"] {
        let journal = path.with_file_name(format!("{name}{suffix}"));

        if journal.exists() {
            std::fs::rename(journal, path.with_file_name(format!("{aside}{suffix}")))?;
        }
    }

    Ok(path.with_file_name(aside))
}

/// Offers to start over when the store cannot be opened at all, and restarts the app once it has.
///
/// The dialog blocks the thread it runs on and draws on the main one, so it must not be shown from the
/// main thread — and `setup`, the only place that knows the store failed, runs there. Hence the thread,
/// and hence an app that starts with no store managed: nothing collects, and the window stays hidden
/// behind the dialog until the user has answered it.
pub fn offer_a_fresh_start(app: &AppHandle, path: PathBuf, failure: String) {
    let app = app.clone();

    std::thread::spawn(move || {
        let kept_in = path.parent().map(Path::to_path_buf).unwrap_or_default();
        let fresh = app
            .dialog()
            .message(format!(
                "{failure}\n\nStarting fresh begins an empty store and keeps the old file in {}. The days it holds are not carried over.",
                kept_in.display()
            ))
            .title("Timetrack cannot open its database")
            .kind(MessageDialogKind::Error)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Start fresh".into(),
                "Quit".into(),
            ))
            .blocking_show();

        if !fresh {
            app.exit(0);
            return;
        }

        if let Err(error) = move_aside(&path) {
            app.dialog()
                .message(format!("The old store could not be moved aside: {error}"))
                .title("Timetrack cannot start fresh")
                .kind(MessageDialogKind::Error)
                .blocking_show();
            app.exit(1);
            return;
        }

        // Before the restart: the restarted binary is started while this one is still alive, and a
        // single instance that still holds its name sends the new process straight back out again.
        tauri_plugin_single_instance::destroy(&app);
        app.restart();
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moves_a_store_and_its_journal_out_of_the_way() {
        let dir = std::env::temp_dir().join(format!("timetrack-recovery-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("timetrack.db");

        for name in ["timetrack.db", "timetrack.db-wal", "timetrack.db-shm"] {
            std::fs::write(dir.join(name), name).unwrap();
        }

        let aside = move_aside(&path).unwrap();

        assert!(!path.exists());
        assert!(!dir.join("timetrack.db-wal").exists());
        assert!(!dir.join("timetrack.db-shm").exists());
        assert_eq!(std::fs::read_to_string(&aside).unwrap(), "timetrack.db");
        assert_eq!(
            std::fs::read_to_string(
                aside.with_file_name(format!("{}-wal", aside.file_name().unwrap().to_string_lossy()))
            )
            .unwrap(),
            "timetrack.db-wal"
        );

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// What "Start fresh" has to deliver: the app opens after it, on a store it could not open before.
    #[test]
    fn opens_a_fresh_store_once_a_broken_one_is_moved_aside() {
        let dir = std::env::temp_dir().join(format!("timetrack-recovery-fresh-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("timetrack.db");
        let key = "0".repeat(64);

        std::fs::write(&path, "not a database").unwrap();

        assert!(crate::db::open(&path, &key).is_err());

        move_aside(&path).unwrap();

        crate::db::open(&path, &key).unwrap();

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn moves_a_store_that_has_no_journal() {
        let dir = std::env::temp_dir().join(format!("timetrack-recovery-bare-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("timetrack.db");

        std::fs::write(&path, "store").unwrap();

        assert_eq!(std::fs::read_to_string(move_aside(&path).unwrap()).unwrap(), "store");

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
