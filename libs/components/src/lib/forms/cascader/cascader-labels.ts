import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

/** The strings the cascader's panel renders itself - its search field and the step back up a level. */
export type CascaderLabels = {
  /** Shown while a level or a search is being fetched. */
  loading: string;
  /** Shown when a search matched nothing. */
  noMatches: string;
  /** Shown when a level has no options. */
  noOptions: string;
  /** The action that re-runs a failed search or level fetch. */
  retry: string;
  /** Heading for the root column, which has no parent option to name it. */
  options: string;
  /** Accessible label for the control that returns to the parent level. */
  back: string;
  /** Placeholder for the panel's search field. */
  search: string;
  /** Shown when a level or a search failed without a message of its own. */
  error: string;
};

/** The built-in English labels. */
export const DEFAULT_CASCADER_LABELS: CascaderLabels = {
  loading: 'Loading…',
  noMatches: 'No matches',
  noOptions: 'No options',
  retry: 'Retry',
  options: 'Options',
  back: 'Back',
  search: 'Search',
  error: 'Something went wrong',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_CASCADER_LABELS: CascaderLabels = {
  loading: 'Lade…',
  noMatches: 'Keine Treffer',
  noOptions: 'Keine Optionen',
  retry: 'Erneut versuchen',
  options: 'Optionen',
  back: 'Zurück',
  search: 'Suchen',
  error: 'Etwas ist schiefgelaufen',
};

/** The label set for a locale. Anything other than English and German needs {@link provideCascaderLabels}. */
export const cascaderLabelsForLocale = (locale: string): CascaderLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_CASCADER_LABELS : DEFAULT_CASCADER_LABELS;

const CASCADER_LABELS_DEF = /* @__PURE__ */ defineLabels<CascaderLabels>('CASCADER_LABELS', cascaderLabelsForLocale);

/**
 * Localize the cascader's strings for everything below this injector, and read the set in effect here as a
 * signal. Partial - whatever you leave out keeps its {@link DEFAULT_CASCADER_LABELS} value. See {@link defineLabels}
 * for the shape, which every domain in this library shares.
 *
 * @example
 * provideCascaderLabels({ back: 'Zurück', search: 'Suchen' });
 */
export const provideCascaderLabels = /* @__PURE__ */ toProvideFn(CASCADER_LABELS_DEF);
export const injectCascaderLabels = /* @__PURE__ */ toInjectFn(CASCADER_LABELS_DEF);
export const CASCADER_LABELS = /* @__PURE__ */ toToken(CASCADER_LABELS_DEF);
