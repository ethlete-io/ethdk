import { booleanAttribute, computed, Directive, effect, ElementRef, inject, input, untracked } from '@angular/core';
import { injectHostElement, signalElementIntersection } from '@ethlete/core';
import { AnyPagedQueryStack, PagedQueryStackDirection } from '@ethlete/query';
import { SCROLLABLE_SCROLL_CONTAINER } from '../scrollable/headless/scrollable-scroll-container';

/**
 * Fetches the next (or previous) page of a paged query stack when the host element scrolls into view.
 * Place it after the last item; it fetches again while it stays in view, until the stack is exhausted.
 */
@Directive({
  selector: '[etPagedQueryTrigger]',
  exportAs: 'etPagedQueryTrigger',
  host: {
    class: 'et-paged-query-trigger',
    'aria-hidden': 'true',
    etScrollableIgnoreChild: '',
    '[attr.data-loading]': 'loading() ? "" : null',
    '[attr.data-exhausted]': 'exhausted() ? "" : null',
  },
})
export class PagedQueryTriggerDirective {
  private hostElement = injectHostElement();
  private scrollContainer = inject(SCROLLABLE_SCROLL_CONTAINER, { optional: true });

  public stack = input.required<AnyPagedQueryStack | null>({ alias: 'etPagedQueryTrigger' });

  /** Which end of the stack the host sits at: `next` after the last item, `previous` before the first. */
  public direction = input<PagedQueryStackDirection>('next');

  /** The element whose bounds count as "in view". Defaults to the nearest `et-scrollable`'s track, else the viewport. */
  public root = input<HTMLElement | ElementRef<HTMLElement> | null>(null);

  public rootMargin = input('200px');
  public disabled = input(false, { transform: booleanAttribute });

  public loading = computed(() => this.stack()?.loading() ?? false);

  public exhausted = computed(() => {
    const stack = this.stack();

    if (!stack) return false;

    return this.direction() === 'next' ? stack.isLastPageLoaded() : stack.isFirstPageLoaded();
  });

  private canFetch = computed(() => {
    const stack = this.stack();

    if (!stack || this.disabled()) return false;

    return this.direction() === 'next' ? stack.canFetchNextPage() : stack.canFetchPreviousPage();
  });

  private resolvedRoot = computed(() => {
    const root = this.root();

    if (root) return root instanceof ElementRef ? root.nativeElement : root;
    if (!this.scrollContainer) return null;

    return this.scrollContainer()?.nativeElement ?? undefined;
  });

  private intersection = signalElementIntersection(this.hostElement, {
    root: computed(() => this.resolvedRoot() ?? null),
    rootMargin: this.rootMargin,
    enabled: computed(() => this.canFetch() && this.resolvedRoot() !== undefined),
  });

  constructor() {
    effect(() => {
      const inView = this.intersection().at(-1)?.isIntersecting ?? false;

      if (inView && untracked(() => this.canFetch())) untracked(() => this.fetch());
    });
  }

  private fetch() {
    const stack = this.stack();

    if (!stack) return;

    if (this.direction() === 'next') stack.fetchNextPage();
    else stack.fetchPreviousPage();
  }
}
