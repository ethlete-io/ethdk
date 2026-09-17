fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "agent_cancel",
            "agent_list",
            "agent_run",
            "design_project",
            "design_set_verdict",
            "design_server_start",
            "design_server_state",
            "design_server_stop",
            "workspace_check",
            "workspace_diff",
            "workspace_root",
            "workspace_status",
        ])),
    )
    .expect("tauri-build failed");
}
