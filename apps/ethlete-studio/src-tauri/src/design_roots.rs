use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::design::DESIGN_DIR;
use crate::error::{StudioError, StudioResult};

const STORE_FILE: &str = "design-roots.json";

/// How far below the search folder a scan looks. A checkout sits in the folder itself or one
/// organisation folder below it, so a third level would only cost time.
const SCAN_DEPTH: usize = 2;

/// What Studio knows about the checkouts that hold design work.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DesignRoots {
    /// The folder a scan walks. Empty until the user names one.
    pub search: String,
    /// Every checkout the user keeps, in alphabetical order.
    pub roots: Vec<String>,
}

fn holds_design(checkout: &Path) -> bool {
    checkout.join(DESIGN_DIR).join("config.json").is_file()
}

fn tidy(path: &str) -> String {
    let trimmed = path.trim().trim_end_matches('/');

    if trimmed.is_empty() {
        String::new()
    } else {
        trimmed.to_owned()
    }
}

fn read(store: &Path) -> DesignRoots {
    fs::read_to_string(store)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write(store: &Path, held: &DesignRoots) -> StudioResult<DesignRoots> {
    if let Some(parent) = store.parent() {
        fs::create_dir_all(parent)?;
    }

    let text = serde_json::to_string_pretty(held).map_err(|error| StudioError::Rejected(error.to_string()))?;

    fs::write(store, format!("{text}\n"))?;

    Ok(held.clone())
}

fn add(store: &Path, checkout: &str) -> StudioResult<DesignRoots> {
    let kept = tidy(checkout);

    if !holds_design(Path::new(&kept)) {
        return Err(StudioError::Rejected(format!(
            "{kept} holds no {DESIGN_DIR}/config.json, so it carries no design work."
        )));
    }

    let mut held = read(store);

    if !held.roots.contains(&kept) {
        held.roots.push(kept);
        held.roots.sort();
    }

    write(store, &held)
}

fn forget(store: &Path, checkout: &str) -> StudioResult<DesignRoots> {
    let dropped = tidy(checkout);
    let mut held = read(store);

    held.roots.retain(|root| root != &dropped);

    write(store, &held)
}

fn set_search(store: &Path, folder: &str) -> StudioResult<DesignRoots> {
    let named = tidy(folder);

    if !named.is_empty() && !Path::new(&named).is_dir() {
        return Err(StudioError::Rejected(format!("{named} is not a directory.")));
    }

    let mut held = read(store);

    held.search = named;

    write(store, &held)
}

fn walk(folder: &Path, depth: usize, found: &mut Vec<String>) {
    if holds_design(folder) {
        found.push(folder.to_string_lossy().into_owned());

        return;
    }

    if depth == 0 {
        return;
    }

    let Ok(entries) = fs::read_dir(folder) else {
        return;
    };

    let mut children: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .filter(|path| {
            path.file_name()
                .map(|name| !name.to_string_lossy().starts_with('.'))
                .unwrap_or(false)
        })
        .collect();

    children.sort();

    for child in children {
        walk(&child, depth - 1, found);
    }
}

fn scan(folder: &str) -> StudioResult<Vec<String>> {
    let named = tidy(folder);

    if named.is_empty() || !Path::new(&named).is_dir() {
        return Err(StudioError::Rejected(format!("{named} is not a directory.")));
    }

    let mut found = Vec::new();

    walk(Path::new(&named), SCAN_DEPTH, &mut found);

    Ok(found)
}

fn store_path(app: &tauri::AppHandle) -> StudioResult<PathBuf> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(STORE_FILE))
        .map_err(|error| StudioError::Rejected(format!("Studio has no config directory: {error}")))
}

#[tauri::command]
pub fn design_roots(app: tauri::AppHandle) -> StudioResult<DesignRoots> {
    Ok(read(&store_path(&app)?))
}

/// Keeps a checkout that carries design work. A checkout without a config is refused.
#[tauri::command]
pub fn design_roots_add(app: tauri::AppHandle, checkout: String) -> StudioResult<DesignRoots> {
    add(&store_path(&app)?, &checkout)
}

#[tauri::command]
pub fn design_roots_forget(app: tauri::AppHandle, checkout: String) -> StudioResult<DesignRoots> {
    forget(&store_path(&app)?, &checkout)
}

