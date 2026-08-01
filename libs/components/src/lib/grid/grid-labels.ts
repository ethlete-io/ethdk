import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * Every string the grid announces. It renders no text of its own - the items are yours - so these are
 * all accessible labels.
 *
 * They used to live on `GridConfig` next to a `transformer(text, locale)` hook, which asked an app to
 * translate *by matching the English string*. `GridConfig` keeps the registrations and the actions
 * component; the wording lives here, like every other label in this library.
 */
export type GridLabels = {
  /** Accessible label for a grid whose items can be moved and resized. */
  interactiveGrid: string;
  /** Accessible label for a read-only grid. */
  readonlyGrid: string;
  /** Accessible label for an item's remove action. */
  removeItem: string;
};

/** The built-in English labels. */
export const DEFAULT_GRID_LABELS: GridLabels = {
  interactiveGrid: 'Interactive grid layout',
  readonlyGrid: 'Grid layout',
  removeItem: 'Remove item',
};

const GRID_LABELS_DEF = /* @__PURE__ */ defineLabels<GridLabels>('GRID_LABELS', DEFAULT_GRID_LABELS);

/**
 * Localize the grid's accessible labels for everything below this injector, and read the set in effect
 * here as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_GRID_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideGridLabels({ readonlyGrid: 'Raster', removeItem: 'Element entfernen' });
 */
export const provideGridLabels = /* @__PURE__ */ toProvideFn(GRID_LABELS_DEF);
export const injectGridLabels = /* @__PURE__ */ toInjectFn(GRID_LABELS_DEF);
export const GRID_LABELS = /* @__PURE__ */ toToken(GRID_LABELS_DEF);
