//! Writing a file that holds a token, so no other account on the machine can read it.
//!
//! Both loopback endpoints publish where they listen and the token to reach them with. That file is
//! the whole boundary between the endpoint and every other account, so how it is created matters as
//! much as what it says.

use crate::error::TimetrackResult;
use std::path::Path;

/// Writes `bytes` so only the owner can read them, and replaces whatever was there.
///
/// The order is what makes this safe. `std::fs::write` creates the file with `0666 & ~umask` and only
/// then is the mode corrected, so under a permissive umask the token is world-readable for the moment
/// in between. Here the mode is part of the create, the write goes to a temporary file beside the
/// target, and the rename is what publishes it — a reader sees either the old file or the new one, and
/// never an empty one. `create_new` on the temporary file is what refuses to follow a symlink another
/// account left in its place.
pub fn write_private(path: &Path, bytes: &[u8]) -> TimetrackResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
        restrict_directory(parent)?;
    }

    let temporary = path.with_extension("writing");
    let _ = std::fs::remove_file(&temporary);

    {
        let mut options = std::fs::OpenOptions::new();

        options.write(true).create_new(true);

        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;

            options.mode(0o600);
        }

        let mut file = options.open(&temporary)?;

        std::io::Write::write_all(&mut file, bytes)?;
        file.sync_all()?;
    }

    std::fs::rename(&temporary, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&temporary);
    })?;

    Ok(())
}

/// Takes the group and the world off the directory the file sits in, so it cannot be listed or
/// traversed by another account whatever the file's own mode says.
#[cfg(unix)]
fn restrict_directory(path: &Path) -> TimetrackResult<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = std::fs::metadata(path)?.permissions();

    if permissions.mode() & 0o077 != 0 {
        permissions.set_mode(0o700);
        std::fs::set_permissions(path, permissions)?;
    }

    Ok(())
}

#[cfg(not(unix))]
fn restrict_directory(_path: &Path) -> TimetrackResult<()> {
    Ok(())
}

/// Takes the file away, so a token nothing is listening for is not left on disk to be answered by
/// whatever binds the port next.
pub fn forget(path: &Path) {
    let _ = std::fs::remove_file(path);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("timetrack-discovery-{name}"));

        let _ = std::fs::remove_dir_all(&dir);

        dir
    }

    #[cfg(unix)]
    #[test]
    fn never_leaves_the_token_readable_by_another_account() {
        use std::os::unix::fs::PermissionsExt;

        let dir = temp_dir("mode");
        let path = dir.join("agent.json");

        write_private(&path, b"{\"token\":\"secret\"}").unwrap();

        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
        assert_eq!(std::fs::metadata(&dir).unwrap().permissions().mode() & 0o077, 0);
    }

    #[test]
    fn replaces_what_an_earlier_run_wrote() {
        let dir = temp_dir("replace");
        let path = dir.join("agent.json");

        write_private(&path, b"first").unwrap();
        write_private(&path, b"second").unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "second");
        assert!(!path.with_extension("writing").exists());
    }

    #[test]
    fn leaves_nothing_behind_once_the_endpoint_is_gone() {
        let dir = temp_dir("forget");
        let path = dir.join("agent.json");

        write_private(&path, b"token").unwrap();
        forget(&path);

        assert!(!path.exists());
    }
}
