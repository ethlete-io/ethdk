import { computed, Directive, input, model } from '@angular/core';
import { clamp } from '@ethlete/core';
import { paginate } from '../paginate';
import { PaginationItem } from '../pagination.types';

/**
 * Headless paginator: owns the current `page` (two-way) and derives the rendered
 * {@link PaginationItem} list from `totalPages` and the window config. No visual opinion — apply it
 * yourself, or use the default `et-pagination` component. Bind `page` to a query form's page field
 * or {@link tableRowsFromQuery}'s `page`/`setPage`.
 */
@Directive({
  selector: '[etPagination]',
  exportAs: 'etPagination',
  host: {
    role: 'navigation',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class PaginationDirective {
  /** The active page (1-based). Two-way bindable. */
  public page = model(1);

  /** Total number of pages. */
  public totalPages = input(1);

  /** Pages shown on each side of the current page. @default 1 */
  public siblingCount = input(1);

  /** Pages shown at each edge before an ellipsis. @default 1 */
  public boundaryCount = input(1);

  /** Omit the first/last jump controls. @default false */
  public hideFirstLast = input(false);

  /** Omit the previous/next controls. @default false */
  public hidePreviousNext = input(false);

  /** Accessible label for the navigation landmark. @default 'Pagination' */
  public ariaLabel = input('Pagination');

  /** The ordered items to render (page numbers, jump controls, ellipsis gaps). */
  public items = computed<PaginationItem[]>(() =>
    paginate({
      currentPage: this.page(),
      totalPages: this.totalPages(),
      siblingCount: this.siblingCount(),
      boundaryCount: this.boundaryCount(),
      hideFirstLast: this.hideFirstLast(),
      hidePreviousNext: this.hidePreviousNext(),
    }),
  );

  /** Go to a specific page (clamped into `[1, totalPages]`). */
  public goTo(page: number) {
    const total = this.totalPages();

    if (total <= 0) return;

    this.page.set(clamp(page, 1, total));
  }

  /** Go to the first page. */
  public first() {
    this.goTo(1);
  }

  /** Go to the previous page. */
  public previous() {
    this.goTo(this.page() - 1);
  }

  /** Go to the next page. */
  public next() {
    this.goTo(this.page() + 1);
  }

  /** Go to the last page. */
  public last() {
    this.goTo(this.totalPages());
  }
}
