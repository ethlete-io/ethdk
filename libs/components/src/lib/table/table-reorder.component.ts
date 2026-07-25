import { afterNextRender, Component, inject, Injector, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { dragGestureFrom, forceReflow, injectPrefersReducedMotion, injectRenderer } from '@ethlete/core';
import { EMPTY, exhaustMap, fromEvent, tap } from 'rxjs';
import { injectTableFeatureHost } from './table-features';

/**
 * Opt-in drag-to-reorder columns for `et-table`: dragging a header lifts a floating ghost, shows where
 * the column would land, and animates the columns into their new positions on drop. Place it inside
 * the table.
 *
 * Unlike the other features this one can't hand the table a template — the drag has to live on the
 * header cells the *table* renders, so it delegates `pointerdown` from the table's host and drives
 * `dragGestureFrom` (the primitive behind `etDragHandle`) on the cell that was hit. The ghost and the
 * drop indicator are rendered from this component's own view.
 *
 * Pinned columns are excluded: they anchor to an edge, so dragging one into the scrolling middle
 * leaves a gap and breaks the sticky offsets.
 *
 * @example
 * <et-table [data]="rows()" [columns]="columns">
 *   <et-table-reorder />
 * </et-table>
 */
@Component({
  selector: 'et-table-reorder',
  templateUrl: './table-reorder.component.html',
  styleUrl: './table-reorder.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableReorderComponent {
  public table = injectTableFeatureHost('et-table-reorder');
  private injector = inject(Injector);
  private renderer = injectRenderer();
  private prefersReducedMotion = injectPrefersReducedMotion();

  /** The column key being dragged, and the header text shown in the floating ghost. */
  protected dragging = signal<{ key: string; header: string } | null>(null);

  /** Live pointer position — drives the ghost. */
  protected pointer = signal<{ x: number; y: number } | null>(null);

  /** Viewport x of the drop indicator line, and the vertical span it covers. */
  protected indicatorX = signal<number | null>(null);
  protected bounds = signal<{ top: number; height: number } | null>(null);

  // Where a drop would land: the column it would insert next to, and which side.
  private target = signal<{ key: string; before: boolean } | null>(null);

  constructor() {
    this.renderer.addClass(this.table.element, 'et-table-host--reorderable');

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
    if (event.button !== 0) return null;

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
    const rect = this.table.element.getBoundingClientRect();
    const header = this.table.visibleColumnsMeta().find((column) => column.key === key)?.header ?? key;

    this.dragging.set({ key, header });
    this.pointer.set({ x: at.clientX, y: at.clientY });
    this.target.set(null);
    this.indicatorX.set(null);
    this.bounds.set({ top: rect.top, height: rect.height });
    this.markDragging(key, true);
  }

  private move(at: { clientX: number; clientY: number }) {
    if (!this.dragging()) return;

    this.pointer.set({ x: at.clientX, y: at.clientY });
    this.resolveDropTarget(at.clientX);
  }

  /** Commit the deferred move once, then animate the columns into place. */
  private end() {
    const dragging = this.dragging();
    const target = this.target();
    const firstLefts = this.captureColumnLefts();

    if (dragging) this.markDragging(dragging.key, false);

    if (dragging && target && target.key !== dragging.key) {
      this.table.moveColumnNextTo(dragging.key, { overKey: target.key, before: target.before });
    }

    this.dragging.set(null);
    this.pointer.set(null);
    this.target.set(null);
    this.indicatorX.set(null);
    this.bounds.set(null);

    if (dragging && !this.prefersReducedMotion()) {
      // The order changed synchronously; FLIP once the reordered grid has rendered.
      afterNextRender(() => this.playReorderFlip(firstLefts), { injector: this.injector });
    }
  }

  // Resolve which column the pointer is over and which side, and place the drop indicator at that edge.
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

      const rect = cell.getBoundingClientRect();

      if (clientX < rect.left || clientX > rect.right) continue;

      if (overKey === dragging) {
        // Hovering the dragged column itself — no move, no indicator.
        this.target.set(null);
        this.indicatorX.set(null);

        return;
      }

      const before = clientX < rect.left + rect.width / 2;

      this.target.set({ key: overKey, before });
      this.indicatorX.set(before ? rect.left : rect.right);

      return;
    }
  }

  // Left edge of every visible column's header, keyed by column, captured before the reorder commit.
  private captureColumnLefts() {
    const cells = this.table.headerCellElements();
    const columns = this.table.visibleColumnsMeta();
    const lefts = new Map<string, number>();

    cells.forEach((cell, index) => {
      const key = columns[index]?.key;

      if (key) lefts.set(key, cell.getBoundingClientRect().left);
    });

    return lefts;
  }

  // FLIP each column that moved: slide its header + body cells from their old x to the new one.
  private playReorderFlip(firstLefts: Map<string, number>) {
    const cells = this.table.headerCellElements();
    const columns = this.table.visibleColumnsMeta();

    cells.forEach((cell, index) => {
      const key = columns[index]?.key;
      const firstLeft = key ? firstLefts.get(key) : undefined;

      if (!key || firstLeft === undefined) return;

      const delta = firstLeft - cell.getBoundingClientRect().left;

      if (Math.abs(delta) < 1) return;

      const elements = [cell, ...this.table.bodyCellElementsFor(key)];

      // FLIP: pin each cell at its old x with no transition…
      for (const element of elements) {
        this.renderer.setStyle(element, { transition: 'none', transform: `translateX(${delta}px)` });
      }

      forceReflow(cell);

      // …then let it transition back to its new resting position.
      for (const element of elements) {
        this.renderer.setStyle(element, { transition: 'transform 200ms ease' });
        this.renderer.removeStyle(element, 'transform');
      }
    });
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
