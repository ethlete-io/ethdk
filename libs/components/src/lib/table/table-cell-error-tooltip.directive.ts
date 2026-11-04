import { computed, Directive, inject, Injector, input } from '@angular/core';
import { TableCellErrorMarkComponent } from './table-cell-error-mark.component';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { injectHostTable } from './table-feature-host-utils';
import { TABLE_CELL_ERROR_TOOLTIP_TOKEN } from './table-feature.tokens';

/** Options for {@link TableCellErrorTooltipDirective}. */
export type TableCellErrorTooltipConfig = TableFeatureConfig;

/**
 * Opt-in tooltips on failed cells: the message a `cellState` callback returns
 * (`{ state: 'error', message }`) is shown on hover and focus instead of as a native `title`.
 *
 * It carries the [tooltip](/components/tooltip), and with it the overlay runtime and floating-ui. Its
 * mark is stamped only into cells that are actually failing.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" [cellState]="cellState" etTableCellErrorTooltip />
 */
@Directive({
  selector: '[etTableCellErrorTooltip]',
  exportAs: 'etTableCellErrorTooltip',
  providers: [{ provide: TABLE_CELL_ERROR_TOOLTIP_TOKEN, useExisting: TableCellErrorTooltipDirective }],
})
export class TableCellErrorTooltipDirective {
  /** The host table this feature registered with. */
  public table = injectHostTable<unknown>('etTableCellErrorTooltip');

  /** See {@link TableCellErrorTooltipConfig}. */
  public config = input({} as TableCellErrorTooltipConfig, {
    alias: 'etTableCellErrorTooltip',
    transform: tableFeatureConfig<TableCellErrorTooltipConfig>,
  });

  constructor() {
    injectTableFeatureHost('etTableCellErrorTooltip').registerCellErrorMark({
      component: TableCellErrorMarkComponent,
      injector: inject(Injector),
      enabled: computed(() => this.config().enabled ?? true),
    });
  }
}
