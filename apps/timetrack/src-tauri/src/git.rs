use crate::error::{TimetrackError, TimetrackResult};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

/// How far under the home directory a repository is looked for. Deep enough for `~/dev/thing` and
/// `~/work/client/thing`, shallow enough that discovery stays a fraction of a second.
const MAX_DEPTH: usize = 3;

/// Directories a repository is never found in and which are expensive to walk.
const SKIPPED_DIRS: [&str; 5] = ["node_modules", "target", "dist", "vendor", "Library"];

/// A ceiling on watches, because each repository costs one per ref directory and the kernel's
/// `max_user_watches` is shared with every other program on the machine. Repositories past it are
/// still scanned — they just wait for the next reconcile instead of reporting a switch at once.
const MAX_WATCHED_REPOS: usize = 128;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepos {
    pub repos: Vec<String>,
    /// `watching` once the watch is armed, `none` when nothing is reporting.
    pub kind: String,
    /// Why the watch is degraded, for the panel naming what is not live.
    pub detail: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChanges {
    /// The repositories whose HEAD or refs moved since `after_seq`.
    pub repos: Vec<String>,
    pub seq: u64,
}

struct Inner {
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched: Arc<Mutex<Vec<PathBuf>>>,
    /// The sequence each repository last moved at, and the sequence handed out for it.
    changes: Mutex<(HashMap<String, u64>, u64)>,
}

/// The repositories being watched, and which of them have moved since the collector last asked.
///
/// A missed notification costs nothing here: the reflog and the commit log are durable, so the
/// periodic scan reconstructs whatever the watch failed to report. That is what lets this be a plain
/// counter rather than the acknowledged buffer the window source needs.
#[derive(Clone)]
pub struct GitWatcher(Arc<Inner>);

/// Whether a path under `.git` is one that means the user moved to different work.
///
/// `HEAD` is the switch itself and `refs`/`packed-refs` are the commits landing. Everything else in
/// there — the index, the object database, a `.lock` a write is still holding — moves constantly
/// during ordinary work and would rescan every repository for nothing.
fn is_a_move(relative: &Path) -> bool {
    if relative.extension().is_some_and(|extension| extension == "lock") {
        return false;
    }

    matches!(
        relative.components().next().and_then(|first| first.as_os_str().to_str()),
        Some("HEAD") | Some("refs") | Some("packed-refs")
    )
}

fn moved_repo(watched: &[PathBuf], path: &Path) -> Option<String> {
    watched.iter().find_map(|repo| {
        path.strip_prefix(repo.join(".git"))
            .ok()
            .filter(|relative| is_a_move(relative))
            .map(|_| repo.to_string_lossy().into_owned())
    })
}

fn is_repo(path: &Path) -> bool {
    path.join(".git").exists()
}

fn is_skipped(entry: &Path) -> bool {
    entry.file_name().and_then(|name| name.to_str()).is_none_or(|name| {
        name.starts_with('.') || SKIPPED_DIRS.contains(&name)
    })
}

/// Collects the repositories under `root`, stopping at each one rather than descending into it.
///
/// A repository inside a repository is a submodule or a vendored copy: its commits already belong to
/// the parent's history, so walking in would report the same work twice.
fn discover(root: &Path, depth: usize, found: &mut Vec<PathBuf>) {
    if depth > MAX_DEPTH {
        return;
    }

    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();

        if !entry.file_type().is_ok_and(|kind| kind.is_dir()) || is_skipped(&path) {
            continue;
        }

        if is_repo(&path) {
            found.push(path);
        } else {
            discover(&path, depth + 1, found);
        }
    }
}

impl GitWatcher {
    pub fn new() -> Self {
        Self(Arc::new(Inner {
            watcher: Mutex::new(None),
            watched: Arc::new(Mutex::new(Vec::new())),
            changes: Mutex::new((HashMap::new(), 0)),
        }))
    }

    fn mark(&self, repo: String) {
        if let Ok(mut changes) = self.0.changes.lock() {
            changes.1 += 1;

            let seq = changes.1;

            changes.0.insert(repo, seq);
        }
    }

