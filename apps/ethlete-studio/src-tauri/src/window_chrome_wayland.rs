use wayland_client::protocol::{wl_compositor, wl_registry, wl_surface};
use wayland_client::{Connection, Dispatch, QueueHandle, WEnum};
use wayland_protocols::xdg::decoration::zv1::client::{zxdg_decoration_manager_v1, zxdg_toplevel_decoration_v1};
use wayland_protocols::xdg::shell::client::{xdg_surface, xdg_toplevel, xdg_wm_base};

use zxdg_toplevel_decoration_v1::Mode;

#[derive(Default)]
struct Probe {
    compositor: Option<wl_compositor::WlCompositor>,
    base: Option<xdg_wm_base::XdgWmBase>,
    decorations: Option<zxdg_decoration_manager_v1::ZxdgDecorationManagerV1>,
    mode: Option<Mode>,
}

impl Dispatch<wl_registry::WlRegistry, ()> for Probe {
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
            "zxdg_decoration_manager_v1" if state.decorations.is_none() => {
                state.decorations = Some(registry.bind(name, 1, qh, ()));
            }
            _ => {}
        }
    }
}

impl Dispatch<xdg_wm_base::XdgWmBase, ()> for Probe {
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

impl Dispatch<xdg_surface::XdgSurface, ()> for Probe {
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

impl Dispatch<zxdg_toplevel_decoration_v1::ZxdgToplevelDecorationV1, ()> for Probe {
    fn event(
        state: &mut Self,
        _: &zxdg_toplevel_decoration_v1::ZxdgToplevelDecorationV1,
        event: zxdg_toplevel_decoration_v1::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        if let zxdg_toplevel_decoration_v1::Event::Configure {
            mode: WEnum::Value(mode),
        } = event
        {
            state.mode = Some(mode);
        }
    }
}

macro_rules! ignore_events {
    ($($proxy:ty),*) => {
        $(
            impl Dispatch<$proxy, ()> for Probe {
                fn event(
                    _: &mut Self,
                    _: &$proxy,
                    _: <$proxy as wayland_client::Proxy>::Event,
                    _: &(),
                    _: &Connection,
                    _: &QueueHandle<Self>,
                ) {
                }
            }
        )*
    };
}

ignore_events!(
    wl_compositor::WlCompositor,
    wl_surface::WlSurface,
    xdg_toplevel::XdgToplevel,
    zxdg_decoration_manager_v1::ZxdgDecorationManagerV1
);

fn run() -> Option<Mode> {
    let connection = Connection::connect_to_env().ok()?;
    let mut queue = connection.new_event_queue();
    let qh = queue.handle();

    connection.display().get_registry(&qh, ());

    let mut state = Probe::default();

    queue.roundtrip(&mut state).ok()?;

    let compositor = state.compositor.clone()?;
    let base = state.base.clone()?;
    let decorations = state.decorations.clone()?;

    // Nothing is ever attached to this surface, so the toplevel is never mapped and never flashes.
    let surface = compositor.create_surface(&qh, ());
    let shell_surface = base.get_xdg_surface(&surface, &qh, ());
    let toplevel = shell_surface.get_toplevel(&qh, ());
    let decoration = decorations.get_toplevel_decoration(&toplevel, &qh, ());

    surface.commit();
    queue.roundtrip(&mut state).ok()?;

    decoration.destroy();
    toplevel.destroy();
    shell_surface.destroy();
    surface.destroy();
    let _ = connection.flush();

    state.mode
}

/// Whether the Wayland compositor, asked without a preference, decorates windows itself (niri's
/// `prefer-no-csd`, sway). `false` without Wayland or without the xdg-decoration protocol.
pub fn prefers_server_side() -> bool {
    run() == Some(Mode::ServerSide)
}
