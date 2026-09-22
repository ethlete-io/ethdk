use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, TcpStream};
use std::path::Path;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::{Child, Command};

use crate::design::{port_of, read_config};
use crate::error::{StudioError, StudioResult};
use crate::tools::cli_entry;

/// Enough of the server's output to read a failure, short enough to send on every poll.
const LOG_LINES: usize = 40;

/// A cold start builds the design page, so the first answer takes far longer than a restart.
const START_TIMEOUT: Duration = Duration::from_secs(90);

const POLL: Duration = Duration::from_millis(250);

const STOP_GRACE: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerState {
    pub port: u16,
    pub listening: bool,
    /// True when this Studio started the server. Only then can Studio stop it again.
    pub managed: bool,
    pub log: Vec<String>,
}

struct Server {
    child: Child,
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

    if let Some(server) = table.get_mut(checkout) {
        log = server.log.lock().map_err(|_| StudioError::Poisoned)?.clone();
        managed = matches!(server.child.try_wait(), Ok(None));

        if !managed {
            table.remove(checkout);
        }
    }

    Ok(ServerState {
        port,
        listening: listening(port),
        managed,
        log,
    })
}

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

    let mut command = Command::new("node");

    command
        .arg(&entry)
        .arg("design")
        .arg(checkout)
        .current_dir(checkout)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // The server starts a bundler, which starts workers of its own, so a stop has to reach the
    // whole group. Its own group is what makes that reachable.
    #[cfg(unix)]
    command.process_group(0);

    let mut child = command.spawn().map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => StudioError::NotInstalled("node".to_owned()),
        _ => StudioError::Io(error),
    })?;

    let log = Arc::new(Mutex::new(Vec::new()));

    if let Some(stdout) = child.stdout.take() {
        collect(stdout, log.clone());
    }

    if let Some(stderr) = child.stderr.take() {
        collect(stderr, log.clone());
    }

    servers
        .0
        .lock()
        .map_err(|_| StudioError::Poisoned)?
        .insert(checkout.to_owned(), Server { child, log });

    Ok(())
}

async fn await_listening(port: u16) {
    let deadline = Instant::now() + START_TIMEOUT;

    while Instant::now() < deadline {
        if listening(port) {
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

    state(servers.inner(), &checkout, port)
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
    await_listening(port).await;

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

#[cfg(test)]
mod tests {
    use super::*;

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
            format!("const {{ createServer }} = require('node:http');\ncreateServer((_, response) => response.end('ok')).listen({port});\n"),
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
    async fn a_checkout_is_served_by_its_design_tool_and_the_stop_reaches_the_whole_group() {
        const PORT: u16 = 45872;

        let checkout = fake_checkout(PORT);
        let servers = DesignServers::default();

        spawn(&servers, &checkout).expect("the design tool runs");
        await_listening(PORT).await;

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
        await_listening(PORT).await;

        assert!(listening(PORT), "the design tool never answered");

        stop_every(&servers);
        await_stopped(PORT).await;

        assert!(!listening(PORT), "a server outlived the app");
        assert!(!state(&servers, &checkout, PORT).expect("a state").managed);

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
