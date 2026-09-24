use super::NiriPlacement;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::ffi::OsString;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};

const DEBOUNCE: Duration = Duration::from_secs(1);

const RESTORE_WINDOW: Duration = Duration::from_secs(5);

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
struct Workspace {
    id: u64,
    idx: u8,
    name: Option<String>,
    output: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
struct Layout {
    tile_pos_in_workspace_view: Option<(f64, f64)>,
    window_size: (i32, i32),
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize)]
struct NiriWindow {
    id: u64,
    title: Option<String>,
    pid: Option<u32>,
    workspace_id: Option<u64>,
    layout: Layout,
}

#[derive(Debug, PartialEq, Deserialize)]
enum Event {
    WorkspacesChanged { workspaces: Vec<Workspace> },
    WindowsChanged { windows: Vec<NiriWindow> },
    WindowOpenedOrChanged { window: NiriWindow },
    WindowClosed { id: u64 },
    WindowLayoutsChanged { changes: Vec<(u64, Layout)> },
}

fn parse(line: &str) -> Option<Event> {
    serde_json::from_str(line).ok()
}

enum Restore {
    Pending(NiriPlacement),
    Moving {
        target: u64,
        saved: NiriPlacement,
        since: Instant,
    },
    Done,
}

struct Tracker {
    pid: u32,
    title: String,
    workspaces: Vec<Workspace>,
    windows: HashMap<u64, NiriWindow>,
    restore: Restore,
    recorded: Option<NiriPlacement>,
}

impl Tracker {
    fn apply(&mut self, event: Event) {
        match event {
            Event::WorkspacesChanged { workspaces } => self.workspaces = workspaces,
            Event::WindowsChanged { windows } => {
                self.windows = windows.into_iter().map(|window| (window.id, window)).collect();
            }
            Event::WindowOpenedOrChanged { window } => {
                self.windows.insert(window.id, window);
            }
            Event::WindowClosed { id } => {
                self.windows.remove(&id);
            }
            Event::WindowLayoutsChanged { changes } => {
                for (id, layout) in changes {
                    if let Some(window) = self.windows.get_mut(&id) {
                        window.layout = layout;
                    }
                }
            }
        }
    }

    fn ours(&self) -> Option<&NiriWindow> {
        self.windows
            .values()
            .find(|window| window.pid == Some(self.pid) && window.title.as_deref() == Some(self.title.as_str()))
    }
}

/// Nothing hooks the exit: `tauri dev` kills the process on every rebuild, so the record is written
/// while the app runs.
pub fn start<R: Runtime>(app: AppHandle<R>, title: String, saved: Option<NiriPlacement>) {
    let Some(socket) = std::env::var_os("NIRI_SOCKET") else {
        return;
    };

    let spawned = std::thread::Builder::new()
        .name("niri-placement".into())
        .spawn(move || {
            if let Err(error) = follow(&app, &socket, title, saved) {
                eprintln!("stopped following the window on niri: {error}");
            }
        });

    if let Err(error) = spawned {
        eprintln!("could not follow the window on niri: {error}");
    }
}

