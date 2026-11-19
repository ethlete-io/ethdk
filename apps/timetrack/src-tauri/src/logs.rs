use crate::error::{TimetrackError, TimetrackResult};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use tauri::Manager;

const MAX_LINES: usize = 20_000;

/// How far below its root a log tree is walked. Codex files a log under `<yyyy>/<mm>/<dd>/`, and the
/// cap is what stops a mistyped root from walking a whole home directory.
const MAX_LOG_TREE_DEPTH: usize = 4;

/// Which agent's logs to list, which decides both the default root and the shape of the tree.
#[derive(Deserialize, Default, Clone, Copy, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum AgentLogProvider {
    #[default]
    ClaudeCode,
    Codex,
}

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
    #[serde(default)]
    pub provider: AgentLogProvider,
}

struct Read {
    lines: Vec<String>,
    next_line: usize,
    complete: usize,
}

/// The `projects` directory of every Claude Code config dir: each `~/.claude*` and the one
/// `CLAUDE_CONFIG_DIR` names, `~/.claude` first and each directory once.
fn claude_log_roots(home: &Path, config_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut in_home = std::fs::read_dir(home)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(|name| name.starts_with(".claude"))
        })
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    in_home.sort();
    in_home.sort_by_key(|dir| dir.file_name().is_none_or(|name| name != ".claude"));

    let mut seen = Vec::new();
    let mut roots = Vec::new();

    for root in in_home
        .into_iter()
        .chain(config_dir.map(Path::to_path_buf))
        .map(|dir| dir.join("projects"))
    {
        let Ok(canonical) = root.canonicalize() else {
            continue;
        };

        if canonical.is_dir() && !seen.contains(&canonical) {
            seen.push(canonical);
            roots.push(root);
        }
    }

    roots
}

/// Where this provider files its session logs.
///
/// The roots are resolved here and never taken from the caller. A caller that names its own root
/// names the confinement the read is then checked against, so `/` would read any file on the machine
/// — and that is what this command is confined for.
fn agent_log_roots(app: &tauri::AppHandle, provider: AgentLogProvider) -> TimetrackResult<Vec<PathBuf>> {
    let home = app.path().home_dir()?;

    Ok(match provider {
        AgentLogProvider::ClaudeCode => claude_log_roots(
            &home,
            std::env::var_os("CLAUDE_CONFIG_DIR").map(PathBuf::from).as_deref(),
        ),
        AgentLogProvider::Codex => vec![home.join(".codex").join("sessions")],
    })
}

fn is_log_inside(roots: &[PathBuf], resolved: &Path) -> bool {
    resolved.extension().is_some_and(|extension| extension == "jsonl")
        && roots
            .iter()
            .filter_map(|root| root.canonicalize().ok())
            .any(|root| resolved.starts_with(root))
}

fn modified_at_ms(path: &Path) -> TimetrackResult<i64> {
    let modified = path.metadata()?.modified()?;

    Ok(modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis() as i64)
        .unwrap_or(0))
}

fn push_logs_in(
    dir: &Path,
    id_prefix: &str,
    modified_after_ms: Option<i64>,
    refs: &mut Vec<AgentLogRef>,
) -> TimetrackResult<()> {
    let Ok(logs) = std::fs::read_dir(dir) else {
        return Ok(());
    };

    for log in logs.filter_map(Result::ok) {
        let path = log.path();

        if path.extension().is_none_or(|extension| extension != "jsonl") {
            continue;
        }

        let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        let Ok(at_ms) = modified_at_ms(&path) else {
            continue;
        };

        if modified_after_ms.is_some_and(|after| at_ms <= after) {
            continue;
        }

        refs.push(AgentLogRef {
            id: format!("{id_prefix}{stem}"),
            path: path.to_string_lossy().into_owned(),
            modified_at_ms: at_ms,
        });
    }

    Ok(())
}

