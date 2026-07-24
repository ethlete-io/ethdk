import { computed, Directive, inject, input } from '@angular/core';
import { applyHeadTitleBinding, applyLinkBinding } from '@ethlete/core';
import { PaginationDirective } from '../headless/pagination.directive';

/**
 * Opt-in paged-SEO for a paginator. Add it next to `etPagination` (or `et-pagination`) and give it a
 * `urlForPage` mapping — it keeps `<link rel="canonical">` pointing at the current page and emits
 * `rel="prev"`/`rel="next"` links so crawlers understand the page series, all via the non-deprecated
 * core head-binding utils (SSR-safe; each binding cleans itself up on destroy).
 *
 * This lives in its own directive on purpose: the base `et-pagination` never imports it, so apps that
 * don't need head management don't pull the title/link stores into their bundle.
 *
 * The bindings go through `applyLinkBinding`/`applyHeadTitleBinding` directly (not
 * `applyCanonicalBinding` etc.), because the `create*PropertyBinding` helpers read their input
 * `untracked` and so would freeze the URL at the first page — we need it to track `page`.
 *
 * @example
 * <et-pagination
 *   [(page)]="page"
 *   [totalPages]="totalPages()"
 *   renderAs="links"
 *   [urlForPage]="urlForPage"
 *   [etPaginationSeo]="urlForPage"
 *   [pageTitle]="pageTitle"
 * />
 */
@Directive({
  selector: '[etPaginationSeo]',
})
export class PaginationSeoDirective {
  private pagination = inject(PaginationDirective);

  /** Maps a page number to its absolute URL — used for the canonical link and prev/next rels. */
  public urlForPage = input<((page: number) => string) | null>(null, { alias: 'etPaginationSeo' });

  /** Optional: maps a page number to a head `<title>` part (return `null` to leave the title untouched, e.g. on page 1). */
  public pageTitle = input<((page: number) => string | null) | null>(null);

  constructor() {
    applyLinkBinding(
      computed(() => {
        const url = this.urlForPage();

        return url ? { rel: 'canonical', href: url(this.pagination.page()) } : null;
      }),
    );

    applyLinkBinding(
      computed(() => {
        const url = this.urlForPage();
        const page = this.pagination.page();

        return url && page > 1 ? { rel: 'prev', href: url(page - 1) } : null;
      }),
    );

    applyLinkBinding(
      computed(() => {
        const url = this.urlForPage();
        const page = this.pagination.page();

        return url && page < this.pagination.totalPages() ? { rel: 'next', href: url(page + 1) } : null;
      }),
    );

    applyHeadTitleBinding(
      computed(() => {
        const toTitle = this.pageTitle();

        return toTitle ? toTitle(this.pagination.page()) : null;
      }),
    );
  }
}
