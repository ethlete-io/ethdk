import { Component, computed, effect, input, ViewEncapsulation } from '@angular/core';
import { createVirtualWindow } from '../internals/virtual-window';
import { injectTableFeatureHost } from './table-features';

/**
 * Opt-in virtual scrolling for `et-table`: only the rows near the viewport are rendered, with spacers
 * standing in for the rest so the scrollbar still reflects the whole row count. Place it inside the
 * table — it renders nothing itself, it registers a row window with the table.
 *
 * The table is its own scroll container, so give it a bounded height (e.g.
 * `style="block-size: 24rem"`) for the window to track.
 *
 * @example
 * <et-table [data]="manyRows()" [columns]="columns" style="block-size: 24rem">
 *   <et-table-virtual-scroll [estimateRowHeight]="52" />
 * </et-table>
 */
@Component({
  selector: 'et-table-virtual-scroll',
  template: '',
  styleUrl: './table-virtual-scroll.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class TableVirtualScrollComponent {
  private table = injectTableFeatureHost('et-table-virtual-scroll');

  /** Row height assumed before a real row is measured — tune it to your rows for a stable first paint. @default 48 */
  public estimateRowHeight = input(48);

  /** Rows kept rendered just outside the viewport on each side, to hide scroll flicker. @default 6 */
  public overscan = input(6);

  private window = createVirtualWindow({
    container: computed(() => this.table.element),
    itemCount: computed(() => this.table.rows().length),
    estimateItemHeight: this.estimateRowHeight,
    overscan: this.overscan,
  });

  constructor() {
    this.table.registerRowWindow({
      slice: (rows) => {
        const { start, end } = this.window.range();

        return rows.slice(start, end);
      },
      paddingStart: this.window.paddingTop,
      paddingEnd: this.window.paddingBottom,
      offset: computed(() => this.window.range().start),
    });

    // Feed a real rendered row's height back into the window so its scroll math self-corrects from the
    // estimate. Uniform-height model: any body cell stands in for all of them.
    effect(() => {
      const cell = this.table.firstBodyCellElement();

      if (cell) this.window.measureItem(cell);
    });
  }
}
