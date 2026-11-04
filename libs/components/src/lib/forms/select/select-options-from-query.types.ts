import { Signal } from '@angular/core';

export type SelectOptionsFromQuery<TOption> = {
  /** The mapped options - render them with an `@for` of `et-select-option`s (`filterMode="external"`). */
  options: Signal<TOption[]>;
  /** Bind to the select's `loading` input. */
  loading: Signal<boolean>;
  /** Bind to the select's `loadError` input. */
  error: Signal<string | null>;
  /** Bind to the select's `hasMoreItems` input (always false without `toHasMore`). */
  hasMore: Signal<boolean>;
  /** The debounced query currently driving the request. */
  query: Signal<string>;
  /** Wire to the select's `(queryChange)` output. */
  setQuery: (query: string) => void;
  /**
   * Wire to the select's `(loadMore)` output - advances to the next page and appends it
   * to `options`. A no-op while loading, when skipped, or once `hasMore` is false.
   */
  loadMore: () => void;
};
