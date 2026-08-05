import { detectKbdPlatform } from '../kbd/kbd-keys';

/**
 * The global devtools toggle shortcut, rendered for the current platform (`⌘⌥Q` on Apple, where the
 * symbols are the convention, `Ctrl+Alt+Q` everywhere else). Shown on both the floating toggle and
 * the panel's close button so the shortcut is discoverable without reading the docs.
 */
export const queryDevtoolsShortcutLabel = () => (detectKbdPlatform() === 'apple' ? '⌘⌥Q' : 'Ctrl+Alt+Q');
