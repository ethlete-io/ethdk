fn main() {
    // tauri-build fails on a resource that is not there, and the workspace builds the design
    // runtime, not cargo. An empty directory is skipped instead, so a bare `cargo build` still runs.
    std::fs::create_dir_all("../../../dist/apps/ethlete-studio/cli-runtime").expect("the design runtime folder");

    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "agent_cancel",
            "agent_list",
            "agent_run",
            "design_project",
            "design_set_verdict",
            "design_set_mode",
            "design_add_variants",
            "design_roots",
            "design_roots_add",
            "design_roots_forget",
            "design_roots_search",
            "design_scan",
            "design_watch",
            "design_server_start",
            "design_server_state",
            "design_server_stop",
            "design_check",
            "workspace_check",
            "workspace_diff",
            "workspace_root",
            "workspace_status",
        ])),
    )
    .expect("tauri-build failed");
}
