use std::collections::HashMap;
use std::future::Future;
use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, ChildStdin};

use crate::design::{port_of, read_config};
use crate::error::{StudioError, StudioResult};

/// Where the design tool lives once a checkout installs it, and where this repository builds it.
/// The first entry that exists wins, and `ETHLETE_CLI` overrules all of them.
const CLI_ENTRIES: [&str; 2] = ["node_modules/@ethlete/cli/src/index.js", "dist/libs/cli/src/index.js"];

/// The product name `tauri.conf.json` gives the app. Tauri builds the resource directory out of it
/// on Linux, so the two must stay equal.
const PRODUCT_NAME: &str = "Ethlete Studio";

/// The copy of the design tool the app carries, under Tauri's resource directory. It brings its own
/// `node_modules`, so it draws a checkout that installs no design tooling at all.
const SHIPPED_CLI: &str = "cli-runtime/node_modules/@ethlete/cli/src/index.js";

/// Enough of the server's output to read a failure, short enough to send on every poll.
const LOG_LINES: usize = 40;

/// A cold start builds the design page, so the first answer takes far longer than a restart.
const START_TIMEOUT: Duration = Duration::from_secs(90);
// A cli older than `design stamp` reads `stamp` as a checkout path and serves it until killed.
const STAMP_TIMEOUT: Duration = Duration::from_secs(5);

const STAMP_PATH: &str = "/__design/stamp";

const POLL: Duration = Duration::from_millis(250);

const STOP_GRACE: Duration = Duration::from_secs(3);

const CLI_SOURCE_DIRS: [&str; 3] = ["src", "design", "playwright"];

const BUILD_INFO: &str = "dist/libs/cli/build-info.json";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerState {
    pub port: u16,
    pub listening: bool,
    /// True when this Studio started the server. Only then can Studio stop it again.
    pub managed: bool,
    /// True when something listens that this Studio did not start.
    pub foreign: bool,
    /// True when the listening server was started from a different cli than the one on disk now,
    /// or reports no stamp at all.
    pub stale: bool,
    /// True when a server this Studio started has since ended. Its last output stays in `log`.
    pub exited: bool,
    /// `None` when the log is still the one the caller named by `log_revision`.
    pub log: Option<Vec<String>>,
    pub log_revision: u64,
}

#[derive(Default)]
struct Log {
    lines: Vec<String>,
    revision: u64,
}

static LOG_REVISION: AtomicU64 = AtomicU64::new(1);

impl Log {
    fn new(lines: Vec<String>) -> Self {
        Self {
            lines,
            revision: LOG_REVISION.fetch_add(1, Ordering::Relaxed),
        }
    }

    fn push(&mut self, line: String) {
        self.lines.push(line);

        let overflow = self.lines.len().saturating_sub(LOG_LINES);

        self.lines.drain(..overflow);
        self.revision = LOG_REVISION.fetch_add(1, Ordering::Relaxed);
    }
}

struct Server {
    child: Child,
    _stdin: Option<ChildStdin>,
    log: Arc<Mutex<Log>>,
    cli_sha: Option<String>,
}

#[derive(Default, Clone)]
pub struct DesignServers {
    table: Arc<Mutex<HashMap<String, Server>>>,
    /// Stale verdicts per checkout and port, kept until the port stops answering or Studio starts a server on it.
    verdicts: Arc<Mutex<HashMap<(String, u16), bool>>>,
}

impl DesignServers {
    pub fn cli_sha(&self) -> Option<String> {
        self.table
            .lock()
            .ok()?
            .values()
            .find_map(|server| server.cli_sha.clone())
    }
}

fn port_of_checkout(checkout: &str) -> StudioResult<u16> {
    read_config(checkout)
        .map(|config| port_of(&config))
        .map_err(StudioError::Rejected)
}

/// Vite binds the IPv6 loopback alone, so a probe of 127.0.0.1 answers that a running server is
/// stopped and Studio starts a second one on a port already in use.
const LOOPBACK: [IpAddr; 2] = [IpAddr::V6(Ipv6Addr::LOCALHOST), IpAddr::V4(Ipv4Addr::LOCALHOST)];

async fn listening(port: u16) -> bool {
    for host in LOOPBACK {
        let probe = tokio::net::TcpStream::connect(SocketAddr::new(host, port));

        if matches!(tokio::time::timeout(POLL, probe).await, Ok(Ok(_))) {
            return true;
        }
    }

    false
}

