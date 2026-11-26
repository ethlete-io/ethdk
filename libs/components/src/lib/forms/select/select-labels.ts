import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/**
 * The strings the select's panel renders itself. The options are yours; these are the panel's own
 * affordances - paging through an async option list, and the create-a-value flow (`allowCustomValues`).
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
  /** Shown when a query adapter's request failed and the error carries no message. */
  error: string;
  /** The leading text of the "Create …" row that commits the search query as a custom value. */
  create: string;
};

/** The built-in English labels. */
export const DEFAULT_SELECT_LABELS: SelectLabels = {
  loading: 'Loading…',
  empty: 'No results',
  loadMore: 'Load more',
  addNew: 'Add new',
  create: 'Create',
  error: 'Something went wrong',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_SELECT_LABELS: SelectLabels = {
  loading: 'Lade…',
  empty: 'Keine Ergebnisse',
  loadMore: 'Mehr laden',
  addNew: 'Neu hinzufügen',
  create: 'Erstellen',
  error: 'Etwas ist schiefgelaufen',
};

/** The label set for a locale. Anything other than English and German needs {@link provideSelectLabels}. */
export const selectLabelsForLocale = (locale: string): SelectLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_SELECT_LABELS : DEFAULT_SELECT_LABELS;

const SELECT_LABELS_DEF = /* @__PURE__ */ defineLabels<SelectLabels>('SELECT_LABELS', selectLabelsForLocale);

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
