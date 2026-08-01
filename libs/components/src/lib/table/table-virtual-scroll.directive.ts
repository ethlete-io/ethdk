import { computed, Directive, effect, input } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { createVirtualWindow } from '../internals/virtual-window';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableVirtualScrollStylesComponent } from './table-virtual-scroll-styles.component';

/** Options for {@link TableVirtualScrollDirective}. */
export type TableVirtualScrollConfig = TableFeatureConfig & {
  /** Row height assumed before a real row is measured - tune it to your rows for a stable first paint. @default 48 */
  estimateRowHeight?: number;
  /** Rows kept rendered just outside the viewport on each side, to hide scroll flicker. @default 6 */
  overscan?: number;
};

/**
 * Opt-in virtual scrolling for `et-table`: only the rows near the viewport are rendered, with spacers
 * standing in for the rest so the scrollbar still reflects the whole row count.
 *
 * The table is its own scroll container, so give it a bounded height (e.g.
 * `style="block-size: 24rem"`) for the window to track.
 *
 * @example
 * <et-table [data]="manyRows()" [columns]="COLUMNS" style="block-size: 24rem" etTableVirtualScroll />
 *
 * <!-- with options -->
 * <et-table [etTableVirtualScroll]="{ estimateRowHeight: 52 }" … />
 */
@Directive({
  selector: '[etTableVirtualScroll]',
  exportAs: 'etTableVirtualScroll',
})
export class TableVirtualScrollDirective {
  private table = injectTableFeatureHost('etTableVirtualScroll');

  /** See {@link TableVirtualScrollConfig}. */
  public config = input({} as TableVirtualScrollConfig, {
    alias: 'etTableVirtualScroll',
    transform: tableFeatureConfig<TableVirtualScrollConfig>,
  });

  private window = createVirtualWindow({
    container: computed(() => this.table.element),
    itemCount: computed(() => this.table.rows().length),
    estimateItemHeight: computed(() => this.config().estimateRowHeight ?? 48),
    overscan: computed(() => this.config().overscan ?? 6),
  });

  constructor() {
    // The spacer rule lives with the feature (see TableVirtualScrollStylesComponent), so a table that
    // renders every row ships none of it.
    injectStyleManager().mount(TableVirtualScrollStylesComponent);

    this.table.registerRowWindow({
      slice: (rows) => {
        const { start, end } = this.window.range();

        return rows.slice(start, end);
      },
      paddingStart: this.window.paddingTop,
      paddingEnd: this.window.paddingBottom,
      offset: computed(() => this.window.range().start),
      // Keyboard navigation asks for a row that may be outside the rendered range; the window can put
      // it there, which nothing working from the DOM could.
      scrollToIndex: (index) => this.window.scrollToIndex(index),
      enabled: computed(() => this.config().enabled ?? true),
    });

    // Feed a real rendered row's height back into the window so its scroll math self-corrects from the
    // estimate. Uniform-height model: any body cell stands in for all of them.
    effect(() => {
      const cell = this.table.firstBodyCellElement();

      if (cell) this.window.measureItem(cell);
    });
  }
}
