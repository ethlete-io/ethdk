import { inject, InjectionToken, Provider } from '@angular/core';

/** The item range a readout label describes — `start`/`end` are 1-based and inclusive. */
export type PaginationRangeContext = {
  /** First item shown on the current page (`0` when there are no items). */
  start: number;
  /** Last item shown on the current page. */
  end: number;
  /** Total items across all pages. */
  totalItems: number;
};

/**
 * Every string the paginator renders or announces itself. Defaults are English
 * ({@link DEFAULT_PAGINATION_LABELS}); override them app-wide with
 * {@link providePaginationLabels} or per instance via `et-pagination`'s `labels` input.
 *
 * The first four plus `ellipsis`/`page` are the controls' `aria-label`s (the visible text is a
 * chevron or the page number); the rest are visible readouts.
 */
export type PaginationLabels = {
  /** Accessible label for the navigation landmark. */
  navigation: string;
  /** Accessible label for the "jump to first page" control. */
  first: string;
  /** Accessible label for the "previous page" control. */
  previous: string;
  /** Accessible label for the "next page" control. */
  next: string;
  /** Accessible label for the "jump to last page" control. */
  last: string;
  /** Accessible label for an ellipsis gap (inert, `aria-hidden` — kept for custom renderings). */
  ellipsis: string;
  /** Accessible label for a page item, e.g. `'Page 3'`. */
  page: (page: number, totalPages: number) => string;
  /** The "Showing X–Y of Z" readout shown when `totalItems`/`pageSize` are set. */
  range: (range: PaginationRangeContext) => string;
  /** The compact pager's readout when `totalItems`/`pageSize` are set, e.g. `'1–10 of 40'`. */
  compactRange: (range: PaginationRangeContext) => string;
  /** The compact pager's readout when the item range is unknown, e.g. `'1 / 5'`. */
  compactPage: (page: number, totalPages: number) => string;
  /** Label for the jump-to-page field (`showJumpTo`). */
  jumpTo: string;
};

/** The built-in English labels. */
export const DEFAULT_PAGINATION_LABELS: PaginationLabels = {
  navigation: 'Pagination',
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
  ellipsis: 'More pages',
  page: (page) => `Page ${page}`,
  range: ({ start, end, totalItems }) => `Showing ${start}–${end} of ${totalItems}`,
  compactRange: ({ start, end, totalItems }) => `${start}–${end} of ${totalItems}`,
  compactPage: (page, totalPages) => `${page} / ${totalPages}`,
  jumpTo: 'Go to page',
};

/** The label set every paginator in this injector uses. @default DEFAULT_PAGINATION_LABELS */
export const PAGINATION_LABELS = new InjectionToken<PaginationLabels>('PAGINATION_LABELS', {
  providedIn: 'root',
  factory: () => DEFAULT_PAGINATION_LABELS,
});

/**
 * Localize the paginator's strings for everything below this injector. Partial — whatever you leave
 * out keeps its {@link DEFAULT_PAGINATION_LABELS} value.
 *
 * @example
 * providePaginationLabels({
 *   navigation: 'Seitennavigation',
 *   previous: 'Vorherige Seite',
 *   page: (page) => `Seite ${page}`,
 *   range: ({ start, end, totalItems }) => `Zeige ${start}–${end} von ${totalItems}`,
 * });
 */
export const providePaginationLabels = (labels: Partial<PaginationLabels>): Provider => ({
  provide: PAGINATION_LABELS,
  useValue: { ...DEFAULT_PAGINATION_LABELS, ...labels },
});

export const injectPaginationLabels = () => inject(PAGINATION_LABELS);