    /// Replaces the watch with one over `repos`, and reports what could not be armed.
    ///
    /// The old watcher is dropped first: `notify` releases its kernel watches when it goes, and
    /// keeping both alive would double every notification for a repository in each set.
    fn watch(&self, repos: &[PathBuf]) -> Option<String> {
        let watched = self.0.watched.clone();
        let source = self.clone();
        let mut slot = self.0.watcher.lock().ok()?;

        *slot = None;

        let mut watcher = match notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
            let Ok(event) = event else {
                return;
            };
            let Ok(repos) = watched.lock() else {
                return;
            };

            for path in &event.paths {
                if let Some(repo) = moved_repo(&repos, path) {
                    source.mark(repo);
                }
            }
        }) {
            Ok(watcher) => watcher,
            Err(error) => return Some(error.to_string()),
        };

        let armed = repos
            .iter()
            .take(MAX_WATCHED_REPOS)
            .filter(|repo| {
                let git_dir = repo.join(".git");

                // The `.git` directory itself rather than `HEAD`: a checkout writes `HEAD.lock` and
                // renames it over `HEAD`, which leaves a watch on the file pointing at the replaced
                // inode. The directory sees the rename.
                watcher.watch(&git_dir, RecursiveMode::NonRecursive).is_ok()
                    && watcher.watch(&git_dir.join("refs"), RecursiveMode::Recursive).is_ok()
            })
            .cloned()
            .collect::<Vec<_>>();

        let skipped = repos.len().saturating_sub(armed.len());

        if let Ok(mut slot) = self.0.watched.lock() {
            *slot = armed;
        }

        *slot = Some(watcher);

        (skipped > 0).then(|| {
            format!("{skipped} of {} repositories are scanned but not watched, so a switch in one shows up at the next scan rather than at once", repos.len())
        })
    }

    fn changed_after(&self, after_seq: u64) -> TimetrackResult<GitChanges> {
        let changes = self.0.changes.lock().map_err(|_| TimetrackError::Poisoned)?;

        Ok(GitChanges {
            repos: changes
                .0
                .iter()
                .filter(|(_, seq)| **seq > after_seq)
                .map(|(repo, _)| repo.clone())
                .collect(),
            seq: changes.1,
        })
    }
}

impl Default for GitWatcher {
    fn default() -> Self {
        Self::new()
    }
}

/// Walks every root, reporting each repository once however many roots reach it. `MAX_DEPTH` counts
/// from each root, so naming `~/dev` finds work the home directory alone is too shallow to reach.
fn discover_all(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut found = Vec::new();

    for root in roots {
        discover(root, 0, &mut found);
    }

    found.sort();
    found.dedup();

    found
}