async fn state(
    servers: &DesignServers,
    checkout: &str,
    port: u16,
    known_log: Option<u64>,
) -> StudioResult<ServerState> {
    let listening = listening(port).await;
    let mut table = servers.table.lock().map_err(|_| StudioError::Poisoned)?;
    let mut lines = Vec::new();
    let mut log_revision = 0;
    let mut managed = false;
    let mut exited = false;

    if let Some(server) = table.get_mut(checkout) {
        let log = server.log.lock().map_err(|_| StudioError::Poisoned)?;

        log_revision = log.revision;

        if known_log != Some(log_revision) {
            lines = log.lines.clone();
        }

        drop(log);
        managed = matches!(server.child.try_wait(), Ok(None));
        exited = !managed;
    }

    Ok(ServerState {
        port,
        listening,
        managed,
        foreign: listening && !managed,
        stale: false,
        exited,
        log: (known_log != Some(log_revision)).then_some(lines),
        log_revision,
    })
}

fn served_stamp(port: u16) -> Option<serde_json::Value> {
    for host in LOOPBACK {
        let Ok(mut stream) = TcpStream::connect_timeout(&SocketAddr::new(host, port), POLL) else {
            continue;
        };

        let _ = stream.set_read_timeout(Some(STOP_GRACE));
        let request = format!("GET {STAMP_PATH} HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n");

        if stream.write_all(request.as_bytes()).is_err() {
            continue;
        }

        let mut answer = String::new();

        if stream.read_to_string(&mut answer).is_err() {
            continue;
        }

        let (head, body) = answer.split_once("\r\n\r\n")?;

        if !head.starts_with("HTTP/1.1 200") && !head.starts_with("HTTP/1.0 200") {
            return None;
        }

        let stamp: serde_json::Value = serde_json::from_str(body.trim()).ok()?;

        return (stamp.get("version")?.is_string() && stamp.get("build")?.is_string()).then_some(stamp);
    }

    None
}

async fn own_stamp(checkout: &str) -> Option<serde_json::Value> {
    let entry = cli_entry(Path::new(checkout))?;

    let output = tokio::time::timeout(
        STAMP_TIMEOUT,
        crate::child_env::command("node")
            .arg(entry)
            .arg("design")
            .arg("stamp")
            .current_dir(checkout)
            .stdin(Stdio::null())
            .kill_on_drop(true)
            .output(),
    )
    .await
    .ok()?
    .ok()?;

    serde_json::from_slice(&output.stdout).ok()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Verdict {
    Current,
    Stale,
    /// The server answered no stamp yet. It reads as stale, but a server still starting answers later.
    Unanswered,
}

/// A listening server is stale when it answers no stamp, or one that differs from the stamp of the
/// cli Studio would start it with. A cli that cannot print its own stamp cannot be compared with.
async fn is_stale(checkout: &str, port: u16) -> Verdict {
    let Ok(Some(served)) = tokio::task::spawn_blocking(move || served_stamp(port)).await else {
        return Verdict::Unanswered;
    };

    match own_stamp(checkout).await {
        Some(own) if stamps_differ(&own, &served) => Verdict::Stale,
        _ => Verdict::Current,
    }
}

/// The served stamp carries more fields than `design stamp` prints; only the version and build name the cli.
fn stamps_differ(own: &serde_json::Value, served: &serde_json::Value) -> bool {
    ["version", "build"]
        .iter()
        .any(|field| own.get(field) != served.get(field))
}

async fn judge_stale(checkout: String, port: u16) -> Verdict {
    let outdated = cfg!(debug_assertions) && tokio::task::spawn_blocking(built_cli_outdated).await.unwrap_or(false);

    if outdated {
        return Verdict::Stale;
    }

    is_stale(&checkout, port).await
}

fn forget_verdict(servers: &DesignServers, checkout: &str, port: u16) -> StudioResult<()> {
    servers
        .verdicts
        .lock()
        .map_err(|_| StudioError::Poisoned)?
        .remove(&(checkout.to_owned(), port));

    Ok(())
}

async fn judged_with<F, J>(
    servers: &DesignServers,
    checkout: &str,
    port: u16,
    known_log: Option<u64>,
    judge: J,
) -> StudioResult<ServerState>
where
    J: FnOnce() -> F,
    F: Future<Output = Verdict>,
{
    let mut current = state(servers, checkout, port, known_log).await?;

    if !current.listening {
        forget_verdict(servers, checkout, port)?;

        return Ok(current);
    }

    let key = (checkout.to_owned(), port);
    let cached = servers
        .verdicts
        .lock()
        .map_err(|_| StudioError::Poisoned)?
        .get(&key)
        .copied();

    current.stale = match cached {
        Some(stale) => stale,
        None => {
            let verdict = judge().await;
            let stale = verdict != Verdict::Current;

            if verdict != Verdict::Unanswered {
                servers
                    .verdicts
                    .lock()
                    .map_err(|_| StudioError::Poisoned)?
                    .insert(key, stale);
            }

            stale
        }
    };

    Ok(current)
}

async fn judged(
    servers: &DesignServers,
    checkout: &str,
    port: u16,
    known_log: Option<u64>,
) -> StudioResult<ServerState> {
    judged_with(servers, checkout, port, known_log, || {
        judge_stale(checkout.to_owned(), port)
    })
    .await
}

fn built_cli_outdated() -> bool {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");

    cli_build_is_stale(&root.join("libs/cli"), &root.join(BUILD_INFO))
}

/// A missing or unreadable build-info.json is not stale: there is no build to compare with.
fn cli_build_is_stale(cli_root: &Path, build_info: &Path) -> bool {
    let Ok(text) = std::fs::read_to_string(build_info) else {
        return false;
    };
    let Ok(info) = serde_json::from_str::<Value>(&text) else {
        return false;
    };

    info.get("sourceHash").and_then(Value::as_str) != Some(cli_source_hash(cli_root).as_str())
}

fn source_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };

    entries
        .flatten()
        .filter(|entry| entry.file_name() != "node_modules")
        .flat_map(|entry| {
            let path = entry.path();

            if path.is_dir() {
                source_files(&path)
            } else {
                vec![path]
            }
        })
        .filter(|file| {
            let name = file.to_string_lossy();

            !name.ends_with(".spec.ts") && !name.ends_with(".md")
        })
        .collect()
}

