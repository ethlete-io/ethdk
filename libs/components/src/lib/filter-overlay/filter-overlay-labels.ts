import { InjectionToken, Provider, inject } from '@angular/core';
import { FilterOverlaySubmitButton, FilterOverlaySubmitState } from './filter-overlay.types';

/**
 * Every string the filter overlay's submit button can show. The counted ones are functions, since the number is
 * the point.
 */
export type FilterOverlayLabels = {
  /** While a count is in flight. */
  loading: string;
  /** When the count could not be established. */
  error: string;
  /** When the draft filters would return nothing. */
  empty: string;
  /** Exactly one result — worth its own string, because "Show 1 results" reads badly. */
  one: string;
  /** A known count. */
  many: (totalHits: number) => string;
  /** More results than are worth counting exactly. */
  more: (maxCountedHits: number) => string;
  /** When the overlay has no preview, so there is no count to report. */
  apply: string;
  /** The reset control. */
  reset: string;
};

/** The built-in English labels. */
export const DEFAULT_FILTER_OVERLAY_LABELS: FilterOverlayLabels = {
  loading: 'Loading results…',
  error: 'An error occurred',
  empty: 'No results found',
  one: 'Show one result',
  many: (totalHits) => `Show ${totalHits} results`,
  more: (maxCountedHits) => `Show more than ${maxCountedHits} results`,
  apply: 'Show results',
  reset: 'Reset',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_FILTER_OVERLAY_LABELS: FilterOverlayLabels = {
  loading: 'Lade Ergebnisse…',
  error: 'Ein Fehler ist aufgetreten',
  empty: 'Keine Ergebnisse gefunden',
  one: 'Zeige ein Ergebnis',
  many: (totalHits) => `Zeige ${totalHits} Ergebnisse`,
  more: (maxCountedHits) => `Zeige mehr als ${maxCountedHits} Ergebnisse`,
  apply: 'Ergebnisse anzeigen',
  reset: 'Zurücksetzen',
};

/** The label set for a locale. Anything other than English and German needs {@link provideFilterOverlayLabels}. */
export const filterOverlayLabelsForLocale = (locale: string): FilterOverlayLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_FILTER_OVERLAY_LABELS : DEFAULT_FILTER_OVERLAY_LABELS;

/** Overrides for the locale-derived labels. `null` means "use whatever the locale says". */
export const FILTER_OVERLAY_LABELS = new InjectionToken<Partial<FilterOverlayLabels> | null>('FILTER_OVERLAY_LABELS', {
  providedIn: 'root',
  factory: () => null,
});

/**
 * Localize the filter overlay's strings below this injector. Partial — what you leave out keeps the value the
 * current locale gives it.
 *
 * @example
 * provideFilterOverlayLabels({ apply: 'Voir les résultats', reset: 'Réinitialiser' });
 */
export const provideFilterOverlayLabels = (labels: Partial<FilterOverlayLabels>): Provider => ({
  provide: FILTER_OVERLAY_LABELS,
  useValue: labels,
});

export const injectFilterOverlayLabels = () => inject(FILTER_OVERLAY_LABELS);

/**
 * The submit button, worked out from the preview.
 *
 * The button is deliberately the place the count appears: it is what the reader is about to press, so putting
 * the consequence on it ("Show 42 results") lets them decide without applying first. It disables itself while a
 * count is pending, when the count failed, and when the answer is zero — applying a filter that returns nothing
 * is never what someone meant to do.
 *
 * An overlay with no preview has nothing to wait for and simply reads "Show results". cdk's version returned the
 * *loading* state in that case, which left the button permanently disabled.
 */
export const resolveFilterOverlaySubmitButton = (
  state: FilterOverlaySubmitState,
  labels: FilterOverlayLabels,
): FilterOverlaySubmitButton => {
  if (!state.hasPreview) return { label: labels.apply, disabled: false };
  if (state.loading) return { label: labels.loading, disabled: true };
  if (state.hasError) return { label: labels.error, disabled: true };

  const totalHits = state.totalHits;

  // No count yet, and nothing in flight — the first request has not started.
  if (totalHits === null) return { label: labels.loading, disabled: true };

  if (totalHits === 0) return { label: labels.empty, disabled: true };
  if (totalHits === 1) return { label: labels.one, disabled: false };
  if (totalHits > state.maxCountedHits) return { label: labels.more(state.maxCountedHits), disabled: false };

  return { label: labels.many(totalHits), disabled: false };
};
