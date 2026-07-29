import { InjectionToken, Provider, inject } from '@angular/core';
import {
  parseHttpErrorCodeToMessageDe,
  parseHttpErrorCodeToMessageEn,
  parseHttpErrorCodeToTitleDe,
  parseHttpErrorCodeToTitleEn,
} from '@ethlete/query';

/**
 * Every string a query error renders. Two of them are functions of the HTTP status, because that is the only
 * thing there is to go on when a response carries no message of its own.
 *
 * Defaults come from `@ethlete/query`'s status tables, in English or German depending on
 * [`injectLocale()`](/core/providers) — so a localized app needs no configuration here at all. Override
 * app-wide with {@link provideQueryErrorLabels}, or per instance via the `labels` input.
 */
export type QueryErrorLabels = {
  /** The heading for a status code, e.g. `'Not found'`. */
  title: (status: number) => string;
  /**
   * The message for a status code. Used when the response carried none of its own, and as the replacement when
   * the response's only message merely repeats the title.
   */
  message: (status: number) => string;
  /** The retry button's label. */
  retry: string;
};

/** The built-in English labels. */
export const DEFAULT_QUERY_ERROR_LABELS: QueryErrorLabels = {
  title: (status) => parseHttpErrorCodeToTitleEn(status),
  message: (status) => parseHttpErrorCodeToMessageEn(status),
  retry: 'Retry',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_QUERY_ERROR_LABELS: QueryErrorLabels = {
  title: (status) => parseHttpErrorCodeToTitleDe(status),
  message: (status) => parseHttpErrorCodeToMessageDe(status),
  retry: 'Erneut versuchen',
};

/**
 * The label set for a locale. Only English and German ship with the SDK, since those are the only status
 * tables `@ethlete/query` carries; any other locale needs {@link provideQueryErrorLabels}.
 */
export const queryErrorLabelsForLocale = (locale: string): QueryErrorLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_QUERY_ERROR_LABELS : DEFAULT_QUERY_ERROR_LABELS;

/**
 * Overrides for the locale-derived labels. `null` (the default) means "use whatever the locale says", which is
 * the setup that needs no configuration.
 */
export const QUERY_ERROR_LABELS = new InjectionToken<Partial<QueryErrorLabels> | null>('QUERY_ERROR_LABELS', {
  providedIn: 'root',
  factory: () => null,
});

/**
 * Localize a query error's strings for everything below this injector. Partial — whatever you leave out keeps
 * the value the current locale gives it, so this is also how you localize into a third language while keeping
 * English or German as the base.
 *
 * @example
 * provideQueryErrorLabels({ retry: 'Réessayer', title: () => 'Une erreur est survenue' });
 */
export const provideQueryErrorLabels = (labels: Partial<QueryErrorLabels>): Provider => ({
  provide: QUERY_ERROR_LABELS,
  useValue: labels,
});

export const injectQueryErrorLabels = () => inject(QUERY_ERROR_LABELS);