/// Mirrors `cliSourceHash` in libs/cli/src/lib/source-hash.ts.
fn cli_source_hash(cli_root: &Path) -> String {
    let mut hash = Sha256::new();

    for dir in CLI_SOURCE_DIRS {
        let path = cli_root.join(dir);

        if !path.exists() {
            continue;
        }

        let mut files = source_files(&path);

        files.sort_by_key(|file| file.to_string_lossy().into_owned());

        for file in files {
            let Ok(content) = std::fs::read(&file) else {
                continue;
            };

            hash.update(
                file.strip_prefix(cli_root)
                    .unwrap_or(&file)
                    .to_string_lossy()
                    .as_bytes(),
            );
            hash.update([0]);
            hash.update(content);
            hash.update([0]);
        }
    }

    hash.finalize().iter().map(|byte| format!("{byte:02x}")).collect()
}

fn pids_on_port(port: u16) -> Vec<i32> {
    let lsof = std::process::Command::new("lsof")
        .args(["-nP", "-t", &format!("-iTCP:{port}"), "-sTCP:LISTEN"])
        .output();

    if let Ok(output) = lsof {
        let pids: Vec<i32> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| line.trim().parse().ok())
            .collect();

        if !pids.is_empty() {
            return pids;
        }
    }

    let Ok(output) = std::process::Command::new("ss")
        .args(["-H", "-ltnp", "sport", "=", &format!(":{port}")])
        .output()
    else {
        return Vec::new();
    };

    parse_ss_pids(&String::from_utf8_lossy(&output.stdout))
}

fn parse_ss_pids(text: &str) -> Vec<i32> {
    let mut pids: Vec<i32> = text
        .split("pid=")
        .skip(1)
        .filter_map(|rest| {
            let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();

            digits.parse().ok()
        })
        .collect();

    pids.sort_unstable();
    pids.dedup();
    pids
}

/// Ends whatever listens on the port, started by Studio or not. Only the listening process is
/// signalled, never one picked by its command line, since every design server shares that.
#[cfg(unix)]
async fn stop_port(port: u16) {
    let pids = tokio::task::spawn_blocking(move || pids_on_port(port))
        .await
        .unwrap_or_default();

    for signal in [libc::SIGTERM, libc::SIGKILL] {
        for pid in &pids {
            // SAFETY: kill only reads the id, and the id was read from the port's own listener.
            unsafe {
                libc::kill(*pid, signal);
            }
        }

        let deadline = Instant::now() + STOP_GRACE;

        while Instant::now() < deadline && listening(port).await {
            tokio::time::sleep(POLL).await;
        }

        if !listening(port).await {
            return;
        }
    }
}

#[cfg(not(unix))]
async fn stop_port(_port: u16) {}

fn collect<R: AsyncRead + Unpin + Send + 'static>(source: R, log: Arc<Mutex<Log>>) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(source).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(mut log) = log.lock() else {
                return;
            };

            log.push(line);
        }
    });
}

fn reachable_cli(checkout: &str) -> StudioResult<PathBuf> {
    cli_entry(Path::new(checkout)).ok_or_else(|| {
        StudioError::Rejected(format!(
            "No copy of @ethlete/cli is reachable for {checkout}. Build one with \
             `npx nx build cli`, or point ETHLETE_CLI at a src/index.js."
        ))
    })
}

fn spawn(servers: &DesignServers, checkout: &str, preface: Vec<String>) -> StudioResult<()> {
    spawn_from(servers, checkout, &reachable_cli(checkout)?, preface, None)
}

