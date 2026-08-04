import { computed, Directive, inject, Injector, input, Signal, signal } from '@angular/core';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableGroupHeaderRowComponent } from './table-group-header-row.component';
import { TableHeaderGroup } from './table.types';

/** Options for {@link TableGroupHeadersDirective}. */
export type TableGroupHeadersConfig = TableFeatureConfig;

/**
 * Opt-in grouped column headers for `et-table`: a spanning row above the column headers, in which
 * adjacent visible columns that share a `group` read under one label.
 *
 * @example
 * const COLUMNS = {
 *   won: { header: 'W', value: (t: Team) => t.won, group: 'Season' },
 *   lost: { header: 'L', value: (t: Team) => t.lost, group: 'Season' },
 *   form: { header: 'Form', value: (t: Team) => t.form },
 * } satisfies TableColumns<Team>;
 *
 * <et-table [data]="teams()" [columns]="COLUMNS" etTableGroupHeaders />
 */
@Directive({
  selector: '[etTableGroupHeaders]',
  exportAs: 'etTableGroupHeaders',
  host: {
    // What the column-header row offsets its own sticky position by, so it pins just below the group
    // row. The base sheet falls back to 0, which is what a table without this feature gets.
    '[style.--_et-table-group-h]': 'groupRowHeight() + "px"',
  },
})
export class TableGroupHeadersDirective {
  private table = injectTableFeatureHost('etTableGroupHeaders');

  /** See {@link TableGroupHeadersConfig}. */
  public config = input({} as TableGroupHeadersConfig, {
    alias: 'etTableGroupHeaders',
    transform: tableFeatureConfig<TableGroupHeadersConfig>,
  });

  /**
   * The stamped row's own measured height, which it hands over on construction - the row is created in
   * the table's view, so there is nothing here to query for it. Part of the feature's internal contract
   * with its row; consumers never set this.
   */
  public rowHeight = signal<Signal<number> | null>(null);

  protected groupRowHeight = computed(() => this.rowHeight()?.() ?? 0);

  /**
   * The spanning row as maximal runs of adjacent visible columns sharing a `group`. Ungrouped columns
   * each form their own single-track run (`label: null`) so the row still covers every track - dragging
   * a column out of a group simply splits the run.
   */
  public headerGroups = computed<TableHeaderGroup[]>(() => {
    const runs: TableHeaderGroup[] = [];

    for (const column of this.table.visibleColumnsMeta()) {
      const label = column.group ?? null;
      const last = runs[runs.length - 1];

      if (last && label !== null && last.label === label) {
        last.span += 1;
      } else {
        runs.push({ key: column.key, label, span: 1 });
      }
    }

    return runs;
  });

  /** Whether any visible column declares a `group`, i.e. whether the row shows a label at all. */
  public hasGroups = computed(() => this.table.visibleColumnsMeta().some((column) => !!column.group));

  constructor() {
    this.table.registerHeaderRow({
      component: TableGroupHeaderRowComponent,
      injector: inject(Injector),
      enabled: computed(() => this.config().enabled ?? true),
    });
  }

}
