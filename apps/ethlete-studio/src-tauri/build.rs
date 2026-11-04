fn main() {
    // tauri-build fails on a resource that is not there, and the workspace builds the design
    // runtime, not cargo. An empty directory is skipped instead, so a bare `cargo build` still runs.
    std::fs::create_dir_all("../../../dist/apps/ethlete-studio/cli-runtime").expect("the design runtime folder");

    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "design_action_refused",
            "design_project",
            "design_roots",
            "design_roots_add",
            "design_roots_forget",
            "design_roots_search",
            "design_scan",
            "design_status_watch",
            "design_server_start",
            "design_server_restart",
            "design_server_state",
            "design_server_stop",
            "studio_code_state",
            "studio_quit_for_rebuild",
            "update_ready",
            "update_restart",
            "window_chrome_watch",
            "workspace_check",
            "workspace_diff",
            "workspace_root",
            "workspace_status",
        ])),
    )
    .expect("tauri-build failed");
}