/// Every session log the agent wrote: one per session, plus the ones its subagents wrote under
/// `<project>/<sessionId>/subagents/`.
///
/// A subagent log's file name names the agent rather than the run, so it repeats across sessions.
/// Its `id` therefore carries the session directory: keyed by the file name alone, several logs
/// would share one cursor and each read would move it past the lines of the others.
fn list_logs(root: &Path, modified_after_ms: Option<i64>) -> TimetrackResult<Vec<AgentLogRef>> {
    let Ok(projects) = std::fs::read_dir(root) else {
        return Ok(Vec::new());
    };

    let mut refs = Vec::new();

    for project in projects.filter_map(Result::ok) {
        push_logs_in(&project.path(), "", modified_after_ms, &mut refs)?;

        let Ok(sessions) = std::fs::read_dir(project.path()) else {
            continue;
        };

        for session in sessions.filter_map(Result::ok) {
            let subagents = session.path().join("subagents");

            if !subagents.is_dir() {
                continue;
            }

            let name = session.file_name();
            let Some(id) = name.to_str() else {
                continue;
            };

            push_logs_in(&subagents, &format!("{id}/"), modified_after_ms, &mut refs)?;
        }
    }

    refs.sort_by_key(|log| log.modified_at_ms);

    Ok(refs)
}

/// The logs of every config dir. A session id names one session wherever its log lies, so a log
/// found in two dirs is a copy and only the most recently written one is listed: two refs with one
/// id would share a cursor and count the session twice.
fn list_claude_logs(roots: &[PathBuf], modified_after_ms: Option<i64>) -> TimetrackResult<Vec<AgentLogRef>> {
    let mut newest = std::collections::HashMap::<String, AgentLogRef>::new();

    for root in roots {
        for log in list_logs(root, modified_after_ms)? {
            if newest
                .get(&log.id)
                .is_none_or(|kept| kept.modified_at_ms < log.modified_at_ms)
            {
                newest.insert(log.id.clone(), log);
            }
        }
    }

    let mut refs = newest.into_values().collect::<Vec<_>>();
    refs.sort_by_key(|log| log.modified_at_ms);

    Ok(refs)
}

/// Every log in a tree filed by date, keyed by its path below the root.
///
/// Codex writes `<yyyy>/<mm>/<dd>/rollout-<iso>-<id>.jsonl`, and the walk is generic so a change of
/// depth in that layout needs no change here. The relative path is the `id` because a rollout's file
/// name already names its session; the directories keep two trees apart if Codex ever repeats one.
fn push_logs_below(
    dir: &Path,
    id_prefix: &str,
    modified_after_ms: Option<i64>,
    depth: usize,
    refs: &mut Vec<AgentLogRef>,
) -> TimetrackResult<()> {
    push_logs_in(dir, id_prefix, modified_after_ms, refs)?;

    if depth == 0 {
        return Ok(());
    }

    let Ok(entries) = std::fs::read_dir(dir) else {
        return Ok(());
    };

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };

        push_logs_below(
            &path,
            &format!("{id_prefix}{name}/"),
            modified_after_ms,
            depth - 1,
            refs,
        )?;
    }

    Ok(())
}

fn list_codex_logs(root: &Path, modified_after_ms: Option<i64>) -> TimetrackResult<Vec<AgentLogRef>> {
    let mut refs = Vec::new();

    push_logs_below(root, "", modified_after_ms, MAX_LOG_TREE_DEPTH, &mut refs)?;
    refs.sort_by_key(|log| log.modified_at_ms);

    Ok(refs)
}

