use crate::error::{TimetrackError, TimetrackResult};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::{Path, PathBuf};

pub struct Model {
    pub name: &'static str,
    sha256: &'static str,
}

pub const DEFAULT: Model = Model {
    name: "large-v3-turbo-q8_0",
    sha256: "317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1",
};

pub fn path(data_dir: &Path, model: &Model) -> PathBuf {
    data_dir.join("whisper").join(format!("ggml-{}.bin", model.name))
}

fn url(model: &Model) -> String {
    format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{}.bin",
        model.name
    )
}

pub async fn ensure(data_dir: &Path, model: &Model) -> TimetrackResult<PathBuf> {
    let target = path(data_dir, model);

    if target.exists() {
        return Ok(target);
    }

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let partial = target.with_extension("part");
    let mut response = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()?
        .get(url(model))
        .send()
        .await?
        .error_for_status()?;
    let mut file = std::fs::File::create(&partial)?;
    let mut hash = Sha256::new();

    while let Some(bytes) = response.chunk().await? {
        hash.update(&bytes);
        file.write_all(&bytes)?;
    }

    file.sync_all()?;

    let digest = hash
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();

    if digest != model.sha256 {
        let _ = std::fs::remove_file(&partial);

        return Err(TimetrackError::Rejected(format!(
            "the downloaded {} model does not match its pinned hash",
            model.name
        )));
    }

    std::fs::rename(&partial, &target)?;

    Ok(target)
}
