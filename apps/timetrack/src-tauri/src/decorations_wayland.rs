use crate::decorations::WindowCapabilities;
use wayland_client::protocol::{wl_compositor, wl_registry, wl_surface};
use wayland_client::{Connection, Dispatch, Proxy, QueueHandle};
use wayland_protocols::xdg::shell::client::{xdg_surface, xdg_toplevel, xdg_wm_base};

/// The version that added `wm_capabilities`. Below it the compositor advertises nothing.
const CAPABILITIES_SINCE: u32 = 5;

/// The capabilities arrive as an array of 32-bit enum values in the compositor's own endianness.
fn read_capabilities(raw: &[u8]) -> WindowCapabilities {
    let has = |wanted: xdg_toplevel::WmCapabilities| {
        raw.chunks_exact(4)
            .any(|chunk| u32::from_ne_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]) == wanted as u32)
    };

    WindowCapabilities {
        minimize: has(xdg_toplevel::WmCapabilities::Minimize),
        maximize: has(xdg_toplevel::WmCapabilities::Maximize),
        fullscreen: has(xdg_toplevel::WmCapabilities::Fullscreen),
    }
}

struct ProbeState {
    compositor: Option<wl_compositor::WlCompositor>,
    base: Option<xdg_wm_base::XdgWmBase>,
    capabilities: Option<WindowCapabilities>,
}

impl Dispatch<wl_registry::WlRegistry, ()> for ProbeState {
    fn event(
        state: &mut Self,
        registry: &wl_registry::WlRegistry,
        event: wl_registry::Event,
        _: &(),
        _: &Connection,
        qh: &QueueHandle<Self>,
    ) {
        let wl_registry::Event::Global {
            name,
            interface,
            version,
        } = event
        else {
            return;
        };

        match interface.as_str() {
            "wl_compositor" if state.compositor.is_none() => {
                state.compositor = Some(registry.bind(name, version.min(4), qh, ()));
            }
            "xdg_wm_base" if state.base.is_none() => {
                state.base = Some(registry.bind(name, version.min(6), qh, ()));
            }
            _ => {}
        }
    }
}

impl Dispatch<xdg_wm_base::XdgWmBase, ()> for ProbeState {
    fn event(
        _: &mut Self,
        base: &xdg_wm_base::XdgWmBase,
        event: xdg_wm_base::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        if let xdg_wm_base::Event::Ping { serial } = event {
            base.pong(serial);
        }
    }
}

impl Dispatch<xdg_surface::XdgSurface, ()> for ProbeState {
    fn event(
        _: &mut Self,
        surface: &xdg_surface::XdgSurface,
        event: xdg_surface::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        if let xdg_surface::Event::Configure { serial } = event {
            surface.ack_configure(serial);
        }
    }
}

impl Dispatch<xdg_toplevel::XdgToplevel, ()> for ProbeState {
    fn event(
        state: &mut Self,
        _: &xdg_toplevel::XdgToplevel,
        event: xdg_toplevel::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        if let xdg_toplevel::Event::WmCapabilities { capabilities } = event {
            state.capabilities = Some(read_capabilities(&capabilities));
        }
    }
}

impl Dispatch<wl_compositor::WlCompositor, ()> for ProbeState {
    fn event(
        _: &mut Self,
        _: &wl_compositor::WlCompositor,
        _: wl_compositor::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
    }
}

impl Dispatch<wl_surface::WlSurface, ()> for ProbeState {
    fn event(
        _: &mut Self,
        _: &wl_surface::WlSurface,
        _: wl_surface::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
    }
}

fn run() -> Option<WindowCapabilities> {
    let connection = Connection::connect_to_env().ok()?;
    let mut queue = connection.new_event_queue();
    let qh = queue.handle();

    connection.display().get_registry(&qh, ());

    let mut state = ProbeState {
        compositor: None,
        base: None,
        capabilities: None,
    };

    queue.roundtrip(&mut state).ok()?;

    let compositor = state.compositor.clone()?;
    let base = state.base.clone()?;

    if base.version() < CAPABILITIES_SINCE {
        return None;
    }

    // Nothing is ever attached to this surface, which is the only reason the probe stays invisible:
    // a toplevel becomes mapped on its first committed buffer, and this one would flash on screen.
    let surface = compositor.create_surface(&qh, ());
    let shell_surface = base.get_xdg_surface(&surface, &qh, ());
    let toplevel = shell_surface.get_toplevel(&qh, ());

    surface.commit();
    queue.roundtrip(&mut state).ok()?;

    toplevel.destroy();
    shell_surface.destroy();
    surface.destroy();

    state.capabilities
}

/// Asks the compositor which window-manager capabilities it backs, via a toplevel that is created,
/// configured and destroyed without ever being mapped.
///
/// `None` means the question could not be answered — a compositor too old to advertise, or no Wayland
/// socket at all — and the caller is expected to assume everything rather than nothing.
pub fn probe() -> Option<WindowCapabilities> {
    std::panic::catch_unwind(run).ok().flatten()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(capabilities: &[xdg_toplevel::WmCapabilities]) -> Vec<u8> {
        capabilities
            .iter()
            .flat_map(|capability| (*capability as u32).to_ne_bytes())
            .collect()
    }

    #[test]
    fn reads_the_capabilities_the_compositor_listed() {
        let parsed = read_capabilities(&raw(&[
            xdg_toplevel::WmCapabilities::Maximize,
            xdg_toplevel::WmCapabilities::Fullscreen,
        ]));

        assert!(parsed.maximize);
        assert!(parsed.fullscreen);
        assert!(!parsed.minimize);
    }

    #[test]
    fn reads_an_empty_list_as_nothing_allowed() {
        let parsed = read_capabilities(&[]);

        assert!(!parsed.minimize);
        assert!(!parsed.maximize);
        assert!(!parsed.fullscreen);
    }

    #[test]
    fn ignores_a_capability_it_does_not_render() {
        let parsed = read_capabilities(&raw(&[xdg_toplevel::WmCapabilities::WindowMenu]));

        assert!(!parsed.minimize);
        assert!(!parsed.maximize);
        assert!(!parsed.fullscreen);
    }
}
