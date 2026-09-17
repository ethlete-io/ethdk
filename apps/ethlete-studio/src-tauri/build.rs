fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "workspace_check",
            "workspace_diff",
            "workspace_status",
        ])),
    )
    .expect("tauri-build failed");
}
