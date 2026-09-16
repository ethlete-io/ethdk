use crate::error::TimetrackResult;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// The two files a directory must hold to be read as a spec. The names are the ones
/// `libs/timetrack/src/lib/ticket/spec.ts` declares, and renaming them there renames them here.
const METADATA_FILE: &str = "metadata.json";
const INDEX_FILE: &str = "index.md";

/// The longest either file may be. The core keeps only the opening section of the index, so a file
/// past this is one this command has no business reading in full.
const MAX_BYTES: u64 = 256 * 1024;

/// How far the walk may climb. A candidate list is ranked deepest first, and a spec that is not in
/// the first few directories the work touched is not the spec for that work.
const MAX_CANDIDATES: usize = 8;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadSpecRequest {
    pub repo_path: String,
    /// Candidate directories, relative to `repo_path`, ranked by the caller.
    pub directories: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecFiles {
    /// The candidate that held both files, as it was given.
    pub directory: String,
    pub metadata: String,
    pub index: Option<String>,
}

/// Resolves a candidate against the checkout it must stay inside.
///
/// Both sides are canonicalised before the check, so a symlink out of the checkout is refused the
/// same way `..` is. A candidate that does not exist canonicalises to an error and is skipped.
fn inside(repo: &Path, directory: &str) -> Option<PathBuf> {
    if directory.is_empty() || Path::new(directory).is_absolute() {
        return None;
    }

    let resolved = repo.join(directory).canonicalize().ok()?;

    resolved.starts_with(repo).then_some(resolved)
}

fn read_capped(path: &Path) -> Option<String> {
    let metadata = std::fs::metadata(path).ok()?;

    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return None;
    }

    std::fs::read_to_string(path).ok()
}

/// Reads the spec files of the first candidate directory that holds them.
///
/// This command exists instead of a general file read on purpose. A ticket is written from a spec, and
/// ADR 0013 puts the whole of what leaves this machine in front of the user first. A command that can
/// only ever return two files, from inside one checkout, under names the core fixes, is a surface a
/// reader can audit; a general read is not.
///
/// An index the directory does not hold is not a failure: the metadata alone still names the work.
#[tauri::command]
pub fn read_spec(request: ReadSpecRequest) -> TimetrackResult<Option<SpecFiles>> {
    let Ok(repo) = PathBuf::from(&request.repo_path).canonicalize() else {
        return Ok(None);
    };

    for directory in request.directories.iter().take(MAX_CANDIDATES) {
        let Some(resolved) = inside(&repo, directory) else {
            continue;
        };
        let Some(metadata) = read_capped(&resolved.join(METADATA_FILE)) else {
            continue;
        };

        return Ok(Some(SpecFiles {
            directory: directory.clone(),
            metadata,
            index: read_capped(&resolved.join(INDEX_FILE)),
        }));
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("timetrack-spec-{name}"));

        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("tracks/one")).expect("a scratch checkout");
        std::fs::write(root.join("tracks/one").join(METADATA_FILE), r#"{"title":"One"}"#).expect("metadata");
        std::fs::write(
            root.join("tracks/one").join(INDEX_FILE),
            "## Kurzfassung\n\nWhat it is.",
        )
        .expect("index");

        root
    }

    fn read(root: &Path, directories: &[&str]) -> Option<SpecFiles> {
        read_spec(ReadSpecRequest {
            repo_path: root.to_string_lossy().into_owned(),
            directories: directories.iter().map(|d| (*d).to_owned()).collect(),
        })
        .expect("a read")
    }

    #[test]
    fn reads_the_first_candidate_that_holds_the_metadata() {
        let root = scratch("first");
        let found = read(&root, &["tracks/two", "tracks/one", "tracks"]).expect("a spec");

        assert_eq!(found.directory, "tracks/one");
        assert_eq!(found.metadata, r#"{"title":"One"}"#);
        assert!(found.index.is_some());
    }

    #[test]
    fn an_index_the_directory_does_not_hold_is_not_a_failure() {
        let root = scratch("no-index");
        std::fs::remove_file(root.join("tracks/one").join(INDEX_FILE)).expect("removed");

        assert!(read(&root, &["tracks/one"]).expect("a spec").index.is_none());
    }

    #[test]
    fn refuses_a_candidate_that_climbs_out_of_the_checkout() {
        let root = scratch("climb");
        let outside = root.join("tracks/one");
        let sibling = root.join("sibling");

        std::fs::create_dir_all(&sibling).expect("a sibling");
        assert!(read(&sibling, &["../tracks/one"]).is_none());
        assert!(outside.join(METADATA_FILE).exists());
    }

    #[test]
    fn refuses_an_absolute_candidate() {
        let root = scratch("absolute");
        let absolute = root.join("tracks/one").to_string_lossy().into_owned();

        assert!(read(&root, &[absolute.as_str()]).is_none());
    }

    #[test]
    fn refuses_a_file_past_the_cap() {
        let root = scratch("cap");

        std::fs::write(
            root.join("tracks/one").join(METADATA_FILE),
            "x".repeat(MAX_BYTES as usize + 1),
        )
        .expect("a big file");
        assert!(read(&root, &["tracks/one"]).is_none());
    }

    #[test]
    fn stops_after_the_candidates_it_is_willing_to_walk() {
        let root = scratch("walk");
        let mut directories = vec!["nowhere"; MAX_CANDIDATES];

        directories.push("tracks/one");
        assert!(read(&root, &directories).is_none());
    }
}
