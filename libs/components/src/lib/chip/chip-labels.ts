import { createLabels } from '@ethlete/core';

/** The strings a chip renders itself. Its content is yours; the remove button is the chip's own. */
export type ChipLabels = {
  /** Accessible label for a removable chip's remove button. */
  remove: string;
};

/** The built-in English labels. */
export const DEFAULT_CHIP_LABELS: ChipLabels = {
  remove: 'Remove',
};

/**
 * Localize a chip's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial — whatever you leave out keeps its {@link DEFAULT_CHIP_LABELS} value. See {@link createLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideChipLabels({ remove: 'Entfernen' });
 */
export const [provideChipLabels, injectChipLabels, CHIP_LABELS] = createLabels<ChipLabels>(
  'CHIP_LABELS',
  DEFAULT_CHIP_LABELS,
);
