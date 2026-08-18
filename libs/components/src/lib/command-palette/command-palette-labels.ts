import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** Every string the command palette renders itself. The commands are yours. */
export type CommandPaletteLabels = {
  /** Placeholder of the search field. */
  placeholder: string;
  /** Accessible name of the search field, which has no visible label. */
  searchLabel: string;
  /** Shown in place of the list when no command matches the query. */
  empty: string;
  /** Shown in place of the list when nothing is registered at all. */
  noCommands: string;
};

/** The built-in English labels. */
export const DEFAULT_COMMAND_PALETTE_LABELS: CommandPaletteLabels = {
  placeholder: 'Search for a command…',
  searchLabel: 'Search for a command',
  empty: 'No matching command',
  noCommands: 'No commands available',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_COMMAND_PALETTE_LABELS: CommandPaletteLabels = {
  placeholder: 'Nach einem Befehl suchen…',
  searchLabel: 'Nach einem Befehl suchen',
  empty: 'Kein passender Befehl',
  noCommands: 'Keine Befehle verfügbar',
};

/** The label set for a locale. Anything other than English and German needs {@link provideCommandPaletteLabels}. */
export const commandPaletteLabelsForLocale = (locale: string): CommandPaletteLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_COMMAND_PALETTE_LABELS : DEFAULT_COMMAND_PALETTE_LABELS;

const COMMAND_PALETTE_LABELS_DEF = /* @__PURE__ */ defineLabels<CommandPaletteLabels>(
  'COMMAND_PALETTE_LABELS',
  commandPaletteLabelsForLocale,
);

/**
 * Localize the command palette's strings below this injector, and read the set in effect here as a
 * signal. Partial - what you leave out keeps the value the current locale gives it. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideCommandPaletteLabels({ placeholder: 'Rechercher une commande…' });
 */
export const provideCommandPaletteLabels = /* @__PURE__ */ toProvideFn(COMMAND_PALETTE_LABELS_DEF);
export const injectCommandPaletteLabels = /* @__PURE__ */ toInjectFn(COMMAND_PALETTE_LABELS_DEF);
export const COMMAND_PALETTE_LABELS = /* @__PURE__ */ toToken(COMMAND_PALETTE_LABELS_DEF);
