import { afterNextRender, computed, Directive, effect, inject, Injector, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { dragGestureFrom, injectPrefersReducedMotion, injectRenderer } from '@ethlete/core';
import { EMPTY, exhaustMap, fromEvent, tap } from 'rxjs';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableReorderOverlayComponent } from './table-reorder-overlay.component';

/** Options for {@link TableReorderDirective}. */
export type TableReorderConfig = TableFeatureConfig;

/** How long a column takes to slide between preview positions. */
const PREVIEW_DURATION_MS = 160;

/** Dead zone (px) each side of a column's midpoint — see {@link TableReorderDirective.flipThresholdOf}. */
const FLIP_HYSTERESIS_PX = 12;

/** The column order that dropping `key` next to `overKey` (on the given side) would produce. */
const landingOrder = (order: readonly string[], move: { key: string; overKey: string; before: boolean }) => {
  const without = order.filter((candidate) => candidate !== move.key);
  const over = without.indexOf(move.overKey);

  if (over === -1) return [...order];

  const at = move.before ? over : over + 1;

  return [...without.slice(0, at), move.key, ...without.slice(at)];
};

/** The inline offset each column starts at, walking a given order's widths from zero. */
const runningOffsets = (order: readonly string[], widths: ReadonlyMap<string, number>) => {
  const offsets = new Map<string, number>();
  let x = 0;

  for (const key of order) {
    offsets.set(key, x);
    x += widths.get(key) ?? 0;
  }

  return offsets;
};

/**
 * Opt-in drag-to-reorder columns for `et-table`: dragging a header lifts a floating ghost, and the
 * columns slide into the order they'd take on release, so the table itself previews the drop.
 *
 * The drag has to live on the header cells the *table* renders, so this delegates `pointerdown` from
 * the table's host and drives `dragGestureFrom` (the primitive behind `etDragHandle`) on the cell that
 * was hit. The ghost is drawn by a layer the table hosts ({@link TableReorderOverlayComponent}).
 *
 * Pinned columns are excluded: they anchor to an edge, so dragging one into the scrolling middle
 * leaves a gap and breaks the sticky offsets.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTableReorder />
 */
@Directive({
  selector: '[etTableReorder]',
  exportAs: 'etTableReorder',
})
export class TableReorderDirective {
  public table = injectTableFeatureHost('etTableReorder');
  private injector = inject(Injector);
  private renderer = injectRenderer();
  private prefersReducedMotion = injectPrefersReducedMotion();

  /** See {@link TableReorderConfig}. */
  public config = input({} as TableReorderConfig, {
    alias: 'etTableReorder',
    transform: tableFeatureConfig<TableReorderConfig>,
  });

  private enabled = computed(() => this.config().enabled ?? true);

  /** The column key being dragged, and the header text shown in the floating ghost. */
  public dragging = signal<{ key: string; header: string } | null>(null);

  /** Live pointer position — drives the ghost. */
  public pointer = signal<{ x: number; y: number } | null>(null);

  // Where a drop would land: the column it would insert next to, and which side.
  private target = signal<{ key: string; before: boolean } | null>(null);

  // The preview offset currently applied to each shifted column, so clearing doesn't have to touch
  // every cell in the table.
  private previewOffsets = new Map<string, number>();

  // The last previewed landing order, to skip re-applying identical transforms on every pointer move.
  private previewSignature: string | null = null;