/// Finds the repositories to scan and arms the watch over them.
///
/// `roots` is what settings configures. An empty list falls back to the home directory, which is the
/// only honest guess at where a person keeps their work when nobody has said.
#[tauri::command]
pub async fn git_repos(
    app: tauri::AppHandle,
    watcher: State<'_, GitWatcher>,
    roots: Option<Vec<String>>,
) -> TimetrackResult<GitRepos> {
    let roots: Vec<PathBuf> = match roots {
        Some(roots) if !roots.is_empty() => roots.iter().map(PathBuf::from).collect(),
        _ => vec![app.path().home_dir()?],
    };
    let walked = roots
        .iter()
        .map(|root| root.to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join(", ");
    let found = tauri::async_runtime::spawn_blocking(move || discover_all(&roots))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?;

    let detail = watcher.watch(&found);

    Ok(GitRepos {
        repos: found.iter().map(|repo| repo.to_string_lossy().into_owned()).collect(),
        kind: if found.is_empty() { "none" } else { "watching" }.to_string(),
        detail: if found.is_empty() {
            Some(format!("no git repository was found under {walked}"))
        } else {
            detail
        },
    })
}

/// The repositories that moved since `after_seq`, and the sequence to ask from next time.
#[tauri::command]
pub async fn git_changes(watcher: State<'_, GitWatcher>, after_seq: u64) -> TimetrackResult<GitChanges> {
    watcher.changed_after(after_seq)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("timetrack-git-{name}"));

        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();

        root
    }

    fn repo(root: &Path, relative: &str) -> PathBuf {
        let path = root.join(relative);

        std::fs::create_dir_all(path.join(".git").join("refs").join("heads")).unwrap();

        path
    }

    fn found_in(root: &Path) -> Vec<String> {
        discover_all(&[root.to_path_buf()])
            .iter()
            .map(|path| path.strip_prefix(root).unwrap().to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn finds_a_repository_at_every_depth_it_walks() {
        let root = temp_root("depth");

        repo(&root, "sdk");
        repo(&root, "dev/frontend");
        repo(&root, "work/client/api");
        std::fs::create_dir_all(root.join("a/b/c/d/deep")).unwrap();
        repo(&root, "a/b/c/d/deep");

        assert_eq!(found_in(&root), ["dev/frontend", "sdk", "work/client/api"]);
    }

    #[test]
    fn stops_at_a_repository_rather_than_walking_into_its_submodules() {
        let root = temp_root("nested");

        repo(&root, "sdk");
        repo(&root, "sdk/libs/vendored");

        assert_eq!(found_in(&root), ["sdk"]);
    }

    #[test]
    fn skips_hidden_and_dependency_directories() {
        let root = temp_root("skipped");

        repo(&root, ".cache/thing");
        repo(&root, "sdk/node_modules/thing");
        repo(&root, "sdk/keep");

        assert_eq!(found_in(&root), ["sdk/keep"]);
    }

    #[test]
    fn reports_a_repository_two_roots_both_reach_once() {
        let root = temp_root("roots");

        repo(&root, "dev/frontend");
        repo(&root, "work/api");

        let found = discover_all(&[root.join("dev"), root.join("work"), root.clone()]);

        assert_eq!(found, [root.join("dev/frontend"), root.join("work/api")]);
    }

    #[test]
    fn finds_nothing_under_a_directory_that_is_not_there() {
        assert!(found_in(&temp_root("absent").join("never-created")).is_empty());
    }

    #[test]
    fn reads_a_head_move_and_a_ref_update_as_work_changing() {
        assert!(is_a_move(Path::new("HEAD")));
        assert!(is_a_move(Path::new("packed-refs")));
        assert!(is_a_move(Path::new("refs/heads/feat/FIP-2177-thing")));
    }

    #[test]
    fn ignores_the_churn_of_ordinary_work() {
        assert!(!is_a_move(Path::new("index")));
        assert!(!is_a_move(Path::new("HEAD.lock")));
        assert!(!is_a_move(Path::new("refs/heads/next.lock")));
        assert!(!is_a_move(Path::new("objects/ab/cdef")));
    }

    #[test]
    fn attributes_a_moved_ref_to_the_repository_it_is_in() {
        let watched = [PathBuf::from("/home/tom/dev/sdk"), PathBuf::from("/home/tom/dev/app")];

        assert_eq!(
            moved_repo(&watched, Path::new("/home/tom/dev/app/.git/refs/heads/next")),
            Some("/home/tom/dev/app".to_string())
        );
        assert_eq!(moved_repo(&watched, Path::new("/home/tom/dev/app/.git/index")), None);
        assert_eq!(moved_repo(&watched, Path::new("/home/tom/dev/other/.git/HEAD")), None);
    }

    #[test]
    fn reports_a_repository_once_per_ask_and_forgets_it_after() {
        let watcher = GitWatcher::new();

        watcher.mark("/home/tom/dev/sdk".to_string());
        watcher.mark("/home/tom/dev/app".to_string());

        let first = watcher.changed_after(0).unwrap();

        assert_eq!(first.repos.len(), 2);
        assert_eq!(first.seq, 2);
        assert!(watcher.changed_after(first.seq).unwrap().repos.is_empty());

        watcher.mark("/home/tom/dev/sdk".to_string());

        assert_eq!(watcher.changed_after(first.seq).unwrap().repos, ["/home/tom/dev/sdk"]);
    }
}