/// Names the folder a scan walks. An empty name drops it again.
#[tauri::command]
pub fn design_roots_search(app: tauri::AppHandle, folder: String) -> StudioResult<DesignRoots> {
    set_search(&store_path(&app)?, &folder)
}

/// Reports every checkout under the folder that carries design work, kept or not.
#[tauri::command]
pub fn design_scan(folder: String) -> StudioResult<Vec<String>> {
    scan(&folder)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn a_ground(name: &str) -> PathBuf {
        let ground = std::env::temp_dir().join(format!("ethlete-studio-roots-{}-{name}", std::process::id()));

        let _ = fs::remove_dir_all(&ground);
        fs::create_dir_all(&ground).expect("a temporary ground");

        ground
    }

    fn a_checkout(ground: &Path, path: &str) -> String {
        let checkout = ground.join(path);

        fs::create_dir_all(checkout.join(DESIGN_DIR)).expect("a design directory");
        fs::write(checkout.join(DESIGN_DIR).join("config.json"), r#"{ "port": 4402 }"#).expect("a config");

        checkout.to_string_lossy().into_owned()
    }

    #[test]
    fn a_store_nobody_wrote_reads_as_empty() {
        let ground = a_ground("empty");
        let held = read(&ground.join(STORE_FILE));

        assert_eq!(held, DesignRoots::default());

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn a_kept_checkout_survives_a_read() {
        let ground = a_ground("keep");
        let store = ground.join("config").join(STORE_FILE);
        let checkout = a_checkout(&ground, "sdk");

        let held = add(&store, &checkout).expect("the checkout is kept");

        assert_eq!(held.roots, vec![checkout.clone()]);
        assert_eq!(read(&store), held);

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn keeping_the_same_checkout_twice_holds_it_once() {
        let ground = a_ground("twice");
        let store = ground.join(STORE_FILE);
        let checkout = a_checkout(&ground, "sdk");

        add(&store, &checkout).expect("the checkout is kept");

        let held = add(&store, &format!("{checkout}/")).expect("the checkout is kept again");

        assert_eq!(held.roots, vec![checkout]);

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn a_checkout_without_design_work_is_refused() {
        let ground = a_ground("bare");
        let store = ground.join(STORE_FILE);

        assert!(add(&store, &ground.to_string_lossy()).is_err());
        assert!(read(&store).roots.is_empty());

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn a_forgotten_checkout_leaves_the_others_alone() {
        let ground = a_ground("forget");
        let store = ground.join(STORE_FILE);
        let one = a_checkout(&ground, "one");
        let two = a_checkout(&ground, "two");

        add(&store, &one).expect("the first checkout is kept");
        add(&store, &two).expect("the second checkout is kept");

        let held = forget(&store, &one).expect("the first checkout is forgotten");

        assert_eq!(held.roots, vec![two]);

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn the_search_folder_must_be_a_directory() {
        let ground = a_ground("search");
        let store = ground.join(STORE_FILE);

        let held = set_search(&store, &ground.to_string_lossy()).expect("the folder is named");

        assert_eq!(held.search, ground.to_string_lossy());
        assert!(set_search(&store, &ground.join("nowhere").to_string_lossy()).is_err());
        assert_eq!(read(&store).search, ground.to_string_lossy());

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn a_scan_finds_a_checkout_in_the_folder_and_one_below_it() {
        let ground = a_ground("scan");
        let near = a_checkout(&ground, "sdk");
        let deep = a_checkout(&ground, "fifagg/fifagg-frontend");

        fs::create_dir_all(ground.join("plain/src")).expect("a directory without design work");

        let found = scan(&ground.to_string_lossy()).expect("a scan");

        assert_eq!(found, vec![deep, near]);

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn a_scan_does_not_look_inside_a_checkout_it_found() {
        let ground = a_ground("nested");
        let outer = a_checkout(&ground, "sdk");

        a_checkout(&ground, "sdk/inner");

        let found = scan(&ground.to_string_lossy()).expect("a scan");

        assert_eq!(found, vec![outer]);

        fs::remove_dir_all(ground).expect("a clean ground");
    }

    #[test]
    fn a_folder_that_is_not_a_directory_is_refused() {
        let ground = a_ground("missing");

        assert!(scan(&ground.join("nowhere").to_string_lossy()).is_err());
        assert!(scan("").is_err());

        fs::remove_dir_all(ground).expect("a clean ground");
    }
}
