import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings `et-tree` renders itself. Node labels come from the data source. */
export type TreeLabels = {
  /** Shown while the root level loads. */
  loading: string;
  /** Shown when the root level loaded no nodes at all. */
  empty: string;
  /** Appended to a failed level's message, to say that selecting the row loads it again. */
  retry: string;
};

/** The built-in English labels. */
export const DEFAULT_TREE_LABELS: TreeLabels = {
  loading: 'Loading…',
  empty: 'Nothing to show',
  retry: 'select to retry',
};

const TREE_LABELS_DEF = /* @__PURE__ */ defineLabels<TreeLabels>('TREE_LABELS', DEFAULT_TREE_LABELS);

/**
 * Localize the tree's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_TREE_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideTreeLabels({ loading: 'Lädt…', empty: 'Keine Einträge', retry: 'zum Wiederholen auswählen' });
 */
export const provideTreeLabels = /* @__PURE__ */ toProvideFn(TREE_LABELS_DEF);
export const injectTreeLabels = /* @__PURE__ */ toInjectFn(TREE_LABELS_DEF);
export const TREE_LABELS = /* @__PURE__ */ toToken(TREE_LABELS_DEF);
