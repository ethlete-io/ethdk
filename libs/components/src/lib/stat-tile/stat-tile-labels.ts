import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings a stat tile renders for assistive tech. Its label, value and caption are yours. */
export type StatTileLabels = {
  /** Read before a delta that went up. */
  up: string;
  /** Read before a delta that went down. */
  down: string;
  /** Read before a delta of zero. */
  unchanged: string;
  /** Read in place of the dash a tile shows when its value is `null`. */
  noValue: string;
};

/** The built-in English labels. */
export const DEFAULT_STAT_TILE_LABELS: StatTileLabels = {
  up: 'Up',
  down: 'Down',
  unchanged: 'Unchanged',
  noValue: 'No value',
};

const STAT_TILE_LABELS_DEF = /* @__PURE__ */ defineLabels<StatTileLabels>('STAT_TILE_LABELS', DEFAULT_STAT_TILE_LABELS);

/**
 * Localize a stat tile's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_STAT_TILE_LABELS} value.
 *
 * @example
 * provideStatTileLabels({ up: 'Gestiegen', down: 'Gesunken' });
 */
export const provideStatTileLabels = /* @__PURE__ */ toProvideFn(STAT_TILE_LABELS_DEF);
export const injectStatTileLabels = /* @__PURE__ */ toInjectFn(STAT_TILE_LABELS_DEF);
export const STAT_TILE_LABELS = /* @__PURE__ */ toToken(STAT_TILE_LABELS_DEF);
