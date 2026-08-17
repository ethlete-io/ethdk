import { Directive, ElementRef, Injector, afterNextRender, computed, effect, inject, input } from '@angular/core';
import { injectRenderer, injectStyleManager, injectViewportSize, signalHostElementDimensions } from '@ethlete/core';
import { TableFeatureConfig, injectTableFeatureHost, tableFeatureConfig } from './headless/table-features';
import { TablePageStickyHeaderStylesComponent } from './table-page-sticky-header-styles.component';

/** Options for {@link TablePageStickyHeaderDirective}. */
export type TablePageStickyHeaderConfig = TableFeatureConfig & {
  /**
   * How far below the top of the viewport the header stops, in px. Give it when the distance is a
   * measured one - the height of a toolbar that is pinned up there and wraps as the window narrows.
   * A fixed distance is better said in CSS, as `--et-table-sticky-header-offset` on the table.
   */
  offset?: number;
};

/**
 * Keeps the header row of a page-scrolled `et-table` at the top of the viewport. Use it on a table that
 * has no height of its own - one that grows to its rows while the document scrolls - where the header
 * would otherwise leave with the page.
 *
 * The table's own sticky header pins to the host, which is the table's horizontal scroll container, so
 * it can only ever stop at the host's top edge. This travels the header row down the grid instead, by
 * exactly the distance the page has scrolled past the table, and stops it at the last row. The row keeps
 * its place in the grid throughout, so the tracks, the pinned columns and the resize grips are untouched
 * and the header still scrolls sideways with the columns.
 *
 * The travel runs on a scroll timeline, so it is the compositor's work and the header never falls behind
 * the page. This directive only measures: it writes the distance and the two page offsets it runs
 * between whenever the layout changes, and nothing at all while scrolling.
 *
 * Set `--et-table-sticky-header-offset` on the table to stop the header lower than the top of the
 * viewport - under a page header or a toolbar that is pinned there itself.
 *
 * Not for a bounded table: one with a height of its own already pins its header, and one that virtual
 * scrolls needs the bounded height to do it.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" style="--et-table-sticky-header-offset: 64px" etTablePageStickyHeader />
 */
@Directive({
  selector: '[etTablePageStickyHeader]',
  exportAs: 'etTablePageStickyHeader',
  host: {
    '[class.et-table-host--page-sticky-header]': 'enabled()',
  },
})
export class TablePageStickyHeaderDirective {
  private table = injectTableFeatureHost('etTablePageStickyHeader');
  // The feature is a directive on the table, so its host *is* the table's scroll container.
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);
  private renderer = injectRenderer();
  // The offset is a length, so a media query can change it at a width the table itself does not resize at.
  private viewportSize = injectViewportSize();

  /** See {@link TablePageStickyHeaderConfig}. */
  public config = input({} as TablePageStickyHeaderConfig, {
    alias: 'etTablePageStickyHeader',
    transform: tableFeatureConfig<TablePageStickyHeaderConfig>,
  });
  private hostDimensions = signalHostElementDimensions();

  protected enabled = computed(() => this.config().enabled ?? true);

  constructor() {
    injectStyleManager().mount(TablePageStickyHeaderStylesComponent);

    // Everything the travel is made of comes out of the layout, so it is re-measured whenever the layout
    // can have changed: the host resized, a column was resized, columns came or went, the config was
    // rebound. Never on scroll - scrolling is the timeline's job, and reading geometry there is what
    // makes a pinned header lag behind the page.
    effect(() => {
      this.hostDimensions();
      this.viewportSize();
      this.enabled();
      this.config();
      this.table.columnWidths();
      this.table.visibleColumnsMeta();
      afterNextRender({ read: () => this.measure() }, { injector: this.injector });
    });
  }

  private measure() {
    const host = this.elementRef.nativeElement;
    const grid = this.table.gridElement();
    const headerCell = this.table.headerCellElements()[0] ?? this.table.leadHeaderCellElements()[0];
    const view = host.ownerDocument.defaultView;

    if (!this.enabled() || !grid || !headerCell || !view) {
      this.write(host, { travel: 0, from: 0, to: 0 });

      return;
    }

    // Layout offsets, not the header's own rect: the rect carries the travel the timeline has already
    // applied, and reading it back would fold that into the next measurement.
    const headerTop = headerCell.offsetTop;
    const travel = Math.max(0, grid.offsetHeight - headerTop - headerCell.offsetHeight);
    // Where the header rests, in page coordinates, so the two ends of the range are page scroll offsets.
    const restingTop = grid.getBoundingClientRect().top + view.scrollY + headerTop;
    const from = Math.max(0, restingTop - this.resolveOffset(host));

    this.write(host, { travel, from, to: from + travel });
  }

  private resolveOffset(host: HTMLElement) {
    const raw = getComputedStyle(host).getPropertyValue('--et-table-sticky-header-offset');
    const parsed = Number.parseFloat(raw);

    // Registered as a `<length>` (see the stylesheet), so the computed value is always in px.
    return this.config().offset ?? (Number.isFinite(parsed) ? parsed : 0);
  }

  private write(host: HTMLElement, values: { travel: number; from: number; to: number }) {
    this.renderer?.setCssProperties(host, {
      '--_et-table-page-header-travel': `${values.travel}px`,
      '--_et-table-page-header-from': `${values.from}px`,
      '--_et-table-page-header-to': `${values.to}px`,
    });
  }
}
