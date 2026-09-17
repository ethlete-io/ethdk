fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "agent_cancel",
            "agent_list",
            "agent_run",
            "workspace_check",
            "workspace_diff",
            "workspace_root",
            "workspace_status",
        ])),
    )
    .expect("tauri-build failed");
}
