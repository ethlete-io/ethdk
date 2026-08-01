import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

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
  /** Visible label for the page-size select (`<et-page-size-select>`). */
  pageSize: string;
  /** How one page-size choice reads, e.g. `'25'` — override for `'All'` or `'25 per page'`. */
  pageSizeOption: (size: number) => string;
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
  pageSize: 'Items per page',
  pageSizeOption: (size) => `${size}`,
};

const PAGINATION_LABELS_DEF = /* @__PURE__ */ defineLabels<PaginationLabels>(
  'PAGINATION_LABELS',
  DEFAULT_PAGINATION_LABELS,
);

/**
 * Localize the paginator's strings for everything below this injector, and read the set in effect
 * here as a signal. Partial — whatever you leave out keeps its {@link DEFAULT_PAGINATION_LABELS}
 * value. See {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * providePaginationLabels({
 *   navigation: 'Seitennavigation',
 *   previous: 'Vorherige Seite',
 *   page: (page) => `Seite ${page}`,
 *   range: ({ start, end, totalItems }) => `Zeige ${start}–${end} von ${totalItems}`,
 * });
 */
export const providePaginationLabels = /* @__PURE__ */ toProvideFn(PAGINATION_LABELS_DEF);
export const injectPaginationLabels = /* @__PURE__ */ toInjectFn(PAGINATION_LABELS_DEF);
export const PAGINATION_LABELS = /* @__PURE__ */ toToken(PAGINATION_LABELS_DEF);
