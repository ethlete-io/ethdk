import { PaginationLabels } from './pagination-labels';

/** The kind of control a {@link PaginationItem} represents. */
export type PaginationItemType = 'first' | 'previous' | 'page' | 'ellipsis' | 'next' | 'last';

/** One rendered item of a paginator — a page number, a jump control, or an ellipsis gap. */
export type PaginationItem = {
  /** What this item is. */
  type: PaginationItemType;
  /** The page this item navigates to; `null` for an `'ellipsis'` gap. */
  page: number | null;
  /** Whether this item is the current page. */
  current: boolean;
  /** Whether the control is unavailable (e.g. `'previous'` on the first page, or an ellipsis). */
  disabled: boolean;
  /** Accessible label, e.g. `'Page 3'`, `'Previous page'` — from the resolved {@link PaginationLabels}. */
  label: string;
};

/** Options for {@link paginate}. */
export type PaginateOptions = {
  /** The active page (1-based). Clamped into `[1, totalPages]`. */
  currentPage: number;
  /** Total number of pages. `0` yields no items. */
  totalPages: number;
  /** Pages shown on each side of the current page. @default 1 */
  siblingCount?: number;
  /** Pages shown at each edge before an ellipsis. @default 1 */
  boundaryCount?: number;
  /** Omit the first/last jump controls. @default false */
  hideFirstLast?: boolean;
  /** Omit the previous/next controls. @default false */
  hidePreviousNext?: boolean;
  /**
   * Overrides for the item `label`s, merged over the default (English) labels. Only the
   * item-label keys (`first`, `previous`, `next`, `last`, `ellipsis`, `page`) are read here — the
   * readout labels belong to the component. Accepts a full {@link PaginationLabels} so a resolved
   * set can be passed straight through.
   */
  labels?: Partial<PaginationLabels>;
};