/// Starts the checkout's server. Started from this repository, it runs from a copy of the committed
/// CLI build, never from the build agents rewrite in the working tree, and the frontend server
/// switches to the build of the last committed frontend.
async fn start(servers: &DesignServers, checkout: &str) -> StudioResult<Option<crate::studio_code::AppCopy>> {
    if !crate::studio_code::starts_from_repo_build(Path::new(checkout)) {
        return spawn(servers, checkout, Vec::new()).map(|()| None);
    }

    let (copy, preface) = crate::studio_code::cli_copy().await?;
    let app_copy = crate::studio_code::app_copy().await?;

    spawn_from(servers, checkout, &copy.entry, preface, Some(copy.sha))?;

    Ok(Some(app_copy))
}

/// Studio runs the design tool itself, so a checkout needs no script and no design tooling of its
/// own. Node is the one thing the machine must still carry.
fn spawn_from(
    servers: &DesignServers,
    checkout: &str,
    entry: &Path,
    preface: Vec<String>,
    cli_sha: Option<String>,
) -> StudioResult<()> {
    let mut command = crate::child_env::command("node");

    command
        .arg(entry)
        .arg("design")
        .arg(checkout)
        .current_dir(checkout)
        .env("ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // The server exits when its stdin closes, so Studio must hold the pipe for the server's whole
    // life: its death by any route, SIGKILL included, is what closes it.
    // The server starts a bundler, which starts workers of its own, so a stop has to reach the
    // whole group. Its own group is what makes that reachable.
    #[cfg(unix)]
    command.process_group(0);

    let mut child = command.spawn().map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => StudioError::NotInstalled("node".to_owned()),
        _ => StudioError::Io(error),
    })?;

    let stdin = child.stdin.take();
    let log = Arc::new(Mutex::new(Log::new(preface)));

    if let Some(stdout) = child.stdout.take() {
        collect(stdout, log.clone());
    }

    if let Some(stderr) = child.stderr.take() {
        collect(stderr, log.clone());
    }

    servers.table.lock().map_err(|_| StudioError::Poisoned)?.insert(
        checkout.to_owned(),
        Server {
            child,
            _stdin: stdin,
            log,
            cli_sha,
        },
    );

    Ok(())
}

async fn await_listening(servers: &DesignServers, checkout: &str, port: u16) {
    let deadline = Instant::now() + START_TIMEOUT;

    while Instant::now() < deadline {
        if listening(port).await {
            return;
        }

        if state(servers, checkout, port, None).await.is_ok_and(|read| read.exited) {
            return;
        }

        tokio::time::sleep(POLL).await;
    }
}

#[cfg(unix)]
fn signal_group(child: &Child) {
    let Some(pid) = child.id().and_then(|id| i32::try_from(id).ok()) else {
        return;
    };

    // SAFETY: kill only reads the id. The negative value addresses the child's own process group,
    // which the spawn created, so no other process can be reached by it.
    unsafe {
        libc::kill(-pid, libc::SIGTERM);
    }
}

#[cfg(not(unix))]
fn signal_group(_child: &Child) {}

pub async fn end(child: &mut Child) {
    signal_group(child);

    let deadline = Instant::now() + STOP_GRACE;

    while Instant::now() < deadline {
        if matches!(child.try_wait(), Ok(Some(_))) {
            return;
        }

        tokio::time::sleep(POLL).await;
    }

    let _ = child.start_kill();
    let _ = child.wait().await;
}

/// Every server this Studio started, stopped. The window is gone when the app exits, so nothing
/// can reach the Stop control any more and a left-over server would hold the port.
pub fn stop_every(servers: &DesignServers) {
    let Ok(mut table) = servers.table.lock() else {
        return;
    };

    for (_, mut server) in table.drain() {
        signal_group(&server.child);

        let _ = server.child.start_kill();
    }
}

#[tauri::command]
pub async fn design_server_state(
    servers: tauri::State<'_, DesignServers>,
    checkout: String,
    log_revision: Option<u64>,
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;

    judged(servers.inner(), &checkout, port, log_revision).await
}

/// Starts the checkout's design server and answers once it accepts connections. A server that
/// already listens is left alone, whoever started it.
#[tauri::command]
pub async fn design_server_start(
    app: tauri::AppHandle,
    servers: tauri::State<'_, DesignServers>,
    checkout: String,
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;
    let current = state(servers.inner(), &checkout, port, None).await?;

    if current.listening || current.managed {
        return Ok(current);
    }

    let app_copy = start(servers.inner(), &checkout).await?;
    forget_verdict(servers.inner(), &checkout, port)?;
    await_listening(servers.inner(), &checkout, port).await;

    let answer = state(servers.inner(), &checkout, port, None).await;

    if let Some(copy) = app_copy {
        crate::studio_code::reload_on_switch(&app, &copy);
    }

    answer
}

