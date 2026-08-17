import { getCurrentWindow } from '@tauri-apps/api/window';

/** The label `widget.rs` builds the floating window with. Both sides read the same string. */
export const WIDGET_WINDOW_LABEL = 'widget';

/**
 * Whether this webview is the floating readout rather than the app.
 *
 * A browser tab has no window to ask, and it is the app that a tab should show — a story or a `serve`
 * has nothing to publish a readout to it.
 */
export const isWidgetWindow = () =>
  '__TAURI_INTERNALS__' in globalThis && getCurrentWindow().label === WIDGET_WINDOW_LABEL;
