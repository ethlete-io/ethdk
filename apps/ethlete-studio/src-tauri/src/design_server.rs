use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, TcpStream};
use std::path::Path;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, ChildStdin};

use crate::design::{port_of, read_config};
use crate::error::{StudioError, StudioResult};
use crate::tools::cli_entry;

/// Enough of the server's output to read a failure, short enough to send on every poll.
const LOG_LINES: usize = 40;

/// A cold start builds the design page, so the first answer takes far longer than a restart.
const START_TIMEOUT: Duration = Duration::from_secs(90);
// A cli older than `design stamp` reads `stamp` as a checkout path and serves it until killed.
const STAMP_TIMEOUT: Duration = Duration::from_secs(5);

const STAMP_PATH: &str = "/__design/stamp";

const POLL: Duration = Duration::from_millis(250);

const STOP_GRACE: Duration = Duration::from_secs(3);

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
    pub log: Vec<String>,
}

struct Server {
    child: Child,
    _stdin: Option<ChildStdin>,
    log: Arc<Mutex<Vec<String>>>,
}

#[derive(Default, Clone)]
pub struct DesignServers(Arc<Mutex<HashMap<String, Server>>>);

fn port_of_checkout(checkout: &str) -> StudioResult<u16> {
    read_config(checkout)
        .map(|config| port_of(&config))
        .map_err(StudioError::Rejected)
}

/// Vite binds the IPv6 loopback alone, so a probe of 127.0.0.1 answers that a running server is
/// stopped and Studio starts a second one on a port already in use.
const LOOPBACK: [IpAddr; 2] = [IpAddr::V6(Ipv6Addr::LOCALHOST), IpAddr::V4(Ipv4Addr::LOCALHOST)];

fn listening(port: u16) -> bool {
    LOOPBACK
        .iter()
        .any(|host| TcpStream::connect_timeout(&SocketAddr::new(*host, port), POLL).is_ok())
}

fn state(servers: &DesignServers, checkout: &str, port: u16) -> StudioResult<ServerState> {
    let mut table = servers.0.lock().map_err(|_| StudioError::Poisoned)?;
    let mut log = Vec::new();
    let mut managed = false;
    let mut exited = false;

    if let Some(server) = table.get_mut(checkout) {
        log = server.log.lock().map_err(|_| StudioError::Poisoned)?.clone();
        managed = matches!(server.child.try_wait(), Ok(None));
        exited = !managed;
    }

    let listening = listening(port);

    Ok(ServerState {
        port,
        listening,
        managed,
        foreign: listening && !managed,
        stale: false,
        exited,
        log,
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

/// A listening server is stale when it answers no stamp, or one that differs from the stamp of the
/// cli Studio would start it with. A cli that cannot print its own stamp cannot be compared with.
async fn is_stale(checkout: &str, port: u16) -> bool {
    let Ok(Some(served)) = tokio::task::spawn_blocking(move || served_stamp(port)).await else {
        return true;
    };

    match own_stamp(checkout).await {
        Some(own) => own != served,
        None => false,
    }
}

async fn judged(servers: &DesignServers, checkout: &str, port: u16) -> StudioResult<ServerState> {
    let mut current = state(servers, checkout, port)?;

    if current.listening {
        current.stale = is_stale(checkout, port).await;
    }

    Ok(current)
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

        while Instant::now() < deadline && listening(port) {
            tokio::time::sleep(POLL).await;
        }

        if !listening(port) {
            return;
        }
    }
}

#[cfg(not(unix))]
async fn stop_port(_port: u16) {}

fn collect<R: AsyncRead + Unpin + Send + 'static>(source: R, log: Arc<Mutex<Vec<String>>>) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(source).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(mut log) = log.lock() else {
                return;
            };

            log.push(line);

            let overflow = log.len().saturating_sub(LOG_LINES);

            log.drain(..overflow);
        }
    });
}

