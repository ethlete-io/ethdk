/**
 * The global devtools toggle shortcut, rendered for the current platform (`⌘⌥Q` on Apple, where the
 * symbols are the convention, `Ctrl+Alt+Q` everywhere else). Shown on both the floating toggle and
 * the panel's close button so the shortcut is discoverable without reading the docs.
 */
export const queryDevtoolsShortcutLabel = () => {
  if (typeof navigator === 'undefined') return 'Ctrl+Alt+Q';

  // `platform` is deprecated but still the most reliable Apple signal; the UA string is the fallback.
  const isApple = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);

  return isApple ? '⌘⌥Q' : 'Ctrl+Alt+Q';
};
