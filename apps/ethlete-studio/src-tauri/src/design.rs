pub use ethlete_studio_design::design::{port_of, project, read_config, Project, DESIGN_DIR};

#[tauri::command]
pub async fn design_project(checkout: String) -> Result<Project, String> {
    tauri::async_runtime::spawn_blocking(move || project(&checkout))
        .await
        .map_err(|error| error.to_string())?
}
