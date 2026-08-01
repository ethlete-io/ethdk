import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * The strings the select's panel renders itself. The options are yours; these are the panel's own
 * affordances - paging through an async option list, and the create-a-value flow (`customValues`).
 */
export type SelectLabels = {
  /** Shown while the option list is being fetched. */
  loading: string;
  /** Shown when the option list came back empty. */
  empty: string;
  /** The "fetch the next page of options" control in an async panel. */
  loadMore: string;
  /** The panel's entry that starts creating a value that isn't in the list. */
  addNew: string;
  /** The confirm action of the create-a-value flow. */
  create: string;
};

/** The built-in English labels. */
export const DEFAULT_SELECT_LABELS: SelectLabels = {
  loading: 'Loading…',
  empty: 'No results',
  loadMore: 'Load more',
  addNew: 'Add new',
  create: 'Create',
};

const SELECT_LABELS_DEF = /* @__PURE__ */ defineLabels<SelectLabels>('SELECT_LABELS', DEFAULT_SELECT_LABELS);

/**
 * Localize the select's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_SELECT_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideSelectLabels({ loadMore: 'Mehr laden', create: 'Erstellen' });
 */
export const provideSelectLabels = /* @__PURE__ */ toProvideFn(SELECT_LABELS_DEF);
export const injectSelectLabels = /* @__PURE__ */ toInjectFn(SELECT_LABELS_DEF);
export const SELECT_LABELS = /* @__PURE__ */ toToken(SELECT_LABELS_DEF);
