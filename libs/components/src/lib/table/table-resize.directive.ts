import { computed, Directive, ElementRef, inject, Injector, input, signal } from '@angular/core';
import { DragMoveEvent } from '@ethlete/core';
import {
  injectTableFeatureHost,
  TableColumnMeta,
  TableFeatureConfig,
  tableFeatureConfig,
} from './headless/table-features';
import { TableResizeGripComponent } from './table-resize-grip.component';

const KEYBOARD_STEP = 10;
const KEYBOARD_LARGE_STEP = 50;

const keyboardTarget = (
  key: string,
  { now, step, min, max }: { now: number; step: number; min: number; max: number },
) => {
  switch (key) {
    case 'ArrowRight':
      return now + step;
    case 'ArrowLeft':
      return now - step;
    case 'Home':
      return min;
    case 'End':
      return Number.isFinite(max) ? max : null;
    default:
      return null;
  }
};

/** Options for {@link TableResizeDirective}. */
export type TableResizeConfig = TableFeatureConfig;

/**
 * Opt-in column resizing for `et-table`: adds a grip to every header cell's trailing edge that drags
 * the column's width, with a double-click to reset it. The grip is a focusable `role="separator"`
 * that the arrow keys, `Home` and `End` resize too.
 *
 * Widths live on the table (`state()`'s `TableColumnState.width`), so they survive reordering and
 * round-trip through `restoreState()` - even in a table that never imported this feature.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTableResize />
 */
@Directive({
  selector: '[etTableResize]',
  exportAs: 'etTableResize',
})
export class TableResizeDirective {
  public table = injectTableFeatureHost('etTableResize');
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** See {@link TableResizeConfig}. */
  public config = input({} as TableResizeConfig, {
    alias: 'etTableResize',
    transform: tableFeatureConfig<TableResizeConfig>,
  });

  // The column being dragged, with the width it had when the drag began - every move applies the
  // pointer's cumulative delta to that baseline, so the column can't drift over a long drag.
  private resizing = signal<{ key: string; startWidth: number; hadOverride: boolean; inlineSign: number } | null>(null);

  constructor() {
    // Renders after the filter trigger: the grip is absolutely positioned at the cell's edge.
    this.table.registerHeaderAdornment({
      component: TableResizeGripComponent,
      injector: inject(Injector),
      order: 10,
      // A lone column has nothing to trade width with - it already spans the table - so the grip
      // would only ever push the layout into overflow or leave a gap. Hide it until there are two.
      enabled: computed(() => (this.config().enabled ?? true) && this.table.visibleColumnsMeta().length > 1),
    });
  }

  public start(column: TableColumnMeta) {
    this.resizing.set({
      key: column.key,
      startWidth: this.table.renderedColumnWidth(column.key),
      hadOverride: this.table.hasColumnWidthOverride(column.key),
      inlineSign: this.inlineSign(),
    });
  }

  /** The column's width in px - its override, else its rendered width - with the range a resize clamps to. */
  public widthOf(column: TableColumnMeta) {
    const { min, max } = this.table.columnWidthBounds(column.key);
    const now = this.table.columnWidths()[column.key] ?? Math.round(this.table.renderedColumnWidth(column.key));

    return { now, min, max };
  }

  /**
   * Resize from the keyboard, as a window splitter: `←` / `→` step the width by
   * {@link KEYBOARD_STEP}px (`Shift` for {@link KEYBOARD_LARGE_STEP}px), `Home` / `End` go to the
   * column's minimum and maximum. Returns whether the key was one of those.
   */
  public resizeByKey(column: TableColumnMeta, event: KeyboardEvent) {
    const { now, min, max } = this.widthOf(column);
    const step = (event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP) * this.inlineSign();

    const target = keyboardTarget(event.key, { now, step, min, max });

    if (target === null) return false;

    this.table.setColumnWidth(column.key, target);

    return true;
  }

  public update(event: DragMoveEvent) {
    const resizing = this.resizing();

    if (!resizing) return;

    // The table clamps to a usable minimum and its own width.
    this.table.setColumnWidth(resizing.key, Math.round(resizing.startWidth + resizing.inlineSign * event.totalDx));
  }

  public end() {
    this.resizing.set(null);
  }

  /**
   * The browser took the gesture away - leave the column as it was grabbed. A column that carried no
   * width override keeps none, so a cancelled drag can't turn a flexible column rigid.
   */
  public cancel() {
    const resizing = this.resizing();

    if (!resizing) return;

    if (resizing.hadOverride) {
      this.table.setColumnWidth(resizing.key, resizing.startWidth);
    } else {
      this.table.resetColumnWidth(resizing.key);
    }

    this.resizing.set(null);
  }

  public reset(column: TableColumnMeta) {
    this.table.resetColumnWidth(column.key);
  }

  private inlineSign() {
    return getComputedStyle(this.elementRef.nativeElement).direction === 'rtl' ? -1 : 1;
  }
}