/// Stops the server this Studio started. A server somebody else started stays up.
#[tauri::command]
pub async fn design_server_stop(
    servers: tauri::State<'_, DesignServers>,
    checkout: String,
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;
    let taken = servers
        .table
        .lock()
        .map_err(|_| StudioError::Poisoned)?
        .remove(&checkout);

    if let Some(mut server) = taken {
        end(&mut server.child).await;
    }

    state(servers.inner(), &checkout, port, None).await
}

/// Stops whatever listens on the checkout's port, then starts the server Studio owns.
#[tauri::command]
pub async fn design_server_restart(
    app: tauri::AppHandle,
    servers: tauri::State<'_, DesignServers>,
    checkout: String,
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;
    let taken = servers
        .table
        .lock()
        .map_err(|_| StudioError::Poisoned)?
        .remove(&checkout);

    if let Some(mut server) = taken {
        end(&mut server.child).await;
    }

    if listening(port).await {
        stop_port(port).await;
    }

    if listening(port).await {
        return Err(StudioError::Rejected(format!(
            "Port {port} is still in use after stopping its listener."
        )));
    }

    let app_copy = start(servers.inner(), &checkout).await?;
    forget_verdict(servers.inner(), &checkout, port)?;
    await_listening(servers.inner(), &checkout, port).await;

    let answer = judged(servers.inner(), &checkout, port, None).await;

    if let Some(copy) = app_copy {
        crate::studio_code::reload_on_switch(&app, &copy);
    }

    answer
}

/// The copy of the design tool this app ships, or `None` when the app runs from a build that never
/// made one.
fn shipped_cli() -> Option<PathBuf> {
    let package = tauri::utils::PackageInfo {
        name: PRODUCT_NAME.to_owned(),
        version: env!("CARGO_PKG_VERSION").parse().ok()?,
        authors: "",
        description: "",
        crate_name: env!("CARGO_PKG_NAME"),
    };

    let path = tauri::utils::platform::resource_dir(&package, &tauri::Env::default())
        .ok()?
        .join(SHIPPED_CLI);

    path.is_file().then_some(path)
}

fn entry_of(checkout: &Path, shipped: impl FnOnce() -> Option<PathBuf>) -> Option<PathBuf> {
    if let Some(named) = std::env::var_os("ETHLETE_CLI") {
        let path = PathBuf::from(named);

        return path.is_file().then_some(path);
    }

    CLI_ENTRIES
        .iter()
        .map(|entry| checkout.join(entry))
        .find(|path| path.is_file())
        .or_else(shipped)
}