/// Studio runs the design tool itself, so a checkout needs no script and no design tooling of its
/// own. Node is the one thing the machine must still carry.
fn spawn(servers: &DesignServers, checkout: &str) -> StudioResult<()> {
    let entry = cli_entry(Path::new(checkout)).ok_or_else(|| {
        StudioError::Rejected(format!(
            "No copy of @ethlete/cli is reachable for {checkout}. Build one with \
             `npx nx cli-runtime ethlete-studio`, or point ETHLETE_CLI at a src/index.js."
        ))
    })?;

    let mut command = crate::child_env::command("node");

    command
        .arg(&entry)
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
    let log = Arc::new(Mutex::new(Vec::new()));

    if let Some(stdout) = child.stdout.take() {
        collect(stdout, log.clone());
    }

    if let Some(stderr) = child.stderr.take() {
        collect(stderr, log.clone());
    }

    servers.0.lock().map_err(|_| StudioError::Poisoned)?.insert(
        checkout.to_owned(),
        Server {
            child,
            _stdin: stdin,
            log,
        },
    );

    Ok(())
}

async fn await_listening(servers: &DesignServers, checkout: &str, port: u16) {
    let deadline = Instant::now() + START_TIMEOUT;

    while Instant::now() < deadline {
        if listening(port) {
            return;
        }

        if state(servers, checkout, port).is_ok_and(|read| read.exited) {
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

async fn end(child: &mut Child) {
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
    let Ok(mut table) = servers.0.lock() else {
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
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;

    judged(servers.inner(), &checkout, port).await
}

/// Starts the checkout's design server and answers once it accepts connections. A server that
/// already listens is left alone, whoever started it.
#[tauri::command]
pub async fn design_server_start(
    servers: tauri::State<'_, DesignServers>,
    checkout: String,
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;
    let current = state(servers.inner(), &checkout, port)?;

    if current.listening || current.managed {
        return Ok(current);
    }

    spawn(servers.inner(), &checkout)?;
    await_listening(servers.inner(), &checkout, port).await;

    state(servers.inner(), &checkout, port)
}

/// Stops the server this Studio started. A server somebody else started stays up.
#[tauri::command]
pub async fn design_server_stop(
    servers: tauri::State<'_, DesignServers>,
    checkout: String,
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;
    let taken = servers.0.lock().map_err(|_| StudioError::Poisoned)?.remove(&checkout);

    if let Some(mut server) = taken {
        end(&mut server.child).await;
    }

    state(servers.inner(), &checkout, port)
}

/// Stops whatever listens on the checkout's port, then starts the server Studio owns.
#[tauri::command]
pub async fn design_server_restart(
    servers: tauri::State<'_, DesignServers>,
    checkout: String,
) -> StudioResult<ServerState> {
    let port = port_of_checkout(&checkout)?;
    let taken = servers.0.lock().map_err(|_| StudioError::Poisoned)?.remove(&checkout);

    if let Some(mut server) = taken {
        end(&mut server.child).await;
    }

    if listening(port) {
        stop_port(port).await;
    }

    if listening(port) {
        return Err(StudioError::Rejected(format!(
            "Port {port} is still in use after stopping its listener."
        )));
    }

    spawn(servers.inner(), &checkout)?;
    await_listening(servers.inner(), &checkout, port).await;

    judged(servers.inner(), &checkout, port).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::process::Command;

    #[test]
    fn a_checkout_nobody_started_reads_as_not_managed() {
        let servers = DesignServers::default();
        let read = state(&servers, "/nowhere", 65000).expect("a state");

        assert!(!read.managed);
        assert!(!read.listening);
        assert_eq!(read.port, 65000);
        assert!(read.log.is_empty());
    }

    #[test]
    fn a_port_that_answers_on_the_ipv6_loopback_reads_as_listening() {
        let Ok(listener) = std::net::TcpListener::bind("[::1]:0") else {
            return;
        };

        assert!(listening(listener.local_addr().expect("an address").port()));
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
            if !listening(port) {
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

        spawn(&servers, &checkout).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        let mut read = state(&servers, &checkout, PORT).expect("a state");

        for _ in 0..20 {
            if !read.log.is_empty() {
                break;
            }

            tokio::time::sleep(POLL).await;
            read = state(&servers, &checkout, PORT).expect("a state");
        }

        assert!(read.exited);
        assert!(!read.managed);
        assert!(read.log.iter().any(|line| line.contains("EMFILE")));

        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn a_checkout_is_served_by_its_design_tool_and_the_stop_reaches_the_whole_group() {
        const PORT: u16 = 45872;

        let checkout = fake_checkout(PORT);
        let servers = DesignServers::default();

        spawn(&servers, &checkout).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        assert!(listening(PORT), "the design tool never answered");
        assert!(state(&servers, &checkout, PORT).expect("a state").managed);

        let taken = servers.0.lock().expect("the table").remove(&checkout);

        end(&mut taken.expect("the server").child).await;
        await_stopped(PORT).await;

        assert!(!listening(PORT), "the server the design tool started is still up");
        assert!(!state(&servers, &checkout, PORT).expect("a state").managed);

        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn the_app_leaves_no_server_behind_when_it_exits() {
        const PORT: u16 = 45873;

        let checkout = fake_checkout(PORT);
        let servers = DesignServers::default();

        spawn(&servers, &checkout).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        assert!(listening(PORT), "the design tool never answered");

        stop_every(&servers);
        await_stopped(PORT).await;

        assert!(!listening(PORT), "a server outlived the app");
        assert!(!state(&servers, &checkout, PORT).expect("a state").managed);

        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn a_server_stops_when_the_app_dies_without_stopping_it() {
        const PORT: u16 = 45877;

        let checkout = fake_checkout(PORT);
        let servers = DesignServers::default();

        spawn(&servers, &checkout).expect("the design tool runs");
        await_listening(&servers, &checkout, PORT).await;

        assert!(listening(PORT), "the design tool never answered");

        servers
            .0
            .lock()
            .expect("the servers")
            .get_mut(&checkout)
            .expect("a server")
            ._stdin
            .take();
        await_stopped(PORT).await;

        assert!(!listening(PORT), "a server outlived its stdin");

        stop_every(&servers);
        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[test]
    fn a_checkout_no_design_tool_can_be_found_for_is_refused() {
        let bare = std::env::temp_dir().join(format!("studio-design-server-bare-{}", std::process::id()));

        std::fs::create_dir_all(&bare).expect("a temporary checkout");

        let refused = spawn(&DesignServers::default(), &bare.to_string_lossy());

        assert!(matches!(refused, Err(StudioError::Rejected(_))));

        let _ = std::fs::remove_dir_all(&bare);
    }

    #[test]
    fn the_pids_are_read_out_of_ss_output() {
        let text = "LISTEN 0 511 [::1]:4402 [::]:* users:((\"node\",pid=4242,fd=19),(\"node\",pid=4243,fd=20))\n";

        assert_eq!(parse_ss_pids(text), vec![4242, 4243]);
        assert!(parse_ss_pids("").is_empty());
    }

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

        let read = state(&DesignServers::default(), &checkout, PORT).expect("a state");

        assert!(read.listening && read.foreign && !read.managed);

        stop_port(PORT).await;
        await_stopped(PORT).await;

        assert!(!listening(PORT), "the foreign server is still up");

        let _ = foreign.wait().await;
        let _ = std::fs::remove_dir_all(&checkout);
    }

    #[tokio::test]
    async fn the_log_keeps_only_the_last_lines() {
        let printed: String = (0..LOG_LINES + 10).map(|line| format!("{line}\n")).collect();
        let log = Arc::new(Mutex::new(Vec::new()));

        collect(std::io::Cursor::new(printed.into_bytes()), log.clone());

        for _ in 0..40 {
            if log.lock().expect("the log").len() == LOG_LINES {
                break;
            }

            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        let held = log.lock().expect("the log");

        assert_eq!(held.len(), LOG_LINES);
        assert_eq!(held[0], "10");
    }
}
