import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '../button';
import { PaginationDirective } from './headless/pagination.directive';
import { PaginationItem } from './pagination.types';

/** How the paginator renders its page items. */
export type PaginationRenderAs = 'buttons' | 'links';

/**
 * The default paginator. Renders themed page-number controls (via the shared `[et-button]`) with
 * first/previous/next/last jumps and ellipsis gaps for large page counts, driven by the headless
 * {@link PaginationDirective}.
 *
 * By default items are `<button>`s (pure client state). Set `renderAs="links"` with a `urlForPage`
 * to render crawlable `<a href>`s instead — normal clicks are intercepted (no reload) so the `page`
 * model still drives everything; modified clicks (⌘/Ctrl/middle) open the URL as usual. Opt into a
 * "Showing X–Y of Z" readout with `totalItems`/`pageSize`, and a jump-to-page field with `showJumpTo`.
 *
 * @example
 * <et-pagination [(page)]="page" [totalPages]="totalPages()" />
 */
@Component({
  selector: 'et-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, NgTemplateOutlet],
  hostDirectives: [
    {
      directive: PaginationDirective,
      inputs: ['page', 'totalPages', 'siblingCount', 'boundaryCount', 'hideFirstLast', 'hidePreviousNext', 'ariaLabel'],
      outputs: ['pageChange'],
    },
  ],
  host: {
    class: 'et-pagination-host',
  },
})
export class PaginationComponent {
  protected pagination = inject(PaginationDirective);

  /** Render page items as `<button>`s (client state) or crawlable `<a href>` links. @default 'buttons' */
  public renderAs = input<PaginationRenderAs>('buttons');

  /** Maps a page number to its URL, used when `renderAs` is `'links'`. */
  public urlForPage = input<((page: number) => string) | null>(null);

  /** Total number of items across all pages. Enables the "Showing X–Y of Z" readout when set with `pageSize`. */
  public totalItems = input<number | null>(null);

  /** Items per page, used to compute the readout range. */
  public pageSize = input<number | null>(null);

  /** Show a jump-to-page number field (useful for very large page counts). @default false */
  public showJumpTo = input(false);

  /** The `[start, end]` (1-based, inclusive) item range shown on the current page, or `null` if unknown. */
  public range = computed<[number, number] | null>(() => {
    const size = this.pageSize();
    const total = this.totalItems();

    if (size === null || total === null || size <= 0 || total < 0) return null;

    const start = total === 0 ? 0 : (this.pagination.page() - 1) * size + 1;
    const end = Math.min(this.pagination.page() * size, total);

    return [start, end];
  });

  /** The href for a link item, or `null` (renders a button) when not in links mode or the item is disabled. */
  protected hrefFor(item: PaginationItem): string | null {
    const url = this.urlForPage();

    if (this.renderAs() !== 'links' || url === null || item.page === null || item.disabled) return null;

    return url(item.page);
  }

  protected select(item: PaginationItem) {
    if (item.page !== null && !item.disabled) this.pagination.goTo(item.page);
  }

  /** Intercept a plain left-click on a link item; let modified clicks fall through to the browser. */
  protected selectLink(event: MouseEvent, item: PaginationItem) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    event.preventDefault();
    this.select(item);
  }

  protected jump(value: string) {
    const page = Number.parseInt(value, 10);

    if (!Number.isNaN(page)) this.pagination.goTo(page);
  }
}
