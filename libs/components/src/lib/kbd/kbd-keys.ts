import { InjectionToken } from '@angular/core';

export type KbdPlatform = 'apple' | 'other';

type KbdKeyRendering = {
  readonly label: string;
  readonly name: string;
};

type KbdKeySpec = {
  readonly apple: KbdKeyRendering;
  readonly other: KbdKeyRendering;
};

const everywhere = (label: string, name = label): KbdKeySpec => ({
  apple: { label, name },
  other: { label, name },
});

const KBD_KEY_ALIASES: Record<string, string> = {
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  option: 'alt',
  return: 'enter',
  escape: 'esc',
  del: 'delete',
  spacebar: 'space',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  pgup: 'pageup',
  pgdn: 'pagedown',
  plus: '+',
};

const KBD_KEY_SPECS: Record<string, KbdKeySpec> = {
  mod: { apple: { label: '⌘', name: 'Command' }, other: { label: 'Ctrl', name: 'Control' } },
  meta: { apple: { label: '⌘', name: 'Command' }, other: { label: 'Meta', name: 'Meta' } },
  ctrl: { apple: { label: '⌃', name: 'Control' }, other: { label: 'Ctrl', name: 'Control' } },
  alt: { apple: { label: '⌥', name: 'Option' }, other: { label: 'Alt', name: 'Alt' } },
  shift: { apple: { label: '⇧', name: 'Shift' }, other: { label: 'Shift', name: 'Shift' } },
  enter: { apple: { label: '↵', name: 'Enter' }, other: { label: 'Enter', name: 'Enter' } },
  tab: { apple: { label: '⇥', name: 'Tab' }, other: { label: 'Tab', name: 'Tab' } },
  backspace: { apple: { label: '⌫', name: 'Backspace' }, other: { label: 'Backspace', name: 'Backspace' } },
  delete: { apple: { label: '⌦', name: 'Delete' }, other: { label: 'Del', name: 'Delete' } },
  esc: /* @__PURE__ */ everywhere('Esc', 'Escape'),
  space: /* @__PURE__ */ everywhere('Space'),
  up: /* @__PURE__ */ everywhere('↑', 'Arrow up'),
  down: /* @__PURE__ */ everywhere('↓', 'Arrow down'),
  left: /* @__PURE__ */ everywhere('←', 'Arrow left'),
  right: /* @__PURE__ */ everywhere('→', 'Arrow right'),
  pageup: /* @__PURE__ */ everywhere('PgUp', 'Page up'),
  pagedown: /* @__PURE__ */ everywhere('PgDn', 'Page down'),
  home: /* @__PURE__ */ everywhere('Home'),
  end: /* @__PURE__ */ everywhere('End'),
  '+': /* @__PURE__ */ everywhere('+', 'Plus'),
};

/**
 * Whether the current environment uses Apple's modifier glyphs. Returns `'other'` where there is no
 * `navigator`, so a server render and a non-Apple client agree.
 */
export const detectKbdPlatform = (): KbdPlatform => {
  if (typeof navigator === 'undefined') return 'other';

  // `platform` is deprecated but still the most reliable Apple signal; the UA string is the fallback.
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent) ? 'apple' : 'other';
};

/**
 * The platform whose key glyphs `et-kbd` renders. Defaults to detecting Apple platforms from the
 * browser; provide it to pin the rendering (useful for a server render or a visual test).
 */
export const KBD_PLATFORM = new InjectionToken<KbdPlatform>('KBD_PLATFORM', {
  providedIn: 'root',
  factory: detectKbdPlatform,
});

const resolveKey = (key: string, platform: KbdPlatform): KbdKeyRendering => {
  const trimmed = key.trim();
  const normalized = trimmed.toLowerCase();
  const canonical = KBD_KEY_ALIASES[normalized] ?? normalized;
  const spec = KBD_KEY_SPECS[canonical];

  if (spec) return spec[platform];

  const label = trimmed.length === 1 ? trimmed.toUpperCase() : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  return { label, name: label };
};

/**
 * Splits a chord such as `mod+shift+k` into its keys. Whitespace around a key is ignored; use `plus`
 * for the literal `+` key.
 */
export const parseKbdKeys = (keys: string): string[] =>
  keys
    .split('+')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

/** The glyph or word printed on a key for the given platform, e.g. `mod` → `⌘` on Apple, `Ctrl` elsewhere. */
export const kbdKeyLabel = (key: string, platform: KbdPlatform) => resolveKey(key, platform).label;

/** The spoken name of a key, for the text a screen reader reads in place of the glyph. */
export const kbdKeyName = (key: string, platform: KbdPlatform) => resolveKey(key, platform).name;