/// The `et` entry point that draws and checks a checkout. Step by step: an explicit override, the
/// copy the checkout installed, the copy this repository builds, then the copy the app ships.
pub fn cli_entry(checkout: &Path) -> Option<PathBuf> {
    entry_of(checkout, shipped_cli)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::process::Command;

    fn fixture() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../libs/cli/fixtures/source-hash")
    }

    #[test]
    fn the_cli_source_hash_matches_the_typescript_one() {
        let expected = std::fs::read_to_string(fixture().join("expected-hash.txt")).expect("an expected hash");

        assert_eq!(cli_source_hash(&fixture().join("cli")), expected.trim());
    }

    #[test]
    fn a_cli_build_is_stale_when_its_recorded_hash_differs_from_the_sources() {
        let root = std::env::temp_dir().join(format!("ethlete-studio-{}-cli-build", std::process::id()));
        let info = root.join("build-info.json");
        let expected = std::fs::read_to_string(fixture().join("expected-hash.txt")).expect("an expected hash");

        std::fs::create_dir_all(&root).expect("a directory");

        let cli = fixture().join("cli");

        assert!(!cli_build_is_stale(&cli, &info));

        std::fs::write(&info, format!(r#"{{"sourceHash":"{}"}}"#, expected.trim())).expect("a file");
        assert!(!cli_build_is_stale(&cli, &info));

        std::fs::write(&info, r#"{"sourceHash":"other"}"#).expect("a file");
        assert!(cli_build_is_stale(&cli, &info));

        std::fs::write(&info, "{}").expect("a file");
        assert!(cli_build_is_stale(&cli, &info));

        std::fs::remove_dir_all(&root).expect("cleaned up");
    }

    #[tokio::test]
    async fn a_checkout_nobody_started_reads_as_not_managed() {
        let servers = DesignServers::default();
        let read = state(&servers, "/nowhere", 65000, None).await.expect("a state");

        assert!(!read.managed);
        assert!(!read.listening);
        assert_eq!(read.port, 65000);
        assert_eq!(read.log, Some(Vec::new()));
    }

    #[tokio::test]
    async fn a_port_that_answers_on_the_ipv6_loopback_reads_as_listening() {
        let Ok(listener) = std::net::TcpListener::bind("[::1]:0") else {
            return;
        };

        assert!(listening(listener.local_addr().expect("an address").port()).await);
    }

    /// A checkout that installs a design tool which answers on one port, which is all Studio asks.
    fn fake_checkout(port: u16) -> String {
        let dir = std::env::temp_dir().join(format!("studio-design-server-{port}"));
        let entry = dir.join("node_modules/@ethlete/cli/src/index.js");

        std::fs::create_dir_all(entry.parent().expect("a parent")).expect("a temporary checkout");
        std::fs::write(
            &entry,
            format!("const {{ createServer }} = require('node:http');\nconst server = createServer((_, response) => response.end('ok')).listen({port});\nif (process.env.ETHLETE_DESIGN_EXIT_ON_STDIN_CLOSE === '1') process.stdin.on('end', () => server.close(() => process.exit(0))).resume();\n"),
        )
        .expect("a design tool");

        dir.to_string_lossy().into_owned()
    }

    async fn await_stopped(port: u16) {
        for _ in 0..20 {
            if !listening(port).await {
                return;
            }

            tokio::time::sleep(POLL).await;
        }
    }

    #[tokio::test]
    async fn a_server_that_dies_at_start_reads_as_exited_with_its_last_output() {
        const PORT: u16 = 45875;

        let dir = std::env::temp_dir().join(format!("studio-design-server-{PORT}"));
        let entry = dir.join("node_modules/@ethlete/cli/src/index.js");

        std::fs::create_dir_all(entry.parent().expect("a parent")).expect("a temporary checkout");
        std::fs::write(
            &entry,
            "console.error(\"Error: EMFILE: too many open files, watch '/x'\");\nprocess.exit(1);\n",
        )
        .expect("a design tool");

        let checkout = dir.to_string_lossy().into_owned();
        let servers = DesignServers::default();

        spawn(&servers, &checkout, Vec::new()).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        let mut read = state(&servers, &checkout, PORT, None).await.expect("a state");

        for _ in 0..20 {
            if read.log.as_ref().is_some_and(|log| !log.is_empty()) {
                break;
            }

            tokio::time::sleep(POLL).await;
            read = state(&servers, &checkout, PORT, None).await.expect("a state");
        }

        assert!(read.exited);
        assert!(!read.managed);
        assert!(read.log.iter().flatten().any(|line| line.contains("EMFILE")));

        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn a_checkout_is_served_by_its_design_tool_and_the_stop_reaches_the_whole_group() {
        const PORT: u16 = 45872;

        let checkout = fake_checkout(PORT);
        let servers = DesignServers::default();

        spawn(&servers, &checkout, Vec::new()).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        assert!(listening(PORT).await, "the design tool never answered");
        assert!(state(&servers, &checkout, PORT, None).await.expect("a state").managed);

        let taken = servers.table.lock().expect("the table").remove(&checkout);

        end(&mut taken.expect("the server").child).await;
        await_stopped(PORT).await;

        assert!(!listening(PORT).await, "the server the design tool started is still up");
        assert!(!state(&servers, &checkout, PORT, None).await.expect("a state").managed);

        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn the_app_leaves_no_server_behind_when_it_exits() {
        const PORT: u16 = 45873;

        let checkout = fake_checkout(PORT);
        let servers = DesignServers::default();

        spawn(&servers, &checkout, Vec::new()).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        assert!(listening(PORT).await, "the design tool never answered");

        stop_every(&servers);
        await_stopped(PORT).await;

        assert!(!listening(PORT).await, "a server outlived the app");
        assert!(!state(&servers, &checkout, PORT, None).await.expect("a state").managed);

        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn a_server_stops_when_the_app_dies_without_stopping_it() {
        const PORT: u16 = 45877;

        let checkout = fake_checkout(PORT);
        let servers = DesignServers::default();

        spawn(&servers, &checkout, Vec::new()).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        assert!(listening(PORT).await, "the design tool never answered");

        servers
            .table
            .lock()
            .expect("the servers")
            .get_mut(&checkout)
            .expect("a server")
            ._stdin
            .take();
        await_stopped(PORT).await;

        assert!(!listening(PORT).await, "a server outlived its stdin");

        stop_every(&servers);
        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[test]
    fn a_checkout_no_design_tool_can_be_found_for_is_refused() {
        let bare = std::env::temp_dir().join(format!("studio-design-server-bare-{}", std::process::id()));

        std::fs::create_dir_all(&bare).expect("a temporary checkout");

        let refused = spawn(&DesignServers::default(), &bare.to_string_lossy(), Vec::new());

        assert!(matches!(refused, Err(StudioError::Rejected(_))));

        let _ = std::fs::remove_dir_all(&bare);
    }

    #[test]
    fn the_pids_are_read_out_of_ss_output() {
        let text = "LISTEN 0 511 [::1]:4402 [::]:* users:((\"node\",pid=4242,fd=19),(\"node\",pid=4243,fd=20))\n";

        assert_eq!(parse_ss_pids(text), vec![4242, 4243]);
        assert!(parse_ss_pids("").is_empty());
    }

    const CAPTURED_STAMP: &str = r#"{"version":"3.0.0-next.28","build":"652c69c9dd2d","stamp":{"version":"3.0.0-next.28","build":"652c69c9dd2d"},"apiLevel":8,"builtAt":1794413247021,"projectRoot":"/home/tom/dev/ethlete-sdk","installed":{"stamp":{"version":"3.0.0-next.28","build":"efa41b631129"},"builtAt":1794413226278},"pid":901644,"owner":"terminal","cliRoot":"/home/tom/dev/ethlete-sdk/dist/libs/cli/src/lib/design"}"#;

    #[test]
    fn a_stamp_is_read_from_a_server_and_a_server_without_one_reads_as_none() {
        let serve = |body: &'static str, status: &'static str| {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("a listener");
            let port = listener.local_addr().expect("an address").port();

            std::thread::spawn(move || {
                if let Ok((mut stream, _)) = listener.accept() {
                    let mut buffer = [0u8; 512];
                    let _ = stream.read(&mut buffer);
                    let _ = write!(stream, "HTTP/1.1 {status}\r\nConnection: close\r\n\r\n{body}");
                }
            });

            port
        };

        let stamped = serve("{\"version\":\"1.0.0\",\"build\":\"abc\"}", "200 OK");
        let bare = serve("<html></html>", "200 OK");
        let missing = serve("{}", "404 Not Found");

        assert_eq!(
            served_stamp(stamped),
            Some(serde_json::json!({ "version": "1.0.0", "build": "abc" }))
        );
        assert_eq!(served_stamp(bare), None);
        assert_eq!(served_stamp(missing), None);
    }

    #[test]
    fn a_served_stamp_with_more_fields_than_the_own_stamp_is_not_stale() {
        let served: serde_json::Value = serde_json::from_str(CAPTURED_STAMP).expect("the captured stamp");
        let own = serde_json::json!({ "version": "3.0.0-next.28", "build": "652c69c9dd2d" });
        let older = serde_json::json!({ "version": "3.0.0-next.28", "build": "efa41b631129" });

        assert!(!stamps_differ(&own, &served));
        assert!(stamps_differ(&older, &served));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn a_server_somebody_else_started_is_ended_by_the_port_it_listens_on() {
        const PORT: u16 = 45874;

        let checkout = fake_checkout(PORT);
        let entry = Path::new(&checkout).join("node_modules/@ethlete/cli/src/index.js");
        let mut foreign = Command::new("node")
            .arg(entry)
            .kill_on_drop(true)
            .spawn()
            .expect("a server");

        await_listening(&DesignServers::default(), &checkout, PORT).await;

        let read = state(&DesignServers::default(), &checkout, PORT, None)
            .await
            .expect("a state");

        assert!(read.listening && read.foreign && !read.managed);

        stop_port(PORT).await;
        await_stopped(PORT).await;

        assert!(!listening(PORT).await, "the foreign server is still up");

        let _ = foreign.wait().await;
        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn the_log_keeps_only_the_last_lines() {
        let printed: String = (0..LOG_LINES + 10).map(|line| format!("{line}\n")).collect();
        let log = Arc::new(Mutex::new(Log::default()));

        collect(std::io::Cursor::new(printed.into_bytes()), log.clone());

        for _ in 0..40 {
            if log.lock().expect("the log").lines.len() == LOG_LINES {
                break;
            }

            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        let held = log.lock().expect("the log");

        assert_eq!(held.lines.len(), LOG_LINES);
        assert_eq!(held.lines[0], "10");
    }

    #[tokio::test]
    async fn the_log_is_sent_only_when_it_changed_since_the_named_revision() {
        let checkout = fake_checkout(45878);
        let servers = DesignServers::default();

        spawn(&servers, &checkout, vec!["first".to_owned()]).expect("the design tool runs");

        let first = state(&servers, &checkout, 45878, None).await.expect("a state");

        assert_eq!(first.log, Some(vec!["first".to_owned()]));

        let again = state(&servers, &checkout, 45878, Some(first.log_revision))
            .await
            .expect("a state");

        assert_eq!(again.log, None);
        assert_eq!(again.log_revision, first.log_revision);

        servers
            .table
            .lock()
            .expect("the table")
            .get(&checkout)
            .expect("a server")
            .log
            .lock()
            .expect("the log")
            .push("second".to_owned());

        let changed = state(&servers, &checkout, 45878, Some(first.log_revision))
            .await
            .expect("a state");

        assert_eq!(changed.log, Some(vec!["first".to_owned(), "second".to_owned()]));
        assert_ne!(changed.log_revision, first.log_revision);

        stop_every(&servers);
        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn the_stale_verdict_is_judged_once_per_server_start() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("a listener");
        let port = listener.local_addr().expect("an address").port();
        let servers = DesignServers::default();
        let judged = std::sync::atomic::AtomicUsize::new(0);
        let judge = |verdict: Verdict| {
            judged.fetch_add(1, Ordering::SeqCst);
            async move { verdict }
        };

        let first = judged_with(&servers, "/checkout", port, None, || judge(Verdict::Stale))
            .await
            .expect("a state");
        let second = judged_with(&servers, "/checkout", port, None, || judge(Verdict::Current))
            .await
            .expect("a state");

        assert!(first.stale && second.stale);
        assert_eq!(judged.load(Ordering::SeqCst), 1);

        forget_verdict(&servers, "/checkout", port).expect("forgotten");

        let restarted = judged_with(&servers, "/checkout", port, None, || judge(Verdict::Current))
            .await
            .expect("a state");

        assert!(!restarted.stale);
        assert_eq!(judged.load(Ordering::SeqCst), 2);

        const STOPPED: u16 = 45879;

        servers
            .verdicts
            .lock()
            .expect("the verdicts")
            .insert(("/checkout".to_owned(), STOPPED), true);

        let stopped = judged_with(&servers, "/checkout", STOPPED, None, || judge(Verdict::Stale))
            .await
            .expect("a state");

        assert!(!stopped.listening);
        assert_eq!(judged.load(Ordering::SeqCst), 2);
        assert!(!servers
            .verdicts
            .lock()
            .expect("the verdicts")
            .contains_key(&("/checkout".to_owned(), STOPPED)));
        drop(listener);
    }

    #[tokio::test]
    async fn a_server_that_answered_no_stamp_yet_is_judged_again() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("a listener");
        let port = listener.local_addr().expect("an address").port();
        let servers = DesignServers::default();

        let starting = judged_with(&servers, "/checkout", port, None, || async { Verdict::Unanswered })
            .await
            .expect("a state");
        let answered = judged_with(&servers, "/checkout", port, None, || async { Verdict::Current })
            .await
            .expect("a state");

        assert!(starting.stale);
        assert!(!answered.stale);
        drop(listener);
    }

    fn ground(name: &str) -> PathBuf {
        let ground = std::env::temp_dir().join(format!("ethlete-studio-cli-entry-{}-{name}", std::process::id()));

        let _ = std::fs::remove_dir_all(&ground);
        std::fs::create_dir_all(&ground).expect("a temporary ground");

        ground
    }

    #[test]
    fn the_installed_cli_is_preferred_over_a_built_one() {
        let checkout = ground("installed");

        for entry in CLI_ENTRIES {
            let path = checkout.join(entry);
            std::fs::create_dir_all(path.parent().expect("a parent")).expect("a directory");
            std::fs::write(&path, "").expect("an entry point");
        }

        assert_eq!(cli_entry(&checkout), Some(checkout.join(CLI_ENTRIES[0])));
    }

    #[test]
    fn a_checkout_without_the_cli_falls_back_to_the_copy_the_app_ships() {
        let shipped = ground("shipped").join("index.js");

        std::fs::write(&shipped, "").expect("a shipped entry point");

        assert_eq!(entry_of(&ground("bare"), || Some(shipped.clone())), Some(shipped));
    }

    #[test]
    fn the_checkouts_own_cli_wins_over_the_copy_the_app_ships() {
        let checkout = ground("own");
        let path = checkout.join(CLI_ENTRIES[1]);

        std::fs::create_dir_all(path.parent().expect("a parent")).expect("a directory");
        std::fs::write(&path, "").expect("an entry point");

        assert_eq!(
            entry_of(&checkout, || Some(PathBuf::from("/nowhere/index.js"))),
            Some(path)
        );
    }

    #[test]
    fn the_shipped_copy_is_where_the_tauri_config_puts_it() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json")).expect("the tauri config parses");

        assert_eq!(
            config.get("productName").and_then(Value::as_str),
            Some(PRODUCT_NAME),
            "PRODUCT_NAME no longer matches productName, so the resource directory is resolved wrongly"
        );

        let shipped_under = SHIPPED_CLI.split('/').next().expect("a first segment");
        let resources = config
            .pointer("/bundle/resources")
            .and_then(Value::as_object)
            .expect("the bundle ships resources");

        assert!(
            resources.values().any(|target| target.as_str() == Some(shipped_under)),
            "no resource is bundled as {shipped_under}, so SHIPPED_CLI points at nothing"
        );
    }
}
