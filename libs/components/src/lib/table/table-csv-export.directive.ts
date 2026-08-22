import { computed, DestroyRef, Directive, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, map } from 'rxjs';
import { RuntimeError } from '@ethlete/core';
import {
  injectTableCsvExport,
  mergeTableCsvExportOptions,
  resolveTableCsvRows,
  TableCsvExportOptions,
  tableToCsv,
} from './headless/table-csv-export';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableComponent } from './table.component';

/** Options for {@link TableCsvExportDirective} - the defaults every `export()` call starts from. */
export type TableCsvExportConfig<T> = TableCsvExportOptions<T>;

// A feature directive is usually written bare (`etTableCsvExport`), which Angular binds as the empty
// string - normalize that to "no options given". (`tableFeatureConfig` isn't reused here: this feature
// registers nothing on the table, so it has no `enabled` to gate.)
const csvExportConfig = <T>(value: TableCsvExportConfig<T> | '') => (value === '' ? {} : value);

/**
 * Downloads an `et-table` as CSV, from a button of your own. It registers nothing on the table and
 * renders nothing - it exists so the options live next to the table in the template and the call site
 * is one `export()`.
 *
 * The columns follow what the table shows (the chooser's visibility and the reordered order); the rows
 * are the table's own - client-filtered and sorted. See {@link TableCsvExportOptions} for changing
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
  private destroyRef = inject(DestroyRef);

  /** See {@link TableCsvExportConfig}. */
  public config = input({} as TableCsvExportConfig<T>, {
    alias: 'etTableCsvExport',
    transform: csvExportConfig<T>,
  });

  // Counted rather than a boolean: two buttons can be clicked before the first fetch comes back, and
  // the second finishing must not un-busy the first.
  private running = signal(0);

  /**
   * Whether an export is in flight - bind it to the button's `disabled` and its spinner. Only ever
   * true for an export that has to fetch first (a `rows` provider, or `file`); a table exporting the
   * rows it already holds writes the file in the same tick.
   */
  public exporting = computed(() => this.running() > 0);

  /**
   * Build and download the file, now. Anything passed here wins over the bound config, so one
   * directive can serve an "export all" and an "export selection" button - including a `file` call
   * on a directive that binds serializer options, which drops them rather than conflicting.
   *
   * Fire-and-forget, so a `(click)` handler is the whole call site: it starts the work, keeps
   * {@link exporting} true while it runs, and stops with the directive. A failure reaches the app's
   * `ErrorHandler` - use {@link injectTableCsvExport} directly for an export you want to compose,
   * cancel or recover from yourself.
   */
  public export(overrides: TableCsvExportOptions<T> = {}) {
    this.running.update((count) => count + 1);

    this.download(this.table, mergeTableCsvExportOptions(this.config(), overrides))
      .pipe(
        finalize(() => this.running.update((count) => count - 1)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * The same CSV as a string, without downloading it - to upload it, or to put it on the clipboard.
   * An observable rather than a string because `rows` may be a provider it has to wait for. `file`
   * has no meaning here: the whole point of it is that this side never builds the string.
   */
  public toCsv(overrides: TableCsvExportOptions<T> = {}) {
    const options = mergeTableCsvExportOptions(this.config(), overrides);

    return resolveTableCsvRows(options.rows, () => this.table.rows()).pipe(
      map((rows) => tableToCsv(this.table, { ...options, rows })),
    );
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
