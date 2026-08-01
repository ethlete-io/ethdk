import { clamp } from '@ethlete/core';
import { DEFAULT_PAGINATION_LABELS } from './pagination-labels';
import { PaginateOptions, PaginationItem } from './pagination.types';

const range = (start: number, end: number): number[] =>
  Array.from({ length: Math.max(end - start + 1, 0) }, (_, index) => start + index);

/**
 * Build the ordered {@link PaginationItem} list for a paginator: optional first/previous controls,
 * a windowed set of page numbers with `ellipsis` gaps for large page counts (the
 * `1 … 45 46 47 … 200` shape), then optional next/last controls. Pure and global-free - the caller
 * turns page numbers into hrefs (or handles clicks) itself.
 *
 * The page-window algorithm mirrors the well-worn boundary/sibling approach: `boundaryCount` pages
 * are always shown at each edge and `siblingCount` on each side of the current page, with ellipses
 * only where they replace more than one page.
 *
 * Item `label`s come from the default English labels unless `options.labels` overrides them.
 */
export const paginate = (options: PaginateOptions): PaginationItem[] => {
  const { totalPages, siblingCount = 1, boundaryCount = 1, hideFirstLast = false, hidePreviousNext = false } = options;
  const labels = { ...DEFAULT_PAGINATION_LABELS, ...options.labels };

  if (totalPages <= 0) return [];

  const current = clamp(options.currentPage, 1, totalPages);

  const startPages = range(1, Math.min(boundaryCount, totalPages));
  const endPages = range(Math.max(totalPages - boundaryCount + 1, boundaryCount + 1), totalPages);

  const siblingsStart = Math.max(
    Math.min(current - siblingCount, totalPages - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(current + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? (endPages[0] as number) - 2 : totalPages - 1,
  );

  const middle: (number | 'ellipsis')[] = [
    ...startPages,
    ...(siblingsStart > boundaryCount + 2
      ? ['ellipsis' as const]
      : boundaryCount + 1 < totalPages - boundaryCount
        ? [boundaryCount + 1]
        : []),
    ...range(siblingsStart, siblingsEnd),
    ...(siblingsEnd < totalPages - boundaryCount - 1
      ? ['ellipsis' as const]
      : totalPages - boundaryCount > boundaryCount
        ? [totalPages - boundaryCount]
        : []),
    ...endPages,
  ];

  const items: PaginationItem[] = [];

  if (!hideFirstLast) {
    items.push({ type: 'first', page: 1, current: false, disabled: current === 1, label: labels.first });
  }

  if (!hidePreviousNext) {
    items.push({
      type: 'previous',
      page: current - 1,
      current: false,
      disabled: current === 1,
      label: labels.previous,
    });
  }

  for (const entry of middle) {
    if (entry === 'ellipsis') {
      items.push({ type: 'ellipsis', page: null, current: false, disabled: true, label: labels.ellipsis });
    } else {
      items.push({
        type: 'page',
        page: entry,
        current: entry === current,
        disabled: false,
        label: labels.page(entry, totalPages),
      });
    }
  }

  if (!hidePreviousNext) {
    items.push({
      type: 'next',
      page: current + 1,
      current: false,
      disabled: current === totalPages,
      label: labels.next,
    });
  }

  if (!hideFirstLast) {
    items.push({
      type: 'last',
      page: totalPages,
      current: false,
      disabled: current === totalPages,
      label: labels.last,
    });
  }

  return items;
};
