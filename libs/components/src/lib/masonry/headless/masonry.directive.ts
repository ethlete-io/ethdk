import { Directive, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import {
  RuntimeError,
  injectStyleManager,
  numberBreakpointTransform,
  provideBreakpointInstance,
  signalElementChildren,
  signalHostElementDimensions,
} from '@ethlete/core';
import { sortByDomOrder } from '../../internals/dom-order';
import { MASONRY_ERROR_CODES } from '../masonry-errors';
import { MasonryStylesComponent } from '../masonry-styles.component';
import { MasonryPlacement } from '../masonry.types';
import { packMasonryItems, resolveMasonryColumns } from './internals/masonry-layout';
import { useMasonryResizeSettled } from './internals/masonry-resize-settled';

const isSameAssignment = (a: ReadonlyMap<MasonryItemDirective, number>, b: ReadonlyMap<MasonryItemDirective, number>) =>
  a.size === b.size && [...a].every(([item, column]) => b.get(item) === column);
import { MasonryItemDirective } from './masonry-item.directive';
import { MASONRY_TOKEN } from './masonry.tokens';

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
 * whose text reflows, moves the ones below it - the one thing cdk's one-shot `getBoundingClientRect()`
 * snapshots could not do.
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

  /**
   * @internal The items in DOM order, which for masonry *is* the placement order: registration order follows
   * creation order, and a `@for` that re-orders its items would otherwise pack them by the order they were
   * born in rather than the order they are read in.
   */
  public items = computed(() => sortByDomOrder(this.registeredItems(), (item) => item.elementRef.nativeElement));

  /**
   * How wide the container is. Only the inline size is taken from the observed dimensions, deliberately: this
   * directive *sets* the container's height, so a signal carrying both would see its own write and lay out
   * again. Reading one number out of it means the recompute stops at an unchanged value instead.
   */
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
   * The columns items have already been given, and the column count they were given for. Rebalancing is a
   * *geometry* decision, not a content one: see `repack()`.
   */
  private columnAssignments = signal<{ columnCount: number; byItem: ReadonlyMap<MasonryItemDirective, number> } | null>(
    null,
  );

  /**
   * Every item's position, derived rather than assigned. The whole layout is one `computed` over the item
   * sizes, the column grid and the gap - so there is no invalidation to get right, no imperative pass over
   * the DOM, and appending to a feed re-derives the existing placements *identically* because the packing is
   * prefix-stable. What cdk did with a partial-invalidation mode, Angular's binding dedupe does here: an
   * item whose placement is unchanged is not written to again.
   */
  private layout = computed(() => {
    const items = this.items();
    const { count, inlineSize } = this.columns();
    const assignments = this.columnAssignments();

    // Assignments made for a different number of columns say nothing about this one, so a resize that changes
    // the count rebalances from scratch.
    const pinned = assignments?.columnCount === count ? assignments.byItem : null;

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
   * This is the signal to gate an infinite scroll on - fetching the next page while the current one is still
   * settling appends items against sizes that are about to change, which is what cdk needed its
   * `injectInfinityQueryResponseDelay` handshake for. That provider only ever existed for the legacy query
   * client, so this is the generic replacement: `disabled: !masonry.isSettled()` on the trigger, whatever the
   * client.
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
    // Structural CSS is mounted rather than shipped on a component, so the directive works standalone -
    // absolute positioning is this layout's mechanism, not its decoration, and a headless composition has to
    // get it too. The style manager de-duplicates, so many masonries inject one <style>.
    this.styleManager.mount(MasonryStylesComponent);

    // Freezing the assignments is what makes a card growing a local event. It happens on settling, never
    // before: an item that has not been measured has no height yet, so a batch of appended items would all
    // look like they belong in whichever column was shortest and pile into it - permanently, once frozen.
    effect(() => {
      if (!this.isSettled()) return;

      const columnCount = this.columns().count;
      const byItem = new Map<MasonryItemDirective, number>();

      for (const [item, placement] of this.layout().placements) {
        if (placement) byItem.set(item, placement.column);
      }

      untracked(() => {
        // Only when something actually changed: the write feeds back into the layout this was derived from,
        // and re-freezing an identical mapping every time would never come to rest.
        const current = this.columnAssignments();

        if (current && current.columnCount === columnCount && isSameAssignment(current.byItem, byItem)) return;

        this.columnAssignments.set({ columnCount, byItem });
      });
    });

    if (ngDevMode) {
      const children = signalElementChildren(this.elementRef);
      let hasCheckedItems = false;

      // An empty masonry is a legitimate state (an unfetched feed), so this checks the first time there *are*
      // children - children without the item directive are positioned by nothing and stay invisible, which
      // is a silent failure worth a loud error.
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
