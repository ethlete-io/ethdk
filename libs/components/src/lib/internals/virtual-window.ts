import { Signal, computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { signalElementDimensions } from '@ethlete/core';
import { EMPTY, fromEvent, switchMap, tap } from 'rxjs';

export type VirtualWindowConfig = {
  /**
   * The scrollable viewport the window tracks. While `null`, the window is pass-through:
   * every item is inside the range and the paddings are zero.
   */
  container: Signal<HTMLElement | null>;
  itemCount: Signal<number>;
  /** Row height assumed until a rendered row was measured. Reactive so a host input can drive it. */
  estimateItemHeight: number | Signal<number>;
  /** Rows kept rendered beyond the visible range on both sides. Reactive so a host input can drive it. */
  overscan: number | Signal<number>;
};

export type VirtualWindowRange = {
  start: number;
  end: number;
};

export type VirtualWindow = {
  /** The slice of items to render: `items.slice(start, end)`. */
  range: Signal<VirtualWindowRange>;
  /** Block padding standing in for the unrendered rows above/below the range. */
  paddingTop: Signal<number>;
  paddingBottom: Signal<number>;
  /** Feeds a rendered row's real height into the window (uniform row height model). */
  measureItem: (element: HTMLElement) => void;
  /** Scrolls the container the minimal amount that brings the row into the viewport. */
  scrollToIndex: (index: number) => void;
};

/**
 * Height assumed for the viewport until the container reports a real one - matches the
 * select panel's default max height order of magnitude, so the first frame after mounting
 * renders roughly one viewport worth of rows instead of everything or nothing.
 */
const FALLBACK_VIEWPORT_SIZE = 400;

const asSignal = (value: number | Signal<number>): Signal<number> =>
  typeof value === 'number' ? signal(value) : value;

/**
 * Uniform-row-height windowing over a scroll container: only the rows near the viewport are
 * rendered, block paddings stand in for the rest of the scroll height. Purely behavioral -
 * the caller renders `range()` and applies the paddings. Must be created in an injection
 * context (it subscribes to the container's scroll and size).
 */
export const createVirtualWindow = (config: VirtualWindowConfig): VirtualWindow => {
  const estimateItemHeight = asSignal(config.estimateItemHeight);
  const overscan = asSignal(config.overscan);
  // Height of a real, rendered row once one was measured; falls back to the estimate until then.
  const measuredItemHeight = signal<number | null>(null);
  const itemHeight = computed(() => measuredItemHeight() ?? estimateItemHeight());
  const scrollOffset = signal(0);
  const containerDimensions = signalElementDimensions(config.container);
  const viewportSize = computed(() => containerDimensions().client?.height ?? 0);

  // a scroll request that arrived before the container existed (e.g. scrolling the selected
  // option into view while the panel is still mounting) - replayed once it does
  let pendingScrollIndex: number | null = null;

  const scrollToIndex = (index: number) => {
    const container = config.container();

    if (!container) {
      pendingScrollIndex = index;

      return;
    }

    const height = itemHeight();
    const viewport = viewportSize() || FALLBACK_VIEWPORT_SIZE;
    const rowTop = index * height;
    const rowBottom = rowTop + height;
    const current = container.scrollTop;
    let next = current;

    if (rowTop < current) {
      next = rowTop;
    } else if (rowBottom > current + viewport) {
      next = rowBottom - viewport;
    }

    if (next !== current) {
      container.scrollTop = next;
      // read back instead of trusting `next` - the browser clamps to the scrollable range
      scrollOffset.set(container.scrollTop);
    }
  };

  toObservable(config.container)
    .pipe(
      switchMap((container) => {
        if (!container) {
          return EMPTY;
        }

        scrollOffset.set(container.scrollTop);

        if (pendingScrollIndex !== null) {
          const index = pendingScrollIndex;

          pendingScrollIndex = null;
          scrollToIndex(index);
        }

        // windowing needs the raw scroll offset on every scroll event - the scroll-state
        // utility only exposes can-scroll flags, not a live position
        // eslint-disable-next-line ethlete/prefer-scroll-state
        return fromEvent(container, 'scroll', { passive: true }).pipe(tap(() => scrollOffset.set(container.scrollTop)));
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  const range = computed<VirtualWindowRange>(() => {
    const count = config.itemCount();

    if (!count || !config.container()) {
      return { start: 0, end: count };
    }

    const height = itemHeight();
    const viewport = viewportSize() || FALLBACK_VIEWPORT_SIZE;
    const offset = scrollOffset();
    // clamp into the item range: when the count shrinks while scrolled far down (filtering a
    // long list), the stale offset would otherwise start past the end - the browser's own
    // clamp-scroll event arrives a frame later, but the window must never be empty until then
    const rows = overscan();
    const start = Math.min(Math.max(0, Math.floor(offset / height) - rows), Math.max(0, count - 1));
    const end = Math.min(count, Math.max(Math.ceil((offset + viewport) / height) + rows, start + 1));

    return { start, end };
  });

  const paddingTop = computed(() => range().start * itemHeight());
  const paddingBottom = computed(() => Math.max(0, (config.itemCount() - range().end) * itemHeight()));

  const measureItem = (element: HTMLElement) => {
    const height = element.offsetHeight;

    if (height > 0 && height !== measuredItemHeight()) {
      measuredItemHeight.set(height);
    }
  };

  return { range, paddingTop, paddingBottom, measureItem, scrollToIndex };
};
