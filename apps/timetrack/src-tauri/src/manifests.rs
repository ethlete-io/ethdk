use crate::error::{TimetrackError, TimetrackResult};
use serde::Serialize;
use std::path::{Path, PathBuf};

/// How deep under a checkout a `package.json` is looked for: deep enough for `libs/core/package.json`
/// and `apps/web/package.json`, which is where a workspace keeps its packages.
const MAX_DEPTH: usize = 3;

const MAX_BYTES: u64 = 256 * 1024;

const MAX_FILES: usize = 64;

/// The only files this command reads. A root `tsconfig` holds the path aliases into a sibling checkout.
const PACKAGE_FILE: &str = "package.json";
const ROOT_TSCONFIGS: [&str; 2] = ["tsconfig.json", "tsconfig.base.json"];

const SKIPPED_DIRS: [&str; 6] = ["node_modules", "target", "dist", "vendor", "build", "coverage"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    /// Relative to the checkout, with `/` separators.
    pub path: String,
    pub text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckoutManifests {
    pub repo: String,
    pub files: Vec<ManifestFile>,
}

fn read_capped(path: &Path) -> Option<String> {
    let metadata = std::fs::symlink_metadata(path).ok()?;

    if !metadata.is_file() || metadata.len() > MAX_BYTES {
        return None;
    }

    std::fs::read_to_string(path).ok()
}

fn relative(root: &Path, path: &Path) -> Option<String> {
    let parts = path
        .strip_prefix(root)
        .ok()?
        .components()
        .map(|part| part.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    Some(parts.join("/"))
}

fn walk(root: &Path, directory: &Path, depth: usize, found: &mut Vec<ManifestFile>) {
    if found.len() >= MAX_FILES {
        return;
    }

    let package = directory.join(PACKAGE_FILE);

    if let (Some(text), Some(path)) = (read_capped(&package), relative(root, &package)) {
        found.push(ManifestFile { path, text });
    }

    if depth >= MAX_DEPTH {
        return;
    }

    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };
    let mut children: Vec<PathBuf> = entries
        .flatten()
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .map(|entry| entry.path())
        .filter(|path| {
            let name = path.file_name().map(|name| name.to_string_lossy()).unwrap_or_default();

            !name.starts_with('.') && !SKIPPED_DIRS.contains(&name.as_ref())
        })
        .collect();

    children.sort();

    for child in children {
        walk(root, &child, depth + 1, found);
    }
}

/// The manifests of one checkout: every `package.json` within `MAX_DEPTH`, and the root `tsconfig`s.
///
/// A directory that is not a git checkout reads as nothing, so the webview cannot point this at an
/// arbitrary directory. Symlinked files and directories are never followed out of the checkout.
fn manifests_of(repo: &Path) -> Vec<ManifestFile> {
    if !repo.join(".git").exists() {
        return Vec::new();
    }

    let mut found = Vec::new();

    for name in ROOT_TSCONFIGS {
        if let Some(text) = read_capped(&repo.join(name)) {
            found.push(ManifestFile {
                path: name.to_string(),
                text,
            });
        }
    }

    walk(repo, repo, 0, &mut found);

    found
}

/// Reads the package manifests of each checkout, for the core to work out which checkout uses which.
#[tauri::command]
pub async fn repo_manifests(repos: Vec<String>) -> TimetrackResult<Vec<CheckoutManifests>> {
    tauri::async_runtime::spawn_blocking(move || {
        repos
            .into_iter()
            .map(|repo| CheckoutManifests {
                files: manifests_of(Path::new(&repo)),
                repo,
            })
            .collect()
    })
    .await
    .map_err(|error| TimetrackError::Rejected(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn checkout(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("timetrack-manifests-{name}"));

        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join(".git")).unwrap();

        root
    }

    fn write(root: &Path, relative: &str, text: &str) {
        let path = root.join(relative);

        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, text).unwrap();
    }

    fn paths(root: &Path) -> Vec<String> {
        manifests_of(root).into_iter().map(|file| file.path).collect()
    }

    #[test]
    fn reads_the_root_and_workspace_manifests() {
        let root = checkout("workspace");

        write(&root, "package.json", r#"{"name":"@a/source"}"#);
        write(&root, "tsconfig.base.json", "{}");
        write(&root, "libs/core/package.json", r#"{"name":"@a/core"}"#);
        write(&root, "libs/core/tsconfig.json", "{}");

        assert_eq!(
            paths(&root),
            vec!["tsconfig.base.json", "package.json", "libs/core/package.json"]
        );
        assert_eq!(manifests_of(&root)[1].text, r#"{"name":"@a/source"}"#);
    }

    #[test]
    fn skips_installed_built_and_hidden_directories() {
        let root = checkout("skipped");

        write(&root, "node_modules/x/package.json", "{}");
        write(&root, "dist/libs/core/package.json", "{}");
        write(&root, ".nx/cache/package.json", "{}");
        write(&root, "apps/web/package.json", "{}");

        assert_eq!(paths(&root), vec!["apps/web/package.json"]);
    }

    #[test]
    fn stops_at_the_depth_limit() {
        let root = checkout("deep");

        write(&root, "a/b/c/package.json", "{}");
        write(&root, "a/b/c/d/package.json", "{}");

        assert_eq!(paths(&root), vec!["a/b/c/package.json"]);
    }

    #[test]
    fn reads_nothing_outside_a_checkout() {
        let root = checkout("not-a-checkout");

        write(&root, "package.json", "{}");
        std::fs::remove_dir_all(root.join(".git")).unwrap();

        assert!(paths(&root).is_empty());
    }

    #[test]
    fn refuses_a_file_past_the_cap() {
        let root = checkout("large");

        write(&root, "package.json", &" ".repeat(MAX_BYTES as usize + 1));

        assert!(paths(&root).is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn follows_no_symlink_out_of_the_checkout() {
        let root = checkout("symlink");
        let outside = checkout("symlink-target");

        write(&outside, "package.json", r#"{"name":"secret"}"#);
        std::os::unix::fs::symlink(outside.join("package.json"), root.join("package.json")).unwrap();
        std::os::unix::fs::symlink(&outside, root.join("linked")).unwrap();

        assert!(paths(&root).is_empty());
    }
}