  constructor() {
    this.table.registerLayer({
      component: TableReorderOverlayComponent,
      injector: this.injector,
      enabled: this.enabled,
    });

    // The grab affordance is on the table host, so only a reorderable table's headers advertise it.
    effect(() => {
      const method = this.enabled() ? 'addClass' : 'removeClass';

      this.renderer[method](this.table.element, 'et-table-host--reorderable');
    });

    // A delegated pointerdown on the table sees every header cell, without the table having to know
    // this feature exists (and without it importing any drag code).
    fromEvent<PointerEvent>(this.table.element, 'pointerdown')
      .pipe(
        // one gesture at a time — a second pointer must not start a competing drag
        exhaustMap((event) => {
          const hit = this.headerCellAt(event);

          if (!hit) return EMPTY;

          return dragGestureFrom(event, hit.cell).pipe(
            tap((gesture) => {
              if (gesture.type === 'start') this.start(hit.key, gesture.data);
              if (gesture.type === 'move') this.move(gesture.data);
              if (gesture.type === 'end') this.end();
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** The reorderable header cell a pointerdown landed in, or `null` when the drag must not start. */
  private headerCellAt(event: PointerEvent) {
    if (event.button !== 0 || !this.enabled()) return null;

    const cells = this.table.headerCellElements();
    const path = event.composedPath();
    const index = cells.findIndex((cell) => path.includes(cell));

    if (index === -1) return null;

    const column = this.table.visibleColumnsMeta()[index];
    const cell = cells[index];

    // Pinned columns can't be reordered — they anchor to an edge. A nested drag handle (the resize
    // grip) stops its own pointerdown, so reaching here means the header itself was grabbed.
    if (!column || !cell || this.table.effectiveStickyOf(column.key) !== null) return null;

    return { cell, key: column.key };
  }

  private start(key: string, at: { clientX: number; clientY: number }) {
    const header = this.table.visibleColumnsMeta().find((column) => column.key === key)?.header ?? key;

    this.dragging.set({ key, header });
    this.pointer.set({ x: at.clientX, y: at.clientY });
    this.target.set(null);
    this.previewSignature = null;
    this.markDragging(key, true);
  }

  private move(at: { clientX: number; clientY: number }) {
    if (!this.dragging()) return;

    this.pointer.set({ x: at.clientX, y: at.clientY });
    this.resolveDropTarget(at.clientX);
    this.previewLandingOrder();
  }

  /** Commit the deferred move once; the columns are already sitting where it puts them. */
  private end() {
    const dragging = this.dragging();
    const target = this.target();

    if (dragging) this.markDragging(dragging.key, false);

    const moved = dragging && target && target.key !== dragging.key;

    if (moved) this.table.moveColumnNextTo(dragging.key, { overKey: target.key, before: target.before });

    this.dragging.set(null);
    this.pointer.set(null);
    this.target.set(null);
    this.previewSignature = null;

    if (!moved) {
      // Nothing to commit — slide the preview back to the resting order.
      this.clearPreview({ animated: true });

      return;
    }

    // The preview already has every cell at its post-drop x, so the transforms must survive until the
    // reordered grid has actually rendered — dropping them any earlier flashes the old order for a
    // frame. Cleared in the write phase of that render, which is before it paints.
    afterNextRender({ write: () => this.clearPreview({ animated: false }) }, { injector: this.injector });
  }

  /**
   * Resolve which column the pointer is over and which side it would drop on.
   *
   * Hit-testing runs against the columns' **resting** slots (see {@link restingBoundsOf}), not where
   * the preview has moved them to. Measuring them as-drawn would feed the preview back into its own
   * input: shifting a column out from under the pointer changes which column is hit, which picks a
   * different landing order, which shifts a different set of columns — and the row oscillates on its
   * own. Resting slots never move, so each pointer position maps to exactly one landing order.
   */
  private resolveDropTarget(clientX: number) {
    const dragging = this.dragging()?.key;
    const cells = this.table.headerCellElements();
    const columns = this.table.visibleColumnsMeta();

    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      const overColumn = columns[index];
      const overKey = overColumn?.key;

      if (!cell || !overColumn || !overKey) continue;

      // Pinned columns anchor to an edge — never drop a column onto (or across) one.
      if (this.table.effectiveStickyOf(overKey) !== null) continue;

      const bounds = this.restingBoundsOf(cell);

      if (clientX < bounds.start || clientX > bounds.end) continue;

      if (overKey === dragging) {
        // Hovering the dragged column's own slot — releasing here changes nothing.
        this.target.set(null);

        return;
      }

      this.target.set({ key: overKey, before: clientX < this.flipThresholdOf(bounds, overKey) });

      return;
    }
  }

  /**
   * Where the column sits in the table's real layout, whatever the preview is currently drawing.
   *
   * `offsetLeft`/`offsetWidth` are layout geometry, so — unlike a client rect — they ignore the
   * preview's transforms, *including* a transform part-way through its transition. That matters: a
   * client rect measured mid-slide sits between the two orders, so backing out the preview's final
   * offset lands nowhere real and a 1px pointer move can resolve to a whole different column.
   *
   * Both halves are read live rather than captured at drag start, so the bounds stay right if the
   * table is scrolled sideways mid-drag.
   */
  private restingBoundsOf(cell: HTMLElement) {
    const parent = cell.offsetParent as HTMLElement | null;

    const anchor = parent ? parent.getBoundingClientRect().left + parent.clientLeft : 0;
    const start = anchor + cell.offsetLeft;

    return { start, end: start + cell.offsetWidth };
  }

  /**
   * The x at which the drop flips from this column's leading to its trailing side.
   *
   * That is its midpoint, biased *away* from whichever side is already showing. Without the bias a
   * hand resting on the midpoint flaps the preview — every pixel of tremor re-crosses it, and each
   * crossing slides the columns a full width in the opposite direction. The bias makes crossing back
   * a deliberate move instead, and is capped to a quarter of the column so a narrow one stays usable.
   */
  private flipThresholdOf(bounds: { start: number; end: number }, key: string) {
    const current = this.target();
    const showing = current?.key === key ? current.before : null;
    const slack = Math.min(FLIP_HYSTERESIS_PX, (bounds.end - bounds.start) / 4);
    const middle = (bounds.start + bounds.end) / 2;

    if (showing === null) return middle;

    return showing ? middle + slack : middle - slack;
  }

  /**
   * Slide every column to the x it would have if the drag ended now, so the table shows the landing
   * order live instead of a floating bar hinting at it.
   *
   * Offsets are derived from the two orders rather than from measured positions: cumulative widths
   * give an exact delta per column, and a pinned column — which can never be reordered — keeps its
   * index and so lands on a delta of 0. Measuring `left` instead would read a sticky cell's *painted*
   * x, which drifts from its layout x as soon as the table is scrolled sideways.
   */
  private previewLandingOrder() {
    const dragging = this.dragging()?.key;
    const target = this.target();
    const columns = this.table.visibleColumnsMeta();
    const cells = this.table.headerCellElements();

    if (!dragging) return;

    const order = columns.map((column) => column.key);
    const landing =
      target && target.key !== dragging
        ? landingOrder(order, { key: dragging, overKey: target.key, before: target.before })
        : order;
    const signature = landing.join(' ');

    if (signature === this.previewSignature) return;

    this.previewSignature = signature;

    const widths = new Map(order.map((key, index) => [key, cells[index]?.getBoundingClientRect().width ?? 0]));
    const restingX = runningOffsets(order, widths);
    const landingX = runningOffsets(landing, widths);
    const transition = this.prefersReducedMotion() ? 'none' : `transform ${PREVIEW_DURATION_MS}ms ease`;

    for (const key of order) {
      const delta = (landingX.get(key) ?? 0) - (restingX.get(key) ?? 0);
      const shifted = Math.abs(delta) >= 0.5;

      if (!shifted && !this.previewOffsets.has(key)) continue;

      for (const element of this.cellsFor(key)) {
        this.renderer.setStyle(element, { transition, transform: shifted ? `translateX(${delta}px)` : '' });
      }

      if (shifted) this.previewOffsets.set(key, delta);
      else this.previewOffsets.delete(key);
    }
  }

  /** Drop the preview transforms — instantly once the real order has caught up, animated otherwise. */
  private clearPreview({ animated }: { animated: boolean }) {
    for (const key of this.previewOffsets.keys()) {
      for (const element of this.cellsFor(key)) {
        this.renderer.setStyle(element, {
          transition: animated ? `transform ${PREVIEW_DURATION_MS}ms ease` : 'none',
        });
        this.renderer.removeStyle(element, 'transform');
      }
    }

    this.previewOffsets.clear();
  }

  /** A column's header cell plus every body cell under it. */
  private cellsFor(key: string) {
    const index = this.table.visibleColumnsMeta().findIndex((column) => column.key === key);
    const header = this.table.headerCellElements()[index];

    return header ? [header, ...this.table.bodyCellElementsFor(key)] : this.table.bodyCellElementsFor(key);
  }

  // The source header dims while its ghost is dragged. Set imperatively: the cell belongs to the
  // table's template, so there is no binding of ours to drive it.
  private markDragging(key: string, dragging: boolean) {
    const cells = this.table.headerCellElements();
    const index = this.table.visibleColumnsMeta().findIndex((column) => column.key === key);
    const cell = cells[index];

    if (!cell) return;

    if (dragging) {
      this.renderer.addClass(cell, 'et-table-header-cell--dragging');
    } else {
      this.renderer.removeClass(cell, 'et-table-header-cell--dragging');
    }
  }
}
