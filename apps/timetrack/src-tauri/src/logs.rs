use crate::error::{TimetrackError, TimetrackResult};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAX_LINES: usize = 20_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLogRef {
    pub id: String,
    pub path: String,
    pub modified_at_ms: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLogLines {
    pub lines: Vec<String>,
    pub next_line: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLogLinesRequest {
    pub path: String,
    pub from_line: i64,
    pub root: Option<String>,
}

struct Read {
    lines: Vec<String>,
    next_line: usize,
    complete: usize,
}

fn agent_log_root(app: &tauri::AppHandle, root: Option<String>) -> TimetrackResult<PathBuf> {
    match root {
        Some(root) => Ok(PathBuf::from(root)),
        None => Ok(app.path().home_dir()?.join(".claude").join("projects")),
    }
}

fn modified_at_ms(path: &Path) -> TimetrackResult<i64> {
    let modified = path.metadata()?.modified()?;

    Ok(modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis() as i64)
        .unwrap_or(0))
}

fn list_logs(root: &Path, modified_after_ms: Option<i64>) -> TimetrackResult<Vec<AgentLogRef>> {
    let Ok(projects) = std::fs::read_dir(root) else {
        return Ok(Vec::new());
    };

    let mut refs = Vec::new();

    for project in projects.filter_map(Result::ok) {
        let Ok(logs) = std::fs::read_dir(project.path()) else {
            continue;
        };

        for log in logs.filter_map(Result::ok) {
            let path = log.path();

            if path.extension().is_none_or(|extension| extension != "jsonl") {
                continue;
            }

            let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) else {
                continue;
            };
            let at_ms = modified_at_ms(&path)?;

            if modified_after_ms.is_some_and(|after| at_ms <= after) {
                continue;
            }

            refs.push(AgentLogRef {
                id: id.to_owned(),
                path: path.to_string_lossy().into_owned(),
                modified_at_ms: at_ms,
            });
        }
    }

    refs.sort_by_key(|log| log.modified_at_ms);

    Ok(refs)
}

fn read_from(path: &Path, from_line: usize) -> TimetrackResult<Read> {
    let mut reader = BufReader::new(File::open(path)?);
    let mut lines = Vec::new();
    let mut next_line = from_line;
    let mut complete = 0usize;
    let mut buffer = String::new();

    loop {
        buffer.clear();

        // A line with no terminating newline is one the agent is still writing. Consuming it as
        // complete loses it for good, because the cursor would move past a fragment of JSON.
        if reader.read_line(&mut buffer)? == 0 || !buffer.ends_with('\n') {
            break;
        }

        if complete >= from_line {
            lines.push(buffer.trim_end_matches(['\n', '\r']).to_owned());
            next_line = complete + 1;
        }

        complete += 1;

        if lines.len() >= MAX_LINES {
            break;
        }
    }

    Ok(Read {
        lines,
        next_line,
        complete,
    })
}

/// The lines of one session log from `from_line` on, never including a half-written trailing line.
///
/// A log holding fewer complete lines than the cursor claims has been replaced rather than appended
/// to, so it is re-read from the top: the cursor's instant is what stops the samples already seen
/// from being appended twice, and leaving the offset past the end would strand the log for good.
fn read_lines(path: &Path, from_line: usize) -> TimetrackResult<AgentLogLines> {
    let mut read = read_from(path, from_line)?;

    if read.lines.is_empty() && read.complete < from_line {
        read = read_from(path, 0)?;
    }

    Ok(AgentLogLines {
        lines: read.lines,
        next_line: read.next_line as i64,
    })
}

