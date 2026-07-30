import { Signal } from '@angular/core';

/**
 * What the overlay closes with. `didUpdate: false` for a dismissal — the draft is thrown away and the page's
 * filters are untouched.
 */
export type FilterOverlayResult<TValue = unknown> = { didUpdate: false } | { didUpdate: true; value: TValue };

/**
 * A live count of what the draft filters would return, so the submit button can say "Show 42 results" instead of
 * "Apply" and the reader can tell before committing.
 *
 * Built by {@link filterOverlayPreviewFromQuery} for the usual case; hand-write it when the count comes from
 * somewhere other than a single query (a local collection, an aggregate of several endpoints).
 */
export type FilterOverlayPreview = {
  /** A count is in flight. */
  loading: Signal<boolean>;
  /** The count could not be established. */
  hasError: Signal<boolean>;
  /** How many results the draft would produce, or `null` while that is unknown. */
  totalHits: Signal<number | null>;
};

/** What the submit button says and whether it can be pressed. */
export type FilterOverlaySubmitButton = {
  label: string;
  disabled: boolean;
};

/** Everything the default submit-button resolver has to go on. */
export type FilterOverlaySubmitState = {
  /** `null` when the overlay has no preview at all — then there is no count to wait for. */
  totalHits: number | null;
  loading: boolean;
  hasError: boolean;
  hasPreview: boolean;
  /** Counts above this are reported as "more than N", since an exact number stops being useful. */
  maxCountedHits: number;
};