fn read_from(path: &Path, from_line: usize) -> TimetrackResult<Read> {
    let mut reader = BufReader::new(File::open(path)?);
    let mut lines = Vec::new();
    let mut next_line = from_line;
    let mut complete = 0usize;
    let mut buffer = Vec::new();

    loop {
        buffer.clear();

        // A line with no terminating newline is one the agent is still writing. Consuming it as
        // complete loses it for good, because the cursor would move past a fragment of JSON.
        if reader.read_until(b'\n', &mut buffer)? == 0 || !buffer.ends_with(b"\n") {
            break;
        }

        if complete >= from_line {
            lines.push(
                String::from_utf8_lossy(&buffer)
                    .trim_end_matches(['\n', '\r'])
                    .to_owned(),
            );
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
    modified_after_ms: Option<i64>,
    provider: Option<AgentLogProvider>,
) -> TimetrackResult<Vec<AgentLogRef>> {
    let provider = provider.unwrap_or_default();
    let roots = agent_log_roots(&app, provider)?;

    tauri::async_runtime::spawn_blocking(move || match provider {
        AgentLogProvider::ClaudeCode => list_claude_logs(&roots, modified_after_ms),
        AgentLogProvider::Codex => list_codex_logs(&roots[0], modified_after_ms),
    })
    .await
    .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

/// Reads one log the webview previously listed.
///
/// `path` is confined to the log root this host resolves, and has to be a `.jsonl` session log: it
/// arrives from the webview, and an unconfined path would let anything reaching that code read any
/// file the user can, which is the same reason `run_process` takes an allowlist.
#[tauri::command]
pub async fn agent_log_lines(app: tauri::AppHandle, request: AgentLogLinesRequest) -> TimetrackResult<AgentLogLines> {
    let roots = agent_log_roots(&app, request.provider)?;
    let resolved = PathBuf::from(&request.path).canonicalize()?;

    // The canonical path is compared, so a symlink inside a root that points outside it is refused
    // by where it resolves to rather than by where it sits.
    if !is_log_inside(&roots, &resolved) {
        return Err(TimetrackError::Rejected(format!(
            "{} is not a session log inside the agent log directory",
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

    fn write_subagent_log(root: &Path, project: &str, session: &str, id: &str, contents: &str) -> PathBuf {
        write_log(root, &format!("{project}/{session}/subagents"), id, contents)
    }

    fn real_log_root() -> Option<PathBuf> {
        let root = PathBuf::from(std::env::var_os("HOME")?)
            .join(".claude")
            .join("projects");

        root.is_dir().then_some(root)
    }

    fn real_codex_root() -> Option<PathBuf> {
        let root = PathBuf::from(std::env::var_os("HOME")?).join(".codex").join("sessions");

        root.is_dir().then_some(root)
    }

    #[test]
    fn lists_one_ref_per_jsonl_log_keyed_by_session_id() {
        let root = temp_root("listing");

        write_log(&root, "-home-tom-dev-a", "session-one", "{}\n");
        write_log(&root, "-home-tom-dev-b", "session-two", "{}\n");
        std::fs::write(root.join("-home-tom-dev-a").join("notes.txt"), "not a log").unwrap();

        let mut ids = list_logs(&root, None)
            .unwrap()
            .into_iter()
            .map(|log| log.id)
            .collect::<Vec<_>>();
        ids.sort();

        assert_eq!(ids, ["session-one", "session-two"]);
    }

    #[test]
    fn lists_a_subagent_log_beside_the_session_that_ran_it() {
        let root = temp_root("subagents");

        write_log(&root, "-home-tom-dev-a", "session-one", "{}\n");
        write_subagent_log(&root, "-home-tom-dev-a", "session-one", "agent-a1", "{}\n");

        let mut ids = list_logs(&root, None)
            .unwrap()
            .into_iter()
            .map(|log| log.id)
            .collect::<Vec<_>>();
        ids.sort();

        assert_eq!(ids, ["session-one", "session-one/agent-a1"]);
    }

    #[cfg(unix)]
    #[test]
    fn lists_the_other_logs_when_one_is_a_dangling_link() {
        let root = temp_root("dangling");

        write_log(&root, "-home-tom-dev-a", "session-one", "{}\n");
        std::os::unix::fs::symlink(
            root.join("gone"),
            root.join("-home-tom-dev-a").join("session-two.jsonl"),
        )
        .unwrap();

        let ids = list_logs(&root, None)
            .unwrap()
            .into_iter()
            .map(|log| log.id)
            .collect::<Vec<_>>();

        assert_eq!(ids, ["session-one"]);
    }

    #[test]
    fn keeps_two_subagent_logs_of_the_same_name_apart() {
        let root = temp_root("subagent-name-repeats");

        write_subagent_log(&root, "-home-tom-dev-a", "session-one", "agent-a1", "a\n");
        write_subagent_log(&root, "-home-tom-dev-a", "session-two", "agent-a1", "b\n");

        let mut ids = list_logs(&root, None)
            .unwrap()
            .into_iter()
            .map(|log| log.id)
            .collect::<Vec<_>>();
        ids.sort();

        assert_eq!(ids, ["session-one/agent-a1", "session-two/agent-a1"]);
    }

    #[test]
    fn lists_a_codex_log_filed_by_date_keyed_by_its_path_below_the_root() {
        let root = temp_root("codex-listing");

        write_log(&root, "2026/08/18", "rollout-2026-08-18T23-00-31-one", "{}\n");
        write_log(&root, "2026/08/19", "rollout-2026-08-19T09-47-35-two", "{}\n");

        let mut ids = list_codex_logs(&root, None)
            .unwrap()
            .into_iter()
            .map(|log| log.id)
            .collect::<Vec<_>>();
        ids.sort();

        assert_eq!(
            ids,
            [
                "2026/08/18/rollout-2026-08-18T23-00-31-one",
                "2026/08/19/rollout-2026-08-19T09-47-35-two"
            ]
        );
    }

    #[test]
    fn stops_walking_a_codex_root_at_the_depth_cap() {
        let root = temp_root("codex-depth");

        write_log(&root, "a/b/c/d/e", "too-deep", "{}\n");

        assert!(list_codex_logs(&root, None).unwrap().is_empty());
    }

    #[test]
    fn reads_the_real_codex_logs_on_this_machine() {
        let Some(root) = real_codex_root() else { return };

        let logs = list_codex_logs(&root, None).unwrap();
        assert!(!logs.is_empty(), "{} holds no logs", root.display());

        let newest = logs.last().unwrap();
        let read = read_lines(Path::new(&newest.path), 0).unwrap();

        assert!(newest.id.contains('/'), "a codex id names its date: {}", newest.id);
        for line in read.lines.iter().take(50) {
            assert!(
                serde_json::from_str::<serde_json::Value>(line).is_ok(),
                "not JSON: {line}"
            );
        }
    }

    #[test]
    fn finds_the_projects_of_every_claude_config_dir_in_home_and_the_configured_one() {
        let home = temp_root("config-dirs");
        let elsewhere = temp_root("config-dirs-elsewhere");

        std::fs::create_dir_all(home.join(".claude").join("projects")).unwrap();
        std::fs::create_dir_all(home.join(".claude-second").join("projects")).unwrap();
        std::fs::create_dir_all(home.join(".claude-empty")).unwrap();
        std::fs::create_dir_all(home.join(".codex").join("projects")).unwrap();
        std::fs::write(home.join(".claude.json"), "{}").unwrap();
        std::fs::create_dir_all(elsewhere.join("projects")).unwrap();

        let roots = claude_log_roots(&home, Some(&elsewhere));

        assert_eq!(
            roots,
            [
                home.join(".claude").join("projects"),
                home.join(".claude-second").join("projects"),
                elsewhere.join("projects"),
            ]
        );
        assert_eq!(claude_log_roots(&home, Some(&home.join(".claude-second"))).len(), 2);
    }

    #[test]
    fn lists_the_logs_of_every_config_dir_and_a_copied_log_once() {
        let home = temp_root("config-dir-logs");
        let first = home.join(".claude").join("projects");
        let second = home.join(".claude-second").join("projects");

        write_log(&first, "-home-tom-dev-a", "session-one", "{}\n");
        write_log(&second, "-home-tom-dev-a", "session-two", "{}\n");
        write_subagent_log(&second, "-home-tom-dev-a", "session-two", "agent-a1", "{}\n");
        write_log(&first, "-home-tom-dev-b", "session-copied", "{}\n");
        let newer = write_log(&second, "-home-tom-dev-b", "session-copied", "{}\n{}\n");
        std::fs::File::options()
            .append(true)
            .open(&newer)
            .unwrap()
            .set_modified(std::time::SystemTime::now() + std::time::Duration::from_secs(60))
            .unwrap();

        let logs = list_claude_logs(&[first, second], None).unwrap();
        let mut ids = logs.iter().map(|log| log.id.as_str()).collect::<Vec<_>>();
        ids.sort();

        assert_eq!(
            ids,
            ["session-copied", "session-one", "session-two", "session-two/agent-a1"]
        );
        assert_eq!(
            logs.iter().find(|log| log.id == "session-copied").unwrap().path,
            newer.to_string_lossy()
        );
    }

    #[test]
    fn confines_a_read_to_the_config_dirs_it_lists() {
        let home = temp_root("config-dir-confine");
        let first = home.join(".claude").join("projects");
        let second = home.join(".claude-second").join("projects");
        let inside = write_log(&second, "-home-tom-dev-a", "session-one", "{}\n");
        let outside = write_log(&home, "elsewhere", "session-two", "{}\n");
        std::fs::create_dir_all(&first).unwrap();
        let roots = [first, second];

        assert!(is_log_inside(&roots, &inside.canonicalize().unwrap()));
        assert!(!is_log_inside(&roots, &outside.canonicalize().unwrap()));
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
        let path = write_log(
            &root,
            "-home-tom-dev-a",
            "session-one",
            "{\"a\":1}\n{\"b\":2}\n{\"half\":",
        );

        let read = read_lines(&path, 0).unwrap();

        assert_eq!(read.lines, ["{\"a\":1}", "{\"b\":2}"]);
        assert_eq!(read.next_line, 2);
    }

    #[test]
    fn withholds_a_trailing_line_cut_inside_a_multibyte_character() {
        let root = temp_root("partial-utf8");
        let dir = root.join("-home-tom-dev-a");
        let path = dir.join("session-one.jsonl");
        let mut contents = "{\"a\":\"ü\"}\n".as_bytes().to_vec();

        contents.extend_from_slice(&"{\"b\":\"ü".as_bytes()[..7]);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(&path, contents).unwrap();

        let read = read_lines(&path, 0).unwrap();

        assert_eq!(read.lines, ["{\"a\":\"ü\"}"]);
        assert_eq!(read.next_line, 1);
    }

    #[test]
    fn reads_past_a_line_that_is_not_utf8() {
        let root = temp_root("invalid-utf8");
        let dir = root.join("-home-tom-dev-a");
        let path = dir.join("session-one.jsonl");

        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(&path, b"a\n\xff\nb\n").unwrap();

        let read = read_lines(&path, 0).unwrap();

        assert_eq!(read.lines, ["a", "\u{fffd}", "b"]);
        assert_eq!(read.next_line, 3);
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
        let Some(root) = real_log_root() else { return };

        let logs = list_logs(&root, None).unwrap();
        assert!(!logs.is_empty(), "{} holds no logs", root.display());

        let newest = logs.last().unwrap();
        let read = read_lines(Path::new(&newest.path), 0).unwrap();

        assert_eq!(read.lines.len() as i64, read.next_line);
        for line in read.lines.iter().take(50) {
            assert!(
                serde_json::from_str::<serde_json::Value>(line).is_ok(),
                "not JSON: {line}"
            );
        }
    }

    #[test]
    fn reaches_the_real_subagent_logs_on_this_machine() {
        let Some(root) = real_log_root() else { return };

        let sessions = std::fs::read_dir(&root)
            .unwrap()
            .filter_map(Result::ok)
            .flat_map(|project| {
                std::fs::read_dir(project.path())
                    .into_iter()
                    .flatten()
                    .filter_map(Result::ok)
            });

        let Some(expected) = sessions
            .flat_map(|session| {
                std::fs::read_dir(session.path().join("subagents"))
                    .into_iter()
                    .flatten()
                    .filter_map(Result::ok)
            })
            .map(|log| log.path())
            .find(|path| path.extension().is_some_and(|extension| extension == "jsonl"))
        else {
            return;
        };

        let expected = expected.to_string_lossy().into_owned();
        let logs = list_logs(&root, None).unwrap();

        assert!(logs.iter().any(|log| log.path == expected), "{expected} was not listed");
    }
}