#[tauri::command]
pub async fn agent_logs(
    app: tauri::AppHandle,
    root: Option<String>,
    modified_after_ms: Option<i64>,
) -> TimetrackResult<Vec<AgentLogRef>> {
    let root = agent_log_root(&app, root)?;

    tauri::async_runtime::spawn_blocking(move || list_logs(&root, modified_after_ms))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

/// Reads one log the webview previously listed.
///
/// `path` is confined to the log root: it arrives from the webview, and an unconfined path would let
/// anything reaching that code read any file the user can, which is the same reason `run_process`
/// takes an allowlist.
#[tauri::command]
pub async fn agent_log_lines(
    app: tauri::AppHandle,
    request: AgentLogLinesRequest,
) -> TimetrackResult<AgentLogLines> {
    let root = agent_log_root(&app, request.root)?;
    let path = PathBuf::from(&request.path);
    let (root, resolved) = (root.canonicalize()?, path.canonicalize()?);

    if !resolved.starts_with(&root) {
        return Err(TimetrackError::Rejected(format!(
            "{} is outside the agent log directory",
            request.path
        )));
    }

    let from_line = request.from_line.max(0) as usize;

    tauri::async_runtime::spawn_blocking(move || read_lines(&resolved, from_line))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("timetrack-logs-{name}"));

        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();

        root
    }

    fn write_log(root: &Path, project: &str, id: &str, contents: &str) -> PathBuf {
        let dir = root.join(project);
        let path = dir.join(format!("{id}.jsonl"));

        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(&path, contents).unwrap();

        path
    }

    #[test]
    fn lists_one_ref_per_jsonl_log_keyed_by_session_id() {
        let root = temp_root("listing");

        write_log(&root, "-home-tom-dev-a", "session-one", "{}\n");
        write_log(&root, "-home-tom-dev-b", "session-two", "{}\n");
        std::fs::write(root.join("-home-tom-dev-a").join("notes.txt"), "not a log").unwrap();

        let mut ids = list_logs(&root, None).unwrap().into_iter().map(|log| log.id).collect::<Vec<_>>();
        ids.sort();

        assert_eq!(ids, ["session-one", "session-two"]);
    }

    #[test]
    fn lists_nothing_when_the_agent_was_never_installed() {
        let root = temp_root("absent").join("never-created");

        assert!(list_logs(&root, None).unwrap().is_empty());
    }

    #[test]
    fn skips_a_log_untouched_since_the_last_run() {
        let root = temp_root("mtime");
        write_log(&root, "-home-tom-dev-a", "session-one", "{}\n");

        let future = modified_at_ms(&root.join("-home-tom-dev-a").join("session-one.jsonl")).unwrap() + 1;

        assert!(list_logs(&root, Some(future)).unwrap().is_empty());
        assert_eq!(list_logs(&root, Some(0)).unwrap().len(), 1);
    }

    #[test]
    fn withholds_a_line_the_agent_has_not_finished_writing() {
        let root = temp_root("partial");
        let path = write_log(&root, "-home-tom-dev-a", "session-one", "{\"a\":1}\n{\"b\":2}\n{\"half\":");

        let read = read_lines(&path, 0).unwrap();

        assert_eq!(read.lines, ["{\"a\":1}", "{\"b\":2}"]);
        assert_eq!(read.next_line, 2);
    }

    #[test]
    fn resumes_from_the_cursor_and_strips_crlf() {
        let root = temp_root("resume");
        let path = write_log(&root, "-home-tom-dev-a", "session-one", "a\r\nb\r\nc\r\n");

        let read = read_lines(&path, 2).unwrap();

        assert_eq!(read.lines, ["c"]);
        assert_eq!(read.next_line, 3);
    }

    #[test]
    fn holds_the_cursor_where_it_was_when_nothing_was_appended() {
        let root = temp_root("caught-up");
        let path = write_log(&root, "-home-tom-dev-a", "session-one", "a\nb\nc\n");

        let read = read_lines(&path, 3).unwrap();

        assert!(read.lines.is_empty());
        assert_eq!(read.next_line, 3);
    }

    #[test]
    fn rereads_a_log_that_lost_the_lines_the_cursor_counted() {
        let root = temp_root("truncated");
        let path = write_log(&root, "-home-tom-dev-a", "session-one", "a\nb\n");

        let read = read_lines(&path, 5).unwrap();

        assert_eq!(read.lines, ["a", "b"]);
        assert_eq!(read.next_line, 2);
    }

    #[test]
    fn reads_the_real_claude_code_logs_on_this_machine() {
        let Some(home) = std::env::var_os("HOME") else { return };
        let root = PathBuf::from(home).join(".claude").join("projects");

        if !root.is_dir() {
            return;
        }

        let logs = list_logs(&root, None).unwrap();
        assert!(!logs.is_empty(), "{} holds no logs", root.display());

        let newest = logs.last().unwrap();
        let read = read_lines(Path::new(&newest.path), 0).unwrap();

        assert_eq!(read.lines.len() as i64, read.next_line);
        for line in read.lines.iter().take(50) {
            assert!(serde_json::from_str::<serde_json::Value>(line).is_ok(), "not JSON: {line}");
        }
    }
}