fn follow<R: Runtime>(
    app: &AppHandle<R>,
    socket: &OsString,
    title: String,
    saved: Option<NiriPlacement>,
) -> std::io::Result<()> {
    let mut stream = UnixStream::connect(socket)?;

    stream.write_all(b"\"EventStream\"\n")?;

    let (sender, events) = mpsc::channel();
    let mut lines = BufReader::new(stream).lines();

    // The first line answers the request; the events follow it.
    lines.next().transpose()?;

    std::thread::Builder::new().name("niri-events".into()).spawn(move || {
        for line in lines.map_while(Result::ok) {
            if let Some(event) = parse(&line) {
                if sender.send(event).is_err() {
                    return;
                }
            }
        }
    })?;

    let mut tracker = Tracker {
        pid: std::process::id(),
        title,
        workspaces: Vec::new(),
        windows: HashMap::new(),
        restore: saved.map_or(Restore::Done, Restore::Pending),
        recorded: None,
    };
    let mut due: Option<(Instant, NiriPlacement)> = None;

    loop {
        let wait = due.as_ref().map_or(Duration::from_secs(3600), |(at, _)| {
            at.saturating_duration_since(Instant::now())
        });

        match events.recv_timeout(wait) {
            Ok(event) => {
                tracker.apply(event);
                step(socket, &mut tracker);

                if let Some(next) = record(&mut tracker) {
                    due = Some((Instant::now() + DEBOUNCE, next));
                }
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => return Ok(()),
        }

        if let Some((at, niri)) = due.take() {
            if Instant::now() < at {
                due = Some((at, niri));
            } else if !super::remember_niri(app, niri.clone()) {
                due = Some((Instant::now() + DEBOUNCE, niri));
            }
        }
    }
}

fn step(socket: &OsString, tracker: &mut Tracker) {
    let Some(window) = tracker.ours().cloned() else {
        return;
    };

    match std::mem::replace(&mut tracker.restore, Restore::Done) {
        Restore::Pending(saved) => match pick_workspace(&saved, &tracker.workspaces) {
            Some(target) if window.workspace_id != Some(target) => {
                let moved = action(
                    socket,
                    json!({ "MoveWindowToWorkspace": {
                        "window_id": window.id,
                        "reference": { "Id": target },
                        "focus": false,
                    } }),
                );

                if moved.is_ok() {
                    tracker.restore = Restore::Moving {
                        target,
                        saved,
                        since: Instant::now(),
                    };
                }
            }
            _ => place(socket, &window, &saved),
        },
        Restore::Moving { target, saved, since } => {
            if window.workspace_id == Some(target) {
                place(socket, &window, &saved);
            } else if since.elapsed() < RESTORE_WINDOW {
                tracker.restore = Restore::Moving { target, saved, since };
            }
        }
        Restore::Done => {}
    }
}

fn place(socket: &OsString, window: &NiriWindow, saved: &NiriPlacement) {
    for request in placement_actions(window, saved) {
        let _ = action(socket, request);
    }
}

/// The position is moved by the difference rather than set: niri's fixed position counts from the
/// working area, the one it reports from the workspace view, and the offset between the two (a bar's
/// exclusive zone) is not reported.
fn placement_actions(window: &NiriWindow, saved: &NiriPlacement) -> Vec<Value> {
    let mut requests = Vec::new();

    if let (Some((width, height)), (current_width, current_height)) = (saved.size, window.layout.window_size) {
        if width != current_width {
            requests.push(json!({ "SetWindowWidth": { "id": window.id, "change": { "SetFixed": width } } }));
        }
        if height != current_height {
            requests.push(json!({ "SetWindowHeight": { "id": window.id, "change": { "SetFixed": height } } }));
        }
    }

    if let (Some((x, y)), Some((current_x, current_y))) = (saved.position, window.layout.tile_pos_in_workspace_view) {
        let (dx, dy) = (x - current_x, y - current_y);

        if dx.abs() >= 0.5 || dy.abs() >= 0.5 {
            requests.push(json!({ "MoveFloatingWindow": {
                "id": window.id,
                "x": { "AdjustFixed": dx },
                "y": { "AdjustFixed": dy },
            } }));
        }
    }

    requests
}

fn pick_workspace(saved: &NiriPlacement, workspaces: &[Workspace]) -> Option<u64> {
    let by_id = saved
        .workspace_id
        .and_then(|id| workspaces.iter().find(|workspace| workspace.id == id));
    let by_name = saved.workspace_name.as_ref().and_then(|name| {
        workspaces
            .iter()
            .find(|workspace| workspace.name.as_ref() == Some(name))
    });
    let by_index = saved.workspace_idx.and_then(|idx| {
        workspaces
            .iter()
            .find(|workspace| workspace.idx == idx && saved.output.is_some() && workspace.output == saved.output)
    });

    by_id.or(by_name).or(by_index).map(|workspace| workspace.id)
}

fn record(tracker: &mut Tracker) -> Option<NiriPlacement> {
    if !matches!(tracker.restore, Restore::Done) {
        return None;
    }

    let window = tracker.ours()?;
    let workspace = tracker
        .workspaces
        .iter()
        .find(|workspace| Some(workspace.id) == window.workspace_id);
    let niri = NiriPlacement {
        workspace_id: window.workspace_id,
        workspace_idx: workspace.map(|workspace| workspace.idx),
        workspace_name: workspace.and_then(|workspace| workspace.name.clone()),
        output: workspace.and_then(|workspace| workspace.output.clone()),
        position: window.layout.tile_pos_in_workspace_view,
        size: Some(window.layout.window_size),
    };

    if tracker.recorded.as_ref() == Some(&niri) {
        return None;
    }

    tracker.recorded = Some(niri.clone());

    Some(niri)
}

fn action(socket: &OsString, request: Value) -> std::io::Result<()> {
    let mut stream = UnixStream::connect(socket)?;

    stream.write_all(format!("{}\n", json!({ "Action": request })).as_bytes())?;

    let mut reply = String::new();

    BufReader::new(stream).read_line(&mut reply)?;

    if reply.contains("\"Ok\"") {
        Ok(())
    } else {
        Err(std::io::Error::other(reply.trim().to_owned()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn workspace(id: u64, idx: u8, output: &str) -> Workspace {
        Workspace {
            id,
            idx,
            name: None,
            output: Some(output.to_owned()),
        }
    }

    fn saved(id: u64, idx: u8, output: &str) -> NiriPlacement {
        NiriPlacement {
            workspace_id: Some(id),
            workspace_idx: Some(idx),
            output: Some(output.to_owned()),
            ..NiriPlacement::default()
        }
    }

    fn window_at(x: f64, y: f64, width: i32, height: i32) -> NiriWindow {
        NiriWindow {
            id: 17,
            layout: Layout {
                tile_pos_in_workspace_view: Some((x, y)),
                window_size: (width, height),
            },
            ..NiriWindow::default()
        }
    }

    #[test]
    fn returns_to_the_same_workspace_while_niri_still_has_it() {
        let workspaces = [workspace(1, 1, "DP-1"), workspace(7, 3, "DP-1")];

        assert_eq!(pick_workspace(&saved(7, 2, "DP-1"), &workspaces), Some(7));
    }

    #[test]
    fn falls_back_to_the_same_index_on_the_same_output() {
        let workspaces = [
            workspace(1, 1, "DP-1"),
            workspace(2, 2, "HDMI-A-1"),
            workspace(3, 2, "DP-1"),
        ];

        assert_eq!(pick_workspace(&saved(9, 2, "DP-1"), &workspaces), Some(3));
    }

    #[test]
    fn prefers_a_named_workspace_over_an_index() {
        let mut named = workspace(5, 4, "DP-1");
        named.name = Some("time".to_owned());
        let workspaces = [workspace(3, 2, "DP-1"), named];
        let placement = NiriPlacement {
            workspace_name: Some("time".to_owned()),
            ..saved(9, 2, "DP-1")
        };

        assert_eq!(pick_workspace(&placement, &workspaces), Some(5));
    }

    #[test]
    fn leaves_the_window_where_niri_opened_it_when_nothing_matches() {
        let workspaces = [workspace(1, 1, "HDMI-A-1")];

        assert_eq!(pick_workspace(&saved(9, 2, "DP-1"), &workspaces), None);
    }

    #[test]
    fn moves_the_window_by_the_difference_to_the_saved_position() {
        let placement = NiriPlacement {
            position: Some((1458.4, 472.8)),
            size: Some((1180, 820)),
            ..NiriPlacement::default()
        };

        let requests = placement_actions(&window_at(1000.0, 438.4, 1180, 820), &placement);

        assert_eq!(requests.len(), 1);
        let x = requests[0]["MoveFloatingWindow"]["x"]["AdjustFixed"].as_f64().unwrap();
        let y = requests[0]["MoveFloatingWindow"]["y"]["AdjustFixed"].as_f64().unwrap();
        assert!((x - 458.4).abs() < 1e-6 && (y - 34.4).abs() < 1e-6);
    }

    #[test]
    fn resizes_a_window_that_opened_at_another_size() {
        let placement = NiriPlacement {
            size: Some((1180, 820)),
            ..NiriPlacement::default()
        };

        let requests = placement_actions(&window_at(0.0, 0.0, 900, 820), &placement);

        assert_eq!(
            requests,
            vec![json!({ "SetWindowWidth": { "id": 17, "change": { "SetFixed": 1180 } } })]
        );
    }

    #[test]
    fn parses_the_events_it_follows_and_skips_the_rest() {
        let layouts = r#"{"WindowLayoutsChanged":{"changes":[[17,{"pos_in_scrolling_layout":null,"tile_size":[1180.0,820.0],"window_size":[1180,820],"tile_pos_in_workspace_view":[1000.0,438.4],"window_offset_in_tile":[0.0,0.0]}]]}}"#;

        assert_eq!(
            parse(layouts),
            Some(Event::WindowLayoutsChanged {
                changes: vec![(
                    17,
                    Layout {
                        tile_pos_in_workspace_view: Some((1000.0, 438.4)),
                        window_size: (1180, 820),
                    }
                )]
            })
        );
        assert_eq!(parse(r#"{"OverviewOpenedOrClosed":{"is_open":false}}"#), None);
    }

    #[test]
    fn records_nothing_until_the_restore_is_done() {
        let mut window = window_at(10.0, 20.0, 1180, 820);
        window.pid = Some(1);
        window.title = Some("Timetrack".to_owned());
        window.workspace_id = Some(2);
        let mut tracker = Tracker {
            pid: 1,
            title: "Timetrack".to_owned(),
            workspaces: vec![workspace(2, 2, "DP-1")],
            windows: HashMap::from([(17, window)]),
            restore: Restore::Pending(NiriPlacement::default()),
            recorded: None,
        };

        assert_eq!(record(&mut tracker), None);

        tracker.restore = Restore::Done;

        assert_eq!(
            record(&mut tracker),
            Some(NiriPlacement {
                position: Some((10.0, 20.0)),
                size: Some((1180, 820)),
                ..saved(2, 2, "DP-1")
            })
        );
        assert_eq!(record(&mut tracker), None);
    }
}
