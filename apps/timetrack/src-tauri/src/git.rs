use crate::error::{TimetrackError, TimetrackResult};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
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

/// A repository the watch is armed over, and the directories an event in it arrives under.
struct Watched {
    repo: PathBuf,
    roots: Vec<PathBuf>,
}

struct Inner {
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched: Arc<Mutex<Vec<Watched>>>,
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
        relative
            .components()
            .next()
            .and_then(|first| first.as_os_str().to_str()),
        Some("HEAD") | Some("refs") | Some("packed-refs")
    )
}

/// Every watched repository a moved path belongs to.
///
/// A linked worktree keeps its branches in the repository it was linked from, so a ref moving in
/// there belongs to both. Reporting both costs one more scan; reporting the first would lose the
/// commits of whichever one lost the race.
fn moved_repos<'a>(watched: &'a [Watched], path: &'a Path) -> impl Iterator<Item = String> + 'a {
    watched
        .iter()
        .filter(move |entry| {
            entry
                .roots
                .iter()
                .any(|root| path.strip_prefix(root).is_ok_and(is_a_move))
        })
        .map(|entry| entry.repo.to_string_lossy().into_owned())
}

/// Resolves `.` and `..` without reading the filesystem.
///
/// An event path is matched against a watch by prefix, which is a text comparison, so a `..` left in
/// a watch never matches. `canonicalize` would also rewrite symlinks, which the event paths keep.
fn normalize(path: &Path) -> PathBuf {
    let mut resolved = PathBuf::new();

    for component in path.components() {
        match component {
            Component::ParentDir => {
                resolved.pop();
            }
            Component::CurDir => {}
            component => resolved.push(component),
        }
    }

    resolved
}

/// Reads the path a git pointer file names, relative to the directory that holds the pointer.
fn pointed_dir(pointer: &Path, relative_to: &Path, prefix: &str) -> Option<PathBuf> {
    let content = std::fs::read_to_string(pointer).ok()?;
    let target = Path::new(content.strip_prefix(prefix)?.trim());
    let resolved = normalize(&relative_to.join(target));

    resolved.is_dir().then_some(resolved)
}

/// The directory git keeps a repository's state in, or `None` when the path is not a repository.
///
/// A linked worktree and a submodule have a `.git` **file** that names the real directory. Nothing
/// ever appears under the file, so a watch on `<repo>/.git` reports no move for either of them.
fn git_dir(repo: &Path) -> Option<PathBuf> {
    let dot_git = repo.join(".git");

    if dot_git.is_dir() {
        return Some(dot_git);
    }

    pointed_dir(&dot_git, repo, "gitdir:")
}

/// The directories a move arrives under for one repository.
///
/// A worktree's `HEAD` moves in its own git directory, but its branches move in the directory that
/// `commondir` names, so a commit needs the second root.
fn watch_roots(git_dir: &Path) -> Vec<PathBuf> {
    let mut roots = vec![git_dir.to_path_buf()];

    if let Some(common) = pointed_dir(&git_dir.join("commondir"), git_dir, "") {
        if common != *git_dir {
            roots.push(common);
        }
    }

    roots
}

fn is_skipped(entry: &Path) -> bool {
    entry
        .file_name()
        .and_then(|name| name.to_str())
        .is_none_or(|name| name.starts_with('.') || SKIPPED_DIRS.contains(&name))
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

        if git_dir(&path).is_some() {
            found.push(path);
        } else {
            discover(&path, depth + 1, found);
        }
    }
}

