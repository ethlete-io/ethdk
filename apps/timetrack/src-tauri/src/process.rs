use crate::error::{TimetrackError, TimetrackResult};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

/// The only binaries the webview may ask the host to spawn, each with the operations it may ask for.
///
/// `git` drives the reconcile pass, the two agent CLIs answer the reasoning prompts, `glab` and `gh`
/// read the user's own merge request activity under a login this app never sees, and the five editor
/// clients are asked which extensions they hold.
///
/// The name of the binary is not enough on its own. Git runs a shell command from an alias its own
/// arguments define, so an allowlist over names alone leaves any script that reaches this command able
/// to run anything. The operation is therefore checked as well, and so is every argument that can turn
/// one of these binaries into a general runner. See `rejected_argument`.
const ALLOWED: [Allowed; 10] = [
    Allowed {
        command: "git",
        operations: &[
            "branch",
            "config",
            "fetch",
            "for-each-ref",
            "log",
            "push",
            "reflog",
            "remote",
            "status",
            "switch",
            "worktree",
        ],
    },
    Allowed {
        command: "claude",
        operations: AGENT_OPERATIONS,
    },
    Allowed {
        command: "codex",
        operations: AGENT_OPERATIONS,
    },
    Allowed {
        command: "glab",
        operations: FORGE_OPERATIONS,
    },
    Allowed {
        command: "gh",
        operations: FORGE_OPERATIONS,
    },
    Allowed {
        command: "code",
        operations: EDITOR_OPERATIONS,
    },
    Allowed {
        command: "code-insiders",
        operations: EDITOR_OPERATIONS,
    },
    Allowed {
        command: "codium",
        operations: EDITOR_OPERATIONS,
    },
    Allowed {
        command: "cursor",
        operations: EDITOR_OPERATIONS,
    },
    Allowed {
        command: "windsurf",
        operations: EDITOR_OPERATIONS,
    },
];

/// The agent CLIs take no subcommand. `--print` is what makes the run one question rather than a
/// session, and `agentProcessSpec` in the core puts it first for exactly this check.
const AGENT_OPERATIONS: &[&str] = &["--print"];

const FORGE_OPERATIONS: &[&str] = &["api", "auth"];

const EDITOR_OPERATIONS: &[&str] = &["--list-extensions", "--install-extension"];

struct Allowed {
    command: &'static str,
    operations: &'static [&'static str],
}

/// Arguments that make one of the allowed binaries run something else.
///
/// `--config-env` lets git define an alias and then run it, `--exec-path` moves the whole set of
/// subcommands to a directory the caller picks, `--upload-pack` and `--receive-pack` name the program
/// the other end of a fetch or a push runs, and `--exec` names one `rebase` runs per commit. The
/// prefix forms are matched too, because `--upload-pack=x` is the same instruction.
///
/// Git's own `-c` is not here: it is a global option, so it has to come before the subcommand, and the
/// operation check already refuses anything but a known operation in that position. After a subcommand
/// `-c` belongs to the subcommand, and `git switch -c` is how this app creates a branch.
const REJECTED: [&str; 7] = [
    "--config-env",
    "--exec-path",
    "--exec",
    "--upload-pack",
    "--receive-pack",
    "--git-dir",
    "--work-tree",
];

const DEFAULT_TIMEOUT_MS: u64 = 30_000;

