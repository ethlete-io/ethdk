import { Directive, inject, input } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { injectTableCsvExport, TableCsvExportOptions, tableToCsv } from './headless/table-csv-export';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableComponent } from './table.component';

/** Options for {@link TableCsvExportDirective} — the defaults every `export()` call starts from. */
export type TableCsvExportConfig<T> = TableCsvExportOptions<T>;

// A feature directive is usually written bare (`etTableCsvExport`), which Angular binds as the empty
// string — normalize that to "no options given". (`tableFeatureConfig` isn't reused here: this feature
// registers nothing on the table, so it has no `enabled` to gate.)
const csvExportConfig = <T>(value: TableCsvExportConfig<T> | '') => (value === '' ? {} : value);

/**
 * Downloads an `et-table` as CSV, from a button of your own. It registers nothing on the table and
 * renders nothing — it exists so the options live next to the table in the template and the call site
 * is one `export()`.
 *
 * The columns follow what the table shows (the chooser's visibility and the reordered order); the rows
 * are the table's own — client-filtered and sorted. See {@link TableCsvExportOptions} for changing
 * either, and {@link injectTableCsvExport} to do the same thing from TypeScript without the directive.
 *
 * @example
 * <et-table
 *   #table
 *   [data]="people()"
 *   [columns]="COLUMNS"
 *   [etTableCsvExport]="{ filename: 'people.csv' }"
 *   #csv="etTableCsvExport"
 * />
 * <button et-button (click)="csv.export()">Export CSV</button>
 *
 * @example
 * // the selected rows instead of all of them
 * <button et-button (click)="csv.export({ rows: selection.selectedRows() })">Export selection</button>
 */
@Directive({
  selector: '[etTableCsvExport]',
  exportAs: 'etTableCsvExport',
})
export class TableCsvExportDirective<T> {
  private table = injectHostTable<T>();
  private download = injectTableCsvExport();

  /** See {@link TableCsvExportConfig}. */
  public config = input({} as TableCsvExportConfig<T>, {
    alias: 'etTableCsvExport',
    transform: csvExportConfig<T>,
  });

  /**
   * Build and download the file. Anything passed here wins over the bound config, so one directive
   * can serve an "export all" and an "export selection" button.
   */
  public export(overrides: TableCsvExportOptions<T> = {}) {
    this.download(this.table, { ...this.config(), ...overrides });
  }

  /** The same CSV as a string, without downloading it — to upload it, or to put it on the clipboard. */
  public toCsv(overrides: TableCsvExportOptions<T> = {}) {
    return tableToCsv(this.table, { ...this.config(), ...overrides });
  }
}

// The table is a component on the same element, so it injects directly. Placed anywhere else the
// directive could only ever silently do nothing, so name the mistake instead.
const injectHostTable = <T>() => {
  const table = inject(TableComponent, { optional: true }) as TableComponent<T> | null;

  if (!table) {
    throw new RuntimeError(
      TABLE_ERROR_CODES.FEATURE_OUTSIDE_TABLE,
      `[etTableCsvExport] must be used on an <et-table>.`,
    );
  }

  return table;
};