/// Arms the watch over one root, reporting whether every watch it needs went on.
///
/// The directory rather than `HEAD` itself: a checkout writes `HEAD.lock` and renames it over
/// `HEAD`, which leaves a watch on the file pointing at the replaced inode. The directory sees the
/// rename. A worktree git directory holds no `refs` of its own, which is not a failure.
fn arm(watcher: &mut RecommendedWatcher, root: &Path) -> bool {
    if watcher.watch(root, RecursiveMode::NonRecursive).is_err() {
        return false;
    }

    let refs = root.join("refs");

    !refs.is_dir() || watcher.watch(&refs, RecursiveMode::Recursive).is_ok()
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
                for repo in moved_repos(&repos, path) {
                    source.mark(repo);
                }
            }
        }) {
            Ok(watcher) => watcher,
            Err(error) => return Some(error.to_string()),
        };

        let mut armed = Vec::new();

        for repo in repos.iter().take(MAX_WATCHED_REPOS) {
            let Some(roots) = git_dir(repo).map(|dir| watch_roots(&dir)) else {
                continue;
            };

            if roots.iter().all(|root| arm(&mut watcher, root)) {
                armed.push(Watched {
                    repo: repo.clone(),
                    roots,
                });
            }
        }

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

    /// Links a worktree of `of` the way `git worktree add` does: a `.git` file at the worktree, and
    /// a directory under the main repository holding its `HEAD` and a relative `commondir`.
    fn worktree(root: &Path, relative: &str, of: &Path) -> PathBuf {
        let path = root.join(relative);
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        let git_dir = of.join(".git").join("worktrees").join(&name);

        std::fs::create_dir_all(&git_dir).unwrap();
        std::fs::create_dir_all(&path).unwrap();
        std::fs::write(git_dir.join("commondir"), "../..\n").unwrap();
        std::fs::write(git_dir.join("HEAD"), "ref: refs/heads/e2e\n").unwrap();
        std::fs::write(path.join(".git"), format!("gitdir: {}\n", git_dir.to_string_lossy())).unwrap();

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

    fn watching(repos: &[&str]) -> Vec<Watched> {
        repos
            .iter()
            .map(|repo| Watched {
                repo: PathBuf::from(repo),
                roots: vec![PathBuf::from(repo).join(".git")],
            })
            .collect()
    }

    fn moved(watched: &[Watched], path: &str) -> Vec<String> {
        moved_repos(watched, Path::new(path)).collect()
    }

    #[test]
    fn attributes_a_moved_ref_to_the_repository_it_is_in() {
        let watched = watching(&["/home/tom/dev/sdk", "/home/tom/dev/app"]);

        assert_eq!(
            moved(&watched, "/home/tom/dev/app/.git/refs/heads/next"),
            ["/home/tom/dev/app"]
        );
        assert!(moved(&watched, "/home/tom/dev/app/.git/index").is_empty());
        assert!(moved(&watched, "/home/tom/dev/other/.git/HEAD").is_empty());
    }

    #[test]
    fn attributes_a_shared_ref_to_the_repository_and_to_its_worktree() {
        let watched = vec![
            Watched {
                repo: PathBuf::from("/home/tom/dev/sdk"),
                roots: vec![PathBuf::from("/home/tom/dev/sdk/.git")],
            },
            Watched {
                repo: PathBuf::from("/home/tom/dev/sdk-e2e"),
                roots: vec![
                    PathBuf::from("/home/tom/dev/sdk/.git/worktrees/sdk-e2e"),
                    PathBuf::from("/home/tom/dev/sdk/.git"),
                ],
            },
        ];

        assert_eq!(
            moved(&watched, "/home/tom/dev/sdk/.git/refs/heads/next"),
            ["/home/tom/dev/sdk", "/home/tom/dev/sdk-e2e"]
        );
        assert_eq!(
            moved(&watched, "/home/tom/dev/sdk/.git/worktrees/sdk-e2e/HEAD"),
            ["/home/tom/dev/sdk-e2e"]
        );
    }

    #[test]
    fn reads_a_worktree_state_directory_out_of_its_git_file() {
        let root = temp_root("worktree");
        let sdk = repo(&root, "sdk");
        let e2e = worktree(&root, "sdk-e2e", &sdk);

        assert_eq!(git_dir(&sdk), Some(sdk.join(".git")));
        assert_eq!(git_dir(&e2e), Some(sdk.join(".git/worktrees/sdk-e2e")));
        assert_eq!(git_dir(&root.join("nothing")), None);
    }

    #[test]
    fn watches_a_worktree_head_and_the_branches_it_shares() {
        let root = temp_root("roots-of");
        let sdk = repo(&root, "sdk");
        let e2e = worktree(&root, "sdk-e2e", &sdk);

        assert_eq!(watch_roots(&git_dir(&sdk).unwrap()), [sdk.join(".git")]);
        assert_eq!(
            watch_roots(&git_dir(&e2e).unwrap()),
            [sdk.join(".git/worktrees/sdk-e2e"), sdk.join(".git")]
        );
    }

    #[test]
    fn finds_a_worktree_as_a_repository_of_its_own() {
        let root = temp_root("worktree-discovery");
        let sdk = repo(&root, "sdk");

        worktree(&root, "sdk-e2e", &sdk);
        std::fs::create_dir_all(root.join("stale")).unwrap();
        std::fs::write(root.join("stale/.git"), "gitdir: /nowhere/at/all\n").unwrap();

        assert_eq!(found_in(&root), ["sdk", "sdk-e2e"]);
    }

    #[test]
    fn resolves_a_relative_pointer_without_leaving_a_parent_step_in_the_path() {
        assert_eq!(
            normalize(Path::new("/home/tom/dev/sdk/.git/worktrees/e2e/../..")),
            PathBuf::from("/home/tom/dev/sdk/.git")
        );
        assert_eq!(normalize(Path::new("/home/./tom/dev")), PathBuf::from("/home/tom/dev"));
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
