//! The desktop's own lock, as logind reports it.
//!
//! It is the trigger the idle timer cannot be: idleness is only seen while the window source is
//! running, and a user who locks the screen and walks off has said exactly what they mean.

use crate::lock;
use tauri::{AppHandle, Runtime};
use zbus::blocking::{Connection, MessageIterator};
use zbus::zvariant::OwnedObjectPath;
use zbus::MatchRule;

const LOGIND: &str = "org.freedesktop.login1";
const MANAGER_PATH: &str = "/org/freedesktop/login1";
const MANAGER: &str = "org.freedesktop.login1.Manager";
const SESSION: &str = "org.freedesktop.login1.Session";

/// What logind said about this machine's session.
enum Said {
    Locked,
    Unlocked,
}

fn said(member: &str) -> Option<Said> {
    match member {
        "Lock" => Some(Said::Locked),
        "Unlock" => Some(Said::Unlocked),
        _ => None,
    }
}

/// The session whose lock is this user's, tried three ways.
///
/// `GetSessionByPID` is the obvious one and the least reliable: it answers from the caller's cgroup, and
/// an app started from a terminal, a service or a development server sits outside the graphical
/// session's — on this machine it fails outright. So `XDG_SESSION_ID` is tried first, and the user's own
/// `Display` session last, which is the seat they are actually sitting at.
fn session_path(connection: &Connection) -> zbus::Result<OwnedObjectPath> {
    if let Ok(id) = std::env::var("XDG_SESSION_ID") {
        if let Ok(path) = by_id(connection, &id) {
            return Ok(path);
        }
    }

    if let Ok(path) = by_pid(connection) {
        return Ok(path);
    }

    display_session(connection)
}

fn by_id(connection: &Connection, id: &str) -> zbus::Result<OwnedObjectPath> {
    connection
        .call_method(Some(LOGIND), MANAGER_PATH, Some(MANAGER), "GetSession", &(id))?
        .body()
        .deserialize()
}

fn by_pid(connection: &Connection) -> zbus::Result<OwnedObjectPath> {
    connection
        .call_method(Some(LOGIND), MANAGER_PATH, Some(MANAGER), "GetSessionByPID", &(std::process::id()))?
        .body()
        .deserialize()
}

fn display_session(connection: &Connection) -> zbus::Result<OwnedObjectPath> {
    let user: OwnedObjectPath = connection
        .call_method(Some(LOGIND), MANAGER_PATH, Some(MANAGER), "GetUser", &(unsafe { libc::getuid() }))?
        .body()
        .deserialize()?;
    let display: (String, OwnedObjectPath) = connection
        .call_method(
            Some(LOGIND),
            user.as_ref(),
            Some("org.freedesktop.DBus.Properties"),
            "Get",
            &("org.freedesktop.login1.User", "Display"),
        )?
        .body()
        .deserialize::<zbus::zvariant::Value>()?
        .downcast()?;

    Ok(display.1)
}

fn listen<R: Runtime>(app: &AppHandle<R>) -> zbus::Result<()> {
    let connection = Connection::system()?;
    let path = session_path(&connection)?;
    let rule = MatchRule::builder()
        .msg_type(zbus::message::Type::Signal)
        .sender(LOGIND)?
        .path(path.as_ref())?
        .interface(SESSION)?
        .build();

    for message in MessageIterator::for_match_rule(rule, &connection, None)? {
        let Ok(message) = message else { continue };
        let Some(member) = message.header().member().map(|member| member.to_string()) else {
            continue;
        };

        match said(&member) {
            // The desktop unlocking is not our unlock: ours takes the account password, and following
            // the session's would make this the weaker of the two gates. It only restarts the idle wait.
            Some(Said::Unlocked) => {
                if let Some(state) = tauri::Manager::try_state::<lock::WindowLock>(app) {
                    state.came_back();
                }
            }
            Some(Said::Locked) => lock::lock(app),
            None => {}
        }
    }

    Ok(())
}

/// Watches the session on its own thread, and gives up quietly where there is no logind to watch.
///
/// A desktop with no session manager is not a broken one — it simply never reports a lock, and the idle
/// timer is then the only trigger.
pub fn start<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || {
        if let Err(error) = listen(&app) {
            eprintln!("timetrack: the session lock is not being watched: {error}");
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_two_signals_a_session_lock_sends() {
        assert!(matches!(said("Lock"), Some(Said::Locked)));
        assert!(matches!(said("Unlock"), Some(Said::Unlocked)));
    }

    #[test]
    fn ignores_every_other_thing_a_session_announces() {
        for member in ["PropertiesChanged", "Terminate", "SetIdleHint", "Lockdown"] {
            assert!(said(member).is_none());
        }
    }
}

