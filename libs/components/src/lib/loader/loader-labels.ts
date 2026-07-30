import { createLabels } from '@ethlete/core';

/**
 * What a busy indicator announces. A spinner, a brand loader and a skeleton are all shapes with no
 * text, so this is the only thing a screen reader has to go on.
 *
 * One set for all of them on purpose: an app that translates "Loading" should not have to say so once
 * per component. `et-skeleton`'s `loadingAllyText` still overrides it per instance where something more
 * specific reads better ("Loading results").
 */
export type LoaderLabels = {
  /** Announced by an indeterminate loader — the spinner, the brand loader, a stream's loading overlay. */
  loading: string;
  /** Announced in place of a skeleton's shapes, which are `aria-hidden`. */
  loadingContent: string;
};

/** The built-in English labels. */
export const DEFAULT_LOADER_LABELS: LoaderLabels = {
  loading: 'Loading',
  loadingContent: 'Loading…',
};

/**
 * Localize what loaders announce for everything below this injector, and read the set in effect here as
 * a signal. Partial — whatever you leave out keeps its {@link DEFAULT_LOADER_LABELS} value. See
 * {@link createLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideLoaderLabels({ loading: 'Lädt', loadingContent: 'Lädt…' });
 */
export const [provideLoaderLabels, injectLoaderLabels, LOADER_LABELS] = createLabels<LoaderLabels>(
  'LOADER_LABELS',
  DEFAULT_LOADER_LABELS,
);
