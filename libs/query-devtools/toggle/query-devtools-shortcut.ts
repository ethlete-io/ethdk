import { detectKbdPlatform } from '@ethlete/components';

/**
 * The global devtools toggle shortcut, rendered for the current platform (`⌘⌥Q` on Apple, where the
 * symbols are the convention, `Ctrl+Alt+Q` everywhere else). Shown on both the floating toggle and
 * the panel's close button so the shortcut is discoverable without reading the docs.
 */
export const queryDevtoolsShortcutLabel = () => (detectKbdPlatform() === 'apple' ? '⌘⌥Q' : 'Ctrl+Alt+Q');

/**
 * Whether a `keydown` is the devtools toggle shortcut (`Ctrl/Cmd + Alt + Q`). AltGr is rejected: Windows
 * reports it as Ctrl+Alt, and AltGr+Q types `@` on a German layout.
 */
export const isQueryDevtoolsShortcut = (e: KeyboardEvent) =>
  (e.ctrlKey || e.metaKey) &&
  e.altKey &&
  !e.getModifierState('AltGraph') &&
  (e.code === 'KeyQ' || e.key.toLowerCase() === 'q');
