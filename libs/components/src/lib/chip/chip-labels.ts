import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings a chip renders itself. Its content is yours; the remove button is the chip's own. */
export type ChipLabels = {
  /** Accessible label for a removable chip's remove button. */
  remove: string;
};

/** The built-in English labels. */
export const DEFAULT_CHIP_LABELS: ChipLabels = {
  remove: 'Remove',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_CHIP_LABELS: ChipLabels = {
  remove: 'Entfernen',
};

/** The label set for a locale. Anything other than English and German needs {@link provideChipLabels}. */
export const chipLabelsForLocale = (locale: string): ChipLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_CHIP_LABELS : DEFAULT_CHIP_LABELS;

const CHIP_LABELS_DEF = /* @__PURE__ */ defineLabels<ChipLabels>('CHIP_LABELS', chipLabelsForLocale);

/**
 * Localize a chip's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_CHIP_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideChipLabels({ remove: 'Entfernen' });
 */
export const provideChipLabels = /* @__PURE__ */ toProvideFn(CHIP_LABELS_DEF);
export const injectChipLabels = /* @__PURE__ */ toInjectFn(CHIP_LABELS_DEF);
export const CHIP_LABELS = /* @__PURE__ */ toToken(CHIP_LABELS_DEF);
