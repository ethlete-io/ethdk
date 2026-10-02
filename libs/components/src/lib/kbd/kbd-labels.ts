import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** What one key looks like on one platform: the glyph or word printed on the cap, and the name a screen reader says. */
export type KbdKeyRendering = {
  readonly label: string;
  readonly name: string;
};

/** A key's rendering on Apple platforms and everywhere else. */
export type KbdKeyLabels = {
  readonly apple: KbdKeyRendering;
  readonly other: KbdKeyRendering;
};

/** The named keys `et-kbd` knows, by canonical name (`plus` for the `+` key). Any other key is rendered as written. */
export type KbdLabels = {
  mod: KbdKeyLabels;
  meta: KbdKeyLabels;
  ctrl: KbdKeyLabels;
  alt: KbdKeyLabels;
  shift: KbdKeyLabels;
  enter: KbdKeyLabels;
  tab: KbdKeyLabels;
  backspace: KbdKeyLabels;
  delete: KbdKeyLabels;
  esc: KbdKeyLabels;
  space: KbdKeyLabels;
  up: KbdKeyLabels;
  down: KbdKeyLabels;
  left: KbdKeyLabels;
  right: KbdKeyLabels;
  pageup: KbdKeyLabels;
  pagedown: KbdKeyLabels;
  home: KbdKeyLabels;
  end: KbdKeyLabels;
  plus: KbdKeyLabels;
};

const everywhere = (label: string, name = label): KbdKeyLabels => ({
  apple: { label, name },
  other: { label, name },
});

/** The built-in English key names and the glyphs each platform prints. */
export const DEFAULT_KBD_LABELS: KbdLabels = {
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
  plus: /* @__PURE__ */ everywhere('+', 'Plus'),
};

const KBD_LABELS_DEF = /* @__PURE__ */ defineLabels<KbdLabels>('KBD_LABELS', DEFAULT_KBD_LABELS);

/**
 * Localize the printed labels and spoken names of `et-kbd` keys for everything below this injector. Partial
 * per key - a key you leave out keeps its {@link DEFAULT_KBD_LABELS} entry; a key you give replaces both platforms.
 *
 * @example
 * provideKbdLabels({
 *   ctrl: { ...DEFAULT_KBD_LABELS.ctrl, other: { label: 'Strg', name: 'Steuerung' } },
 *   delete: { ...DEFAULT_KBD_LABELS.delete, other: { label: 'Entf', name: 'Entfernen' } },
 * });
 */
export const provideKbdLabels = /* @__PURE__ */ toProvideFn(KBD_LABELS_DEF);
export const injectKbdLabels = /* @__PURE__ */ toInjectFn(KBD_LABELS_DEF);
export const KBD_LABELS = /* @__PURE__ */ toToken(KBD_LABELS_DEF);
