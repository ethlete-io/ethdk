import {
  afterRenderEffect,
  booleanAttribute,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  signal,
  untracked,
} from '@angular/core';
import { injectHostElement } from '@ethlete/core';
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
  private zone = inject(NgZone);
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

  private observer = signal<IntersectionObserver | null>(null);

  constructor() {
    afterRenderEffect((onCleanup) => {
      const root = this.resolvedRoot();
      const rootMargin = this.rootMargin();

      if (root === undefined) return;

      // signalElementIntersection measures the host when it starts observing, during change detection,
      // before new items have their layout - that entry would fetch a page the sentinel is no longer
      // near. Only the browser's own callbacks run after layout.
      // eslint-disable-next-line ethlete/no-native-observers -- needs post-layout entries only, see above
      const observer = new IntersectionObserver((entries) => this.fetchIfInView(entries), { root, rootMargin });

      untracked(() => this.observer.set(observer));

      onCleanup(() => {
        observer.disconnect();
        untracked(() => this.observer.set(null));
      });
    });

    effect(() => {
      const observer = this.observer();

      this.stack();
      this.direction();

      const canFetch = this.canFetch();

      if (!observer) return;

      // An observer reports changes only. Observing again delivers a fresh entry, so a trigger that is
      // still in view after a page loaded fetches the next one.
      observer.unobserve(this.hostElement);
      if (canFetch) observer.observe(this.hostElement);
    });
  }

  private fetchIfInView(entries: IntersectionObserverEntry[]) {
    const stack = this.stack();

    if (!stack || !entries.at(-1)?.isIntersecting || !this.canFetch()) return;

    this.zone.run(() => (this.direction() === 'next' ? stack.fetchNextPage() : stack.fetchPreviousPage()));
  }
}
