import { Directive, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import {
  RuntimeError,
  injectStyleManager,
  numberBreakpointTransform,
  provideBreakpointInstance,
  signalElementChildren,
  signalElementMutations,
  signalHostElementDimensions,
  mountEasingTokens,
} from '@ethlete/core';
import { sortByDomOrder } from '../../internals/dom-order';
import { MASONRY_ERROR_CODES } from '../masonry-errors';
import { MasonryStylesComponent } from '../masonry-styles.component';
import { MasonryPlacement } from '../masonry.types';
import { packMasonryItems, resolveMasonryColumns } from './internals/masonry-layout';
import { useMasonryResizeSettled } from './internals/masonry-resize-settled';
import { MasonryItemDirective } from './masonry-item.directive';
import { MASONRY_TOKEN } from './masonry.tokens';

const isSameAssignment = (a: ReadonlyMap<MasonryItemDirective, number>, b: ReadonlyMap<MasonryItemDirective, number>) =>
  a.size === b.size && [...a].every(([item, column]) => b.get(item) === column);

const isSameOrder = (a: readonly MasonryItemDirective[], b: readonly MasonryItemDirective[]) =>
  a.length === b.length && a.every((item, index) => b[index] === item);

const isFrozenReadingOrder = (
  items: readonly MasonryItemDirective[],
  frozen: { order: readonly MasonryItemDirective[]; byItem: ReadonlyMap<MasonryItemDirective, number> },
) => {
  const current = new Set(items);

  // Only the items that were around when the columns were frozen and still are: an appended one has no
  // frozen column yet, and a removed one cannot say anything about the order of the rest.
  return isSameOrder(
    items.filter((item) => frozen.byItem.has(item)),
    frozen.order.filter((item) => current.has(item)),
  );
};

/**
 * Packs variable-height items into columns, each item going to whichever column is currently shortest - the
 * layout a photo feed wants, where cropping every card to a common height would be the alternative.
 *
 * It measures and positions, because CSS still can't: native masonry (`display: grid-lanes`, CSS Grid Level
 * 3) is not Baseline as of this writing, and CSS `columns` fills column by column, so the reading order of a
 * feed would no longer be its visual order. Items are therefore absolutely positioned from their measured
 * sizes, which keeps DOM order and reading order the same and means a reflow never relayouts the page
 * around it.
 *
 * The measuring is per item and continuous (a `ResizeObserver` each), so a card whose image loads late, or
 * whose text reflows, moves the ones below it.
 *
 * @example
 * <ul etMasonry [columnWidth]="240" [gap]="16">
 *   @for (photo of photos(); track photo.id) {
 *     <li etMasonryItem><img [src]="photo.url" alt="" /></li>
 *   }
 * </ul>
 */
@Directive({
  selector: '[etMasonry]',
  exportAs: 'etMasonry',
  providers: [{ provide: MASONRY_TOKEN, useExisting: MasonryDirective }, provideBreakpointInstance(MasonryDirective)],
  host: {
    class: 'et-masonry',
    role: 'list',
    // The items are out of flow, so nothing else can give the container a height.
    '[style.height.px]': 'blockSize()',
    '[attr.data-settled]': 'isSettled() ? "" : null',
    '[attr.data-resizing]': 'isResizing() ? "" : null',
  },
})
export class MasonryDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private styleManager = injectStyleManager();

  /**
   * The narrowest a column may be, in px - a minimum rather than a target. As many columns as fit at that
   * width are used (gaps included), and the leftover space is shared out between them, so the columns always
   * fill the container. That is `repeat(auto-fill, minmax(X, 1fr))`, expressed as a number because the
   * packing needs it as one.
   *
   * Accepts a per-breakpoint map (`{ xs: 150, md: 240 }`) for a layout that wants coarser columns on a phone
   * than the container width alone would give. @default 250
   */
  public columnWidth = input(250, { transform: numberBreakpointTransform(250) });

  /**
   * The space between columns and between stacked items, in px. Also accepts a per-breakpoint map. It is a
   * number rather than CSS `gap` because the items are positioned, not laid out - CSS never sees the
   * columns. @default 16
   */
  public gap = input(16, { transform: numberBreakpointTransform(16) });
  private dimensions = signalHostElementDimensions();

  private registeredItems = signal<MasonryItemDirective[]>([]);

  private childMutations = signalElementMutations(this.elementRef, { childList: true });

  /**
   * @internal The items in DOM order, which for masonry *is* the placement order: registration order follows
   * creation order, and a `@for` that re-orders its items would otherwise pack them by the order they were
   * born in rather than the order they are read in.
   */
  public items = computed(
    () => {
      this.childMutations();

      return sortByDomOrder(this.registeredItems(), (item) => item.elementRef.nativeElement);
    },
    { equal: isSameOrder },
  );

  /** How wide the container is. */
  public containerInlineSize = computed(() => this.dimensions().client?.width ?? 0);

  /** The column grid in effect: how many, and how wide. `count: 0` until the container has been measured. */
  public columns = computed(() =>
    resolveMasonryColumns({
      containerInlineSize: this.containerInlineSize(),
      minColumnInlineSize: this.columnWidth(),
      gap: this.gap(),
    }),
  );

  /**
   * The columns items have already been given, the column count they were given for, and the reading order
   * they were given in. Rebalancing is a *geometry* decision, not a content one: see `repack()`.
   */
  private columnAssignments = signal<{
    columnCount: number;
    order: readonly MasonryItemDirective[];
    byItem: ReadonlyMap<MasonryItemDirective, number>;
  } | null>(null);

  private layout = computed(() => {
    const items = this.items();
    const { count, inlineSize } = this.columns();
    const assignments = this.columnAssignments();

    const pinned =
      assignments && assignments.columnCount === count && isFrozenReadingOrder(items, assignments)
        ? assignments.byItem
        : null;

    const packing = packMasonryItems({
      itemBlockSizes: items.map((item) => item.blockSize()),
      itemColumns: pinned ? items.map((item) => pinned.get(item) ?? null) : undefined,
      columnCount: count,
      columnInlineSize: inlineSize,
      gap: this.gap(),
    });

    return {
      blockSize: packing.blockSize,
      placements: new Map(items.map((item, index) => [item, packing.placements[index] ?? null])),
    };
  });

  /** How tall the container is, i.e. the tallest column. */
  public blockSize = computed(() => this.layout().blockSize);

  /**
   * Whether the layout matches what is on screen: the container has been measured, and every item has
   * reported its size at the current column width.
   *
   * Gate an infinite scroll on it (`disabled: !masonry.isSettled()` on the trigger), so the next page is not
   * appended against sizes that are about to change.
   */
  public isSettled = computed(() => {
    if (this.columns().count === 0) return false;

    return this.items().every((item) => item.isMeasured());
  });

  /**
   * Whether the container itself has changed width in the last moment - a window drag, a panel opening, a
   * sidebar collapsing. Items snap to their new columns while it is true instead of animating: the columns
   * change every frame of a drag, so a move transition would be restarted every frame and the items would
   * trail behind the layout they belong to.
   */
  public isResizing = useMasonryResizeSettled(this.containerInlineSize);

  constructor() {
    mountEasingTokens();
    this.styleManager.mount(MasonryStylesComponent);

    // Freezing the assignments is what makes a card growing a local event. It happens on settling, never
    // before: an item that has not been measured has no height yet, so a batch of appended items would all
    // look like they belong in whichever column was shortest and pile into it - permanently, once frozen.
    effect(() => {
      if (!this.isSettled()) return;

      const columnCount = this.columns().count;
      const order = this.items();
      const byItem = new Map<MasonryItemDirective, number>();

      for (const [item, placement] of this.layout().placements) {
        if (placement) byItem.set(item, placement.column);
      }

      untracked(() => {
        // The write feeds back into the layout, so an unchanged mapping (order included) must not be re-set.
        const current = this.columnAssignments();

        if (
          current &&
          current.columnCount === columnCount &&
          isSameAssignment(current.byItem, byItem) &&
          isSameOrder(current.order, order)
        ) {
          return;
        }

        this.columnAssignments.set({ columnCount, order, byItem });
      });
    });

    if (ngDevMode) {
      const children = signalElementChildren(this.elementRef);
      let hasCheckedItems = false;

      effect(() => {
        const childCount = children().length;
        const itemCount = this.registeredItems().length;

        if (hasCheckedItems || childCount === 0) return;

        hasCheckedItems = true;

        if (itemCount === 0) {
          throw new RuntimeError(
            MASONRY_ERROR_CODES.MISSING_ITEMS,
            '[MasonryDirective] This masonry has children but none of them is a masonry item, so none of them ' +
              'can be measured or positioned. Add the etMasonryItem directive to each child.',
          );
        }
      });
    }
  }

  /** @internal Where an item sits, or `null` before the first measurement. */
  public placementOf(item: MasonryItemDirective): MasonryPlacement | null {
    return this.layout().placements.get(item) ?? null;
  }

  /**
   * Re-balance the columns from scratch, as if the items had just arrived.
   *
   * Items keep the column they were first given for as long as the column count holds, because the
   * alternative is a grid that reshuffles itself whenever any one card changes height - expanding a
   * description would move cards two columns away. The cost is that heights which change a lot *after* the
   * first layout leave the columns less even than a fresh pack would, so this is the escape hatch: call it
   * after replacing the content wholesale, and the packing balances again. A resize that changes the column
   * count rebalances on its own.
   */
  public repack() {
    this.columnAssignments.set(null);
  }

  /** @internal Called by an item while it exists. */
  public registerItem(item: MasonryItemDirective) {
    this.registeredItems.update((items) => [...items, item]);
  }

  /** @internal */
  public unregisterItem(item: MasonryItemDirective) {
    this.registeredItems.update((items) => items.filter((registered) => registered !== item));
  }
}
