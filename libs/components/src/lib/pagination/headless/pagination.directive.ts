import { booleanAttribute, computed, Directive, input, model, numberAttribute } from '@angular/core';
import { clamp } from '@ethlete/core';
import { paginate } from '../paginate';
import { injectPaginationLabels, PaginationLabels } from '../pagination-labels';
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
    '[attr.aria-label]': 'ariaLabel() ?? resolvedLabels().navigation',
  },
})
export class PaginationDirective {
  private injectedLabels = injectPaginationLabels();

  /** The active page (1-based). Two-way bindable. */
  public page = model(1);

  /** Total number of pages. */
  public totalPages = input(1, { transform: numberAttribute });

  /** Pages shown on each side of the current page. @default 1 */
  public siblingCount = input(1, { transform: numberAttribute });

  /** Pages shown at each edge before an ellipsis. @default 1 */
  public boundaryCount = input(1, { transform: numberAttribute });

  /** Omit the first/last jump controls. @default false */
  public hideFirstLast = input(false, { transform: booleanAttribute });

  /** Omit the previous/next controls. @default false */
  public hidePreviousNext = input(false, { transform: booleanAttribute });

  /**
   * Accessible label for the navigation landmark. `null` (the default) uses the resolved
   * {@link PaginationLabels}' `navigation` label — set this only to distinguish one paginator from
   * another on the same page ("Search results pages"), not to translate it.
   */
  public ariaLabel = input<string | null>(null);

  /**
   * Per-instance overrides for the paginator's strings, merged over the injected
   * `PAGINATION_LABELS`. Prefer `providePaginationLabels` for app-wide localization; use this
   * for a one-off wording. Partial — omitted keys keep the provided/default value.
   */
  public labels = input<Partial<PaginationLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<PaginationLabels>(() => ({ ...this.injectedLabels, ...this.labels() }));

  /** The ordered items to render (page numbers, jump controls, ellipsis gaps). */
  public items = computed<PaginationItem[]>(() =>
    paginate({
      currentPage: this.page(),
      totalPages: this.totalPages(),
      siblingCount: this.siblingCount(),
      boundaryCount: this.boundaryCount(),
      hideFirstLast: this.hideFirstLast(),
      hidePreviousNext: this.hidePreviousNext(),
      labels: this.resolvedLabels(),
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
