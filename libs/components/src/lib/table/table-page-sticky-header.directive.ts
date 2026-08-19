import { Directive, Injector, afterNextRender, computed, effect, inject, input } from '@angular/core';
import { injectRenderer, injectStyleManager, signalHostElementDimensions } from '@ethlete/core';
import { TableFeatureConfig, injectTableFeatureHost, tableFeatureConfig } from './headless/table-features';
import { TablePageStickyHeaderStylesComponent } from './table-page-sticky-header-styles.component';

/** Options for {@link TablePageStickyHeaderDirective}. */
export type TablePageStickyHeaderConfig = TableFeatureConfig & {
  /** How far below the top of the viewport the header stops, in px. */
  offset?: number;
};

/**
 * Keeps the header rows of an unbounded, page-scrolled `et-table` at the top of the viewport.
 * The header stays horizontally aligned with the body and stops at the end of the table.
 *
 * Not for bounded or virtualized tables, which already pin their header inside their own scroll viewport.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTablePageStickyHeader />
 */
@Directive({
  selector: '[etTablePageStickyHeader]',
  exportAs: 'etTablePageStickyHeader',
  host: {
    '[class.et-table-host--page-sticky-header]': 'enabled()',
    '[style.--et-table-sticky-header-offset.px]': 'config().offset ?? null',
  },
})
export class TablePageStickyHeaderDirective {
  private table = injectTableFeatureHost('etTablePageStickyHeader');
  private injector = inject(Injector);
  private renderer = injectRenderer();

  /** See {@link TablePageStickyHeaderConfig}. */
  public config = input({} as TablePageStickyHeaderConfig, {
    alias: 'etTablePageStickyHeader',
    transform: tableFeatureConfig<TablePageStickyHeaderConfig>,
  });
  private hostDimensions = signalHostElementDimensions();

  protected enabled = computed(() => this.config().enabled ?? true);

  constructor() {
    injectStyleManager().mount(TablePageStickyHeaderStylesComponent);
    this.table.registerPageStickyHeader({ enabled: this.enabled });

    effect(() => {
      this.hostDimensions();
      this.enabled();
      this.table.columnWidths();
      this.table.visibleColumnsMeta();
      this.table.leadColumnsMeta();
      this.table.trailColumnsMeta();
      afterNextRender({ read: () => this.measure() }, { injector: this.injector });
    });
  }

  private measure() {
    const host = this.table.element;
    const grid = this.table.gridElement();
    const headerGrid = this.table.pageHeaderGridElement();
    const scroller = this.table.scrollElement();
    const view = host.ownerDocument.defaultView;

    if (!this.enabled() || !grid || !headerGrid || !view) {
      this.table.setPageHeaderColumns(null);
      this.writeMaxScroll(host, 0);

      return;
    }

    this.table.setPageHeaderColumns(view.getComputedStyle(grid).gridTemplateColumns);
    this.writeMaxScroll(host, Math.max(0, scroller.scrollWidth - scroller.clientWidth));
  }

  private writeMaxScroll(host: HTMLElement, maxScroll: number) {
    this.renderer?.setCssProperties(host, { '--_et-table-inline-max-scroll': `${maxScroll}px` });
  }
}
