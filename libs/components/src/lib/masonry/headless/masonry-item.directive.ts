import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { RuntimeError, nextFrame, signalHostElementDimensions } from '@ethlete/core';
import { MASONRY_ERROR_CODES } from '../masonry-errors';
import { MASONRY_TOKEN } from './masonry.tokens';

/**
 * One item in a masonry. It measures itself — continuously, via its own `ResizeObserver` — and takes the
 * width and position the masonry works out from those measurements.
 *
 * Continuous measurement is what makes late content behave: an image that arrives after layout, a card that
 * reflows when a translation swaps in, a description that expands on click. cdk measured each item once and
 * kept the number, so any of those left the item overlapping its neighbour until the next resize.
 *
 * The element is yours, which is what lets a masonry be a real list — `<ul etMasonry>` with `<li
 * etMasonryItem>` children needs no ARIA roles at all.
 *
 * @example
 * <li etMasonryItem>…</li>
 */
@Directive({
  selector: '[etMasonryItem]',
  exportAs: 'etMasonryItem',
  host: {
    class: 'et-masonry-item',
    role: 'listitem',
    '[style.width.px]': 'columnInlineSize()',
    // Physical offsets from a logical origin: the stylesheet anchors the item with `inset-inline-start`, so
    // these two numbers place it correctly in both writing directions (it flips the inline sign for RTL).
    '[style.--_et-masonry-item-inline-offset.px]': 'placement()?.inlineOffset',
    '[style.--_et-masonry-item-block-offset.px]': 'placement()?.blockOffset',
    '[attr.data-column]': 'placement()?.column',
    '[attr.data-positioned]': 'isPositioned() ? "" : null',
    '[attr.data-can-move]': 'canMove() ? "" : null',
  },
})
export class MasonryItemDirective {
  /** @internal The masonry sorts its items by document position, which needs their elements. */
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private masonry = inject(MASONRY_TOKEN, { optional: true });
  private dimensions = signalHostElementDimensions();

  /**
   * The item's measured border box.
   *
   * `rect()` rather than the integer `offset` sizes: a column width is rarely a whole number of pixels (the
   * remainder is shared out between the columns), and rounding every item's height would drift the columns
   * apart by a pixel per item stacked.
   */
  private measured = computed(() => this.dimensions().rect?.() ?? null);

  /** How tall the item is right now — what the masonry packs with. */
  public blockSize = computed(() => this.measured()?.height ?? 0);

  /**
   * How wide the item is right now. The masonry compares this against the column width to know whether the
   * item has re-measured since the columns changed — a stale width means a stale height too, and both arrive
   * together when the observer fires.
   */
  public inlineSize = computed(() => this.measured()?.width ?? 0);

  /** The width the masonry has assigned, or `null` before its container has been measured. */
  public columnInlineSize = computed(() => {
    const { count, inlineSize } = this.masonry?.columns() ?? { count: 0, inlineSize: 0 };

    return count === 0 ? null : inlineSize;
  });

  /**
   * Whether the item has reported its size *at the width the masonry gave it*. Until it has, its height is
   * the height it had at some other width, so the placement derived from it would be wrong. The observer
   * delivers both sizes together, which is what makes the width a reliable proxy for "this height is current".
   */
  public isMeasured = computed(() => {
    const columnInlineSize = this.columnInlineSize();

    // Sub-pixel column widths are normal — the remainder is shared out between the columns.
    return columnInlineSize !== null && Math.abs(this.inlineSize() - columnInlineSize) < 1;
  });

  /** Where the masonry has put this item, or `null` before it has. */
  public placement = computed(() => this.masonry?.placementOf(this) ?? null);

  /** Whether the item's placement is current, i.e. derived from a height measured at its present width. */
  public isPlaced = computed(() => this.isMeasured() && this.placement() !== null);

  /**
   * Whether the item has a place on screen — **sticky**: it fades in on its first placement and then stays
   * visible. That the reveal latches is the point. Every column width change un-measures every item for a
   * frame (its recorded width is the old one until the observer reports), and a reveal tied to the live
   * measurement would therefore fade the whole masonry out and back in on every frame of a window drag.
   *
   * Before the first placement there is nothing to show but a pile of items in the container's start corner,
   * which is what the initial transparency is for.
   */
  private hasBeenPlaced = linkedSignal({
    source: () => this.isPlaced(),
    computation: (isPlaced, previous) => isPlaced || previous?.value === true,
  });

  public isPositioned = computed(() => this.hasBeenPlaced());

  private isMoveArmed = signal(false);

  /**
   * Whether this item may animate a move. It must not animate the first one: before it has a placement its
   * offsets are zero, so an armed transition would slide it in from the container's start corner — and an item
   * appended to a feed would slide in from there too. So the transition is armed a frame *after* the item is
   * placed, by which point the browser has painted it where it belongs and there is nothing to animate from.
   */
  public canMove = computed(() => this.isMoveArmed());

  constructor() {
    const masonry = this.masonry;

    if (masonry) {
      masonry.registerItem(this);

      inject(DestroyRef).onDestroy(() => masonry.unregisterItem(this));
    }

    // `nextFrame` is two frames, which is what makes this safe: the placement has been through a style
    // recalculation of its own before the transition exists, so it cannot be the thing that transitions.
    let hasArmed = false;

    effect(() => {
      if (hasArmed || !this.isPositioned()) return;

      hasArmed = true;
      nextFrame(() => this.isMoveArmed.set(true));
    });

    if (ngDevMode) {
      afterNextRender(() => {
        if (!masonry) {
          throw new RuntimeError(
            MASONRY_ERROR_CODES.PART_OUTSIDE_MASONRY,
            '[MasonryItemDirective] etMasonryItem must be placed inside an [etMasonry] element, which is what ' +
              'measures and positions it.',
          );
        }
      });
    }
  }
}
