import { computed, Directive, inject, Injector, input } from '@angular/core';
import { TableCellErrorMarkComponent } from './table-cell-error-mark.component';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TableComponent } from './table.component';

/** Options for {@link TableCellErrorTooltipDirective}. */
export type TableCellErrorTooltipConfig = TableFeatureConfig;

/**
 * Opt-in tooltips on failed cells: the message a `cellState` callback returns
 * (`{ state: 'error', message }`) is shown on hover and focus instead of as a native `title`.
 *
 * It carries the [tooltip](/components/tooltip) — and with it the overlay runtime and floating-ui —
 * which is exactly why it is separate: a table that only marks failed cells never pulls that in. Its
 * mark is stamped only into cells that are actually failing.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" [cellState]="cellState" etTableCellErrorTooltip />
 */
@Directive({
  selector: '[etTableCellErrorTooltip]',
  exportAs: 'etTableCellErrorTooltip',
})
export class TableCellErrorTooltipDirective {
  /** The host table this feature registered with. */
  public table = inject<TableComponent<unknown>>(TableComponent);

  /** See {@link TableCellErrorTooltipConfig}. */
  public config = input({} as TableCellErrorTooltipConfig, {
    alias: 'etTableCellErrorTooltip',
    transform: tableFeatureConfig<TableCellErrorTooltipConfig>,
  });

  constructor() {
    // Registered through the feature host (which throws a labelled error outside a table), but the
    // mark also needs the table's own error colour, so the concrete component is what's injected above.
    injectTableFeatureHost('etTableCellErrorTooltip').registerCellErrorMark({
      component: TableCellErrorMarkComponent,
      injector: inject(Injector),
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
