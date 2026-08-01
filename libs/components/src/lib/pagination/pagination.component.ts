import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { signalHostElementDimensions } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../button';
import { PaginationDirective } from './headless/pagination.directive';
import { PaginationRangeContext } from './pagination-labels';
import { paginate } from './paginate';
import { PaginateOptions, PaginationItem } from './pagination.types';

/** How the paginator renders its page items. */
export type PaginationRenderAs = 'buttons' | 'links';

/**
 * Below this measured width (px) the paginator collapses to previous/next + a "page X of Y" readout,
 * so it stays on one line with roomy touch targets instead of a cramped row of number buttons.
 */
const COMPACT_MAX_WIDTH = 480;

/**
 * The default paginator. Renders themed page-number controls (via the shared `[et-button]`) with
 * first/previous/next/last jumps and ellipsis gaps for large page counts, driven by the headless
 * {@link PaginationDirective}.
 *
 * By default items are `<button>`s (pure client state). Set `renderAs="links"` with a `urlForPage`
 * to render crawlable `<a href>`s instead - normal clicks are intercepted (no reload) so the `page`
 * model still drives everything; modified clicks (⌘/Ctrl/middle) open the URL as usual. Opt into a
 * "Showing X–Y of Z" readout with `totalItems`/`pageSize`, and a jump-to-page field with `showJumpTo`.
 *
 * Every string it renders (control `aria-label`s, the readouts, the jump-to label) comes from the
 * resolved `PaginationLabels` - localize them app-wide with `providePaginationLabels` or per
 * instance with the `labels` input.
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
      inputs: [
        'page',
        'totalPages',
        'siblingCount',
        'boundaryCount',
        'hideFirstLast',
        'hidePreviousNext',
        'ariaLabel',
        'labels',
      ],
      outputs: ['pageChange'],
    },
  ],
  host: {
    class: 'et-pagination-host',
    '[attr.data-size]': 'size()',
    '[attr.data-compact]': 'isCompact() ? "" : null',
  },
})
export class PaginationComponent {
  protected pagination = inject(PaginationDirective);

  /** Render page items as `<button>`s (client state) or crawlable `<a href>` links. @default 'buttons' */
  public renderAs = input<PaginationRenderAs>('buttons');

  /**
   * Control density. `'sm'` shrinks the page items below the comfortable touch size - use it in tight
   * spots like a table footer on mobile, where the default targets read larger than the rows. @default 'md'
   */
  public size = input<'sm' | 'md'>('md');

  /**
   * Adapt to the paginator's own width (measured, not a viewport media query). It trims the page window
   * to whatever fits on one row - dropping siblings, then the first/last jumps - and, once the width is
   * too tight for a useful number row, collapses to previous/next around a "page X of Y" readout with
   * roomy touch targets. Turn off to always honor `siblingCount`/`boundaryCount` verbatim.
   * @default true
   */
  public responsive = input(true, { transform: booleanAttribute });

  /**
   * Force the compact previous/next pager on (`true`) or off (`false`), instead of the width-based
   * decision. Use `true` for a Material-style controls row where the paginator sits inline with a
   * page-size select and a range readout. `null` (default) keeps the automatic behavior.
   */
  public compact = input<boolean | null>(null);

  /** Maps a page number to its URL, used when `renderAs` is `'links'`. */
  public urlForPage = input<((page: number) => string) | null>(null);

  /** Total number of items across all pages. Enables the "Showing X–Y of Z" readout when set with `pageSize`. */
  public totalItems = input<number | null>(null);

  /** Items per page, used to compute the readout range. */
  public pageSize = input<number | null>(null);

  /** Show a jump-to-page number field (useful for very large page counts). @default false */
  public showJumpTo = input(false, { transform: booleanAttribute });

  // The rendered list + its items, measured (untracked) to decide how many fit - see `slotsThatFit`.
  private listEl = viewChild<ElementRef<HTMLUListElement>>('paginationList');
  private itemEls = viewChildren<ElementRef<HTMLElement>>('paginationItem');

  // Re-fit the page window whenever the paginator's own width changes (viewport resize, footer layout).
  private hostDimensions = signalHostElementDimensions();

  /** The `[start, end]` (1-based, inclusive) item range shown on the current page, or `null` if unknown. */
  public range = computed<[number, number] | null>(() => {
    const size = this.pageSize();
    const total = this.totalItems();

    if (size === null || total === null || size <= 0 || total < 0) return null;

    const start = total === 0 ? 0 : (this.pagination.page() - 1) * size + 1;
    const end = Math.min(this.pagination.page() * size, total);

    return [start, end];
  });

  /**
   * Whether to render the compact previous/next pager instead of the number row. Honors the `compact`
   * input override; otherwise (when `responsive`) collapses once the measured width drops below
   * {@link COMPACT_MAX_WIDTH}.
   */
  protected isCompact = computed(() => {
    const forced = this.compact();

    if (forced !== null) return forced;
    if (!this.responsive()) return false;

    const width = this.hostDimensions()?.client?.width ?? 0;

    return width > 0 && width < COMPACT_MAX_WIDTH;
  });

  /** The "Showing X–Y of Z" readout, or `null` when `totalItems`/`pageSize` aren't set. */
  protected rangeStatus = computed(() => {
    const range = this.range();

    if (!range) return null;

    return this.pagination.resolvedLabels().range(this.rangeContext(range));
  });

  /** The compact readout: the item range ("1–10 of 40") when known, else the page position. */
  protected compactStatus = computed(() => {
    const range = this.range();
    const labels = this.pagination.resolvedLabels();

    if (range) return labels.compactRange(this.rangeContext(range));

    return labels.compactPage(this.pagination.page(), this.pagination.totalPages());
  });

  /**
   * The widest readout this paginator can ever show, rendered invisibly underneath the live one so the
   * readout's box never changes size. Without it, stepping 9 → 10 widens the text by a digit and shoves
   * everything laid out beside the paginator sideways - very visible when the paginator is right-aligned
   * next to a page-size select.
   *
   * Every slot gets the largest number in play, which with the tabular figures below is an upper bound
   * on the real string. A custom label that beats it only loses the guarantee, never gets clipped: the
   * two are stacked in one grid cell, which takes whichever is wider.
   */
  protected widestRangeStatus = computed(() => this.widestStatus('range'));
  protected widestCompactStatus = computed(() => this.widestStatus('compact'));

  /** The previous/next controls for the compact pager (correct disabled state at the ends). */
  protected compactControls = computed(() => {
    const items = paginate({
      currentPage: this.pagination.page(),
      totalPages: this.pagination.totalPages(),
      hideFirstLast: true,
      labels: this.pagination.resolvedLabels(),
    });

    return {
      previous: items.find((item) => item.type === 'previous') ?? null,
      next: items.find((item) => item.type === 'next') ?? null,
    };
  });

  /**
   * The rendered page items. With `responsive` on (the default) the window is trimmed to the richest
   * configuration that fits the current width; otherwise it's the headless directive's full window.
   */
  protected items = computed<PaginationItem[]>(() => {
    const base: PaginateOptions = {
      currentPage: this.pagination.page(),
      totalPages: this.pagination.totalPages(),
      siblingCount: this.pagination.siblingCount(),
      boundaryCount: this.pagination.boundaryCount(),
      hideFirstLast: this.pagination.hideFirstLast(),
      hidePreviousNext: this.pagination.hidePreviousNext(),
      labels: this.pagination.resolvedLabels(),
    };

    if (!this.responsive()) return paginate(base);

    const width = this.hostDimensions()?.client?.width ?? 0;

    if (width <= 0) return paginate(base);

    const maxSlots = this.slotsThatFit(width);

    // Walk configs from richest to sparsest and take the first that fits on one row; if none fit,
    // fall through to the sparsest (the loop's last assignment).
    let items = paginate(base);

    for (const attempt of this.fitAttempts(base)) {
      items = paginate({ ...base, ...attempt });

      if (items.length <= maxSlots) break;
    }

    return items;
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

  /** The `[start, end]` tuple as the context the readout labels take. */
  private rangeContext([start, end]: [number, number]): PaginationRangeContext {
    return { start, end, totalItems: this.totalItems() ?? 0 };
  }

  /** The widest string a readout can produce - see {@link widestRangeStatus}. */
  private widestStatus(variant: 'range' | 'compact') {
    const labels = this.pagination.resolvedLabels();
    const total = this.totalItems();

    if (total === null || this.pageSize() === null) {
      const pages = this.pagination.totalPages();

      return variant === 'compact' ? labels.compactPage(pages, pages) : null;
    }

    const context: PaginationRangeContext = { start: total, end: total, totalItems: total };

    return variant === 'compact' ? labels.compactRange(context) : labels.range(context);
  }

  /**
   * How many item cells fit across `width`. Measures the currently-rendered items rather than the CSS
   * size tokens: item width is content-/token-driven but independent of how many items there are, so
   * this can't feed back into a layout loop. Falls back to a rough estimate before the first render.
   */
  private slotsThatFit(width: number) {
    // Read the rendered items untracked: they're the output of this very computation, so subscribing
    // to them would loop. Item width is count-independent, so a stale-by-one-render read is still right.
    return untracked(() => {
      const items = this.itemEls();
      const itemWidth = items.length ? Math.max(...items.map((ref) => ref.nativeElement.offsetWidth)) : 40;
      const list = this.listEl()?.nativeElement;
      const gap = list ? Number.parseFloat(getComputedStyle(list).columnGap) || 0 : 0;
      const slot = itemWidth + gap;

      if (slot <= 0) return Number.MAX_SAFE_INTEGER;

      return Math.max(1, Math.floor((width + gap) / slot));
    });
  }

  /**
   * Candidate window configs, richest → sparsest: shed siblings, then the extra boundary pages, then
   * the first/last jumps - never dropping what the consumer already hid. Previous/next always survive;
   * once even this doesn't fit, {@link compact} takes over with a chevrons-only pager.
   */
  private fitAttempts(base: PaginateOptions): Partial<PaginateOptions>[] {
    const attempts: Partial<PaginateOptions>[] = [];
    const firstLastVariants = base.hideFirstLast ? [true] : [false, true];

    for (const hideFirstLast of firstLastVariants) {
      for (let boundaryCount = base.boundaryCount ?? 1; boundaryCount >= 1; boundaryCount--) {
        for (let siblingCount = base.siblingCount ?? 1; siblingCount >= 0; siblingCount--) {
          attempts.push({ boundaryCount, siblingCount, hideFirstLast });
        }
      }
    }

    return attempts;
  }
}