/// The longest a spawn may be given, whatever the caller asks for. The reasoning run is the long case
/// at two minutes; a caller asking for an hour is asking for a process nothing reaps.
const MAX_TIMEOUT_MS: u64 = 10 * 60_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostProcessSpec {
    pub command: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub stdin: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostProcessResult {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Whether the argument names a git transport — `ext::sh -c …` runs a shell command as a remote.
///
/// A remote name and a branch name never hold `::`, so the whole family is refused rather than the
/// one spelling that is known to execute.
fn names_a_transport(argument: &str) -> bool {
    argument
        .split_once("::")
        .is_some_and(|(scheme, _)| !scheme.is_empty() && scheme.chars().all(|c| c.is_ascii_alphanumeric() || "+.-".contains(c)))
}

fn rejected_argument(argument: &str) -> bool {
    REJECTED
        .iter()
        .any(|rejected| argument == *rejected || argument.starts_with(&format!("{rejected}=")))
        || names_a_transport(argument)
}

/// The operation the arguments ask for, checked against what this binary may be asked to do.
fn check(command: &str, args: &[String]) -> TimetrackResult<()> {
    let Some(allowed) = ALLOWED.iter().find(|allowed| allowed.command == command) else {
        return Err(TimetrackError::Rejected(format!(
            "{command} is not one of the commands this app may run"
        )));
    };

    let operation = args.first().map(String::as_str).unwrap_or_default();

    if !allowed.operations.contains(&operation) {
        return Err(TimetrackError::Rejected(format!(
            "{command} may not be asked to {}",
            if operation.is_empty() { "run with no operation" } else { operation }
        )));
    }

    if let Some(argument) = args.iter().find(|argument| rejected_argument(argument)) {
        return Err(TimetrackError::Rejected(format!(
            "{argument} would let {command} run something else"
        )));
    }

    Ok(())
}

#[tauri::command]
pub async fn run_process(spec: HostProcessSpec) -> TimetrackResult<HostProcessResult> {
    check(&spec.command, &spec.args)?;

    let mut command = tokio::process::Command::new(&spec.command);
    command
        .args(&spec.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // A timeout that only drops the future leaves the child running: tokio reaps nothing on drop
        // unless this is set, and the reasoning retry would then start a second model run beside a
        // first one that is still being billed.
        .kill_on_drop(true);

    if let Some(cwd) = &spec.cwd {
        command.current_dir(cwd);
    }

    let mut child = command.spawn().map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => TimetrackError::NotInstalled(spec.command.clone()),
        _ => TimetrackError::Io(error),
    })?;
    let pipe = child.stdin.take();
    let input = spec.stdin.clone();

    // Feeding stdin and draining stdout have to overlap: writing the whole input first deadlocks as
    // soon as the child answers with more than one pipe buffer before it has read everything.
    let feed = async move {
        match (pipe, input) {
            (Some(mut pipe), Some(input)) => {
                pipe.write_all(input.as_bytes()).await?;
                pipe.shutdown().await
            }
            _ => Ok(()),
        }
    };

    let timeout = Duration::from_millis(spec.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).min(MAX_TIMEOUT_MS));
    let output = match tokio::time::timeout(timeout, async {
        let (fed, output) = tokio::join!(feed, child.wait_with_output());
        fed?;
        output
    })
    .await
    {
        Ok(output) => output?,
        Err(_) => {
            return Err(TimetrackError::Rejected(format!(
                "{} did not finish within {}ms",
                spec.command,
                timeout.as_millis()
            )))
        }
    };

    Ok(HostProcessResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(args: &[&str]) -> Vec<String> {
        args.iter().map(|arg| (*arg).to_string()).collect()
    }

    #[test]
    fn runs_the_operations_the_app_itself_asks_for() {
        assert!(check("git", &args(&["status", "--porcelain"])).is_ok());
        assert!(check("git", &args(&["log", "--branches", "--format=%H"])).is_ok());
        assert!(check("git", &args(&["reflog", "show", "-n30"])).is_ok());
        assert!(check("git", &args(&["config", "--get", "user.email"])).is_ok());
        assert!(check("claude", &args(&["--print", "--safe-mode"])).is_ok());
        assert!(check("gh", &args(&["api", "--hostname", "github.com", "user"])).is_ok());
        assert!(check("code", &args(&["--list-extensions"])).is_ok());
        assert!(check("git", &args(&["switch", "-c", "feat/x", "--no-track", "origin/main"])).is_ok());
    }

    /// The proof in the audit. An alias defined on the command line is a shell command git runs.
    #[test]
    fn refuses_the_alias_that_turns_git_into_a_shell() {
        assert!(check("git", &args(&["-c", "alias.x=!printf hi", "x"])).is_err());
        assert!(check("git", &args(&["fetch", "--upload-pack=sh"])).is_err());
        assert!(check("git", &args(&["fetch", "--exec-path=/tmp"])).is_err());
    }

    /// `ext::` names a program as the transport, which a fetch then runs.
    #[test]
    fn refuses_a_remote_that_is_a_program() {
        assert!(check("git", &args(&["fetch", "ext::sh -c payload", "main"])).is_err());
        assert!(check("git", &args(&["fetch", "origin", "main"])).is_ok());
    }

    #[test]
    fn refuses_an_operation_the_app_never_asks_for() {
        assert!(check("git", &args(&["daemon"])).is_err());
        assert!(check("git", &args(&[])).is_err());
        assert!(check("claude", &args(&["--dangerously-skip-permissions"])).is_err());
        assert!(check("sh", &args(&["-c", "id"])).is_err());
    }
}
