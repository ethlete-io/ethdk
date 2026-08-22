import { inject, Injector, isDevMode } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { injectFileDownload, RuntimeError } from '@ethlete/core';
import { QueryArgs, ReadonlyQuery } from '@ethlete/query';
import { defer, filter, from, isObservable, map, Observable, of, take, tap } from 'rxjs';
import { TABLE_ERROR_CODES } from '../table-errors';
import { TableColumnDef } from '../table.types';

/**
 * The part of an `et-table` a CSV export reads. `TableComponent` satisfies it - the export is typed
 * against this shape rather than against the component so it stays a pure function (and so the
 * headless layer never imports the component).
 */
export type TableCsvSource<T> = {
  /** The rows the table would render, after client filtering and sorting. */
  rows: () => readonly T[];
  /** The columns currently shown, in display order (the column chooser's and reorder's result). */
  visibleColumns: () => readonly TableColumnDef<T>[];
  /** Every declared column in display order, hidden ones included. */
  allColumns: () => readonly TableColumnDef<T>[];
  /** How many rows exist in total, when the table's source knows - see {@link TableCsvExportOptions.partial}. */
  totalRows?: () => number | null;
};

/**
 * A source of rows the export has to wait for - an "export everything" request, or
 * {@link tableCsvRowsFromPages} walking a paginated endpoint. It is called when the export runs, not
 * before, so a button that is never clicked fetches nothing.
 */
export type TableCsvRowsProvider<T> = () => Promise<readonly T[]> | Observable<readonly T[]>;

/**
 * A finished CSV the server built. Anything resolving to a `Blob` or a string will do: a promise, an
 * observable, or an `@ethlete/query` query - which is **followed, never executed**, so trigger it
 * yourself (or let a GET auto-execute) and the export saves the response it settles on.
 */
export type TableCsvExportFile = ReadonlyQuery<QueryArgs> | PromiseLike<Blob | string> | Observable<Blob | string>;

/** Options for {@link tableToCsv} - the synchronous serializer, which only ever writes rows it is handed. */
export type TableCsvSerializeOptions<T> = {
  /**
   * Which columns to write, and in which order: `'visible'` follows what the table shows (column
   * chooser + reorder), `'all'` adds the hidden ones, and an explicit key list writes exactly those,
   * in the order given.
   * @default 'visible'
   */
  columns?: 'visible' | 'all' | readonly string[];

  /**
   * The rows to write. Defaults to the table's rows - client-filtered and sorted, i.e. what the user
   * is looking at, including the parts virtualization or a footer's paging keeps off screen.
   *
   * Pass your own list for anything else: `selection.selectedRows()` for the selection, or the
   * untouched data to ignore the active filters.
   */
  rows?: readonly T[];

  /** Write a header row of column labels. @default true */
  header?: boolean;

  /** Field separator. `';'` is what Excel expects in locales that use `,` as the decimal mark. @default ',' */
  delimiter?: string;

  /**
   * Prefix a text field that starts with `=`, `+`, `-`, `@`, a tab or a carriage return with a `'`,
   * so a spreadsheet treats it as text instead of a formula. This is CSV injection: without it, a
   * row someone else authored can execute in the reader's spreadsheet when they open the file.
   *
   * Only text is guarded - numbers, booleans and dates are written as-is, as is a string that is
   * simply a negative number. Turn it off only when the file is not headed for a spreadsheet.
   * @default true
   */
  formulaGuard?: boolean;
};

/** Options for {@link injectTableCsvExport} - everything {@link TableCsvSerializeOptions} has, plus the file. */
export type TableCsvExportOptions<T> = Omit<TableCsvSerializeOptions<T>, 'rows'> & {
  /**
   * The rows to write - see {@link TableCsvSerializeOptions.rows}, plus a **provider** for rows the
   * export has to go and get: a function returning a promise or an observable of them. That is how a
   * server-paginated table exports more than the page it is holding, either from an "everything"
   * request of your own or through {@link tableCsvRowsFromPages}.
   *
   * `export()` resolves once the file has been written, and the directive's `exporting` signal is true
   * meanwhile, so the button can show that it is working.
   */
  rows?: readonly T[] | TableCsvRowsProvider<T>;

  /**
   * A CSV the **server** built - the usual answer for "export the whole dataset", since the backend
   * already has the query and the file needs no client-side serialization at all. Takes an
   * `@ethlete/query` query (followed, not executed), a promise or an observable resolving to a `Blob`
   * or a string; it is saved under `filename`.
   *
   * Mutually exclusive with everything that describes how to *build* a file - `rows`, `columns`,
   * `header`, `delimiter`, `formulaGuard`, `bom` - which cannot apply to one the server already wrote.
   * Passing both is a dev-mode error (`ET3507`) rather than a silently ignored option.
   */
  file?: TableCsvExportFile;

  /**
   * Prefix the file with a UTF-8 BOM. It is what tells Excel the file is UTF-8 - without it Excel reads
   * a CSV in the system's legacy code page, and every non-ASCII character becomes mojibake.
   *
   * `'auto'` writes one only when the file actually contains a non-ASCII character, which is the only
   * time it changes anything: a pure-ASCII CSV reads identically either way, so the marker would only
   * show up as `ï»¿` in the readers that don't strip it (text editors on the wrong encoding, most
   * hand-rolled parsers). `true` and `false` force it.
   * @default 'auto'
   */
  bom?: boolean | 'auto';

  /**
   * Write only the rows the table is holding, on purpose. A server-paginated table holds one page, so
   * an export that says nothing would quietly write page 3 of 200 as if it were the data - in dev mode
   * that throws `ET3506` instead. This is the opt-in that says you meant it, and what an explicit
   * "Export this page" button passes.
   *
   * Only relevant when the table's rows come from a source that reports a `total`; a table given its
   * rows outright holds all of them and never warns.
   * @default false
   */
  partial?: boolean;

  /** Downloaded file name; `.csv` is appended when missing. @default 'table.csv' */
  filename?: string;
};

// What tells Excel the file is UTF-8; see `bom`.
const UTF8_BOM = '\uFEFF';

// Anything above ASCII, which is the only content the BOM changes anything for - see `bom`. Written as
// a positive range so it carries no control characters of its own (and so CRLF isn't a match).
const NON_ASCII = /[\u0080-\uFFFF]/;

/** Whether this file gets a BOM, under the `bom` option's three settings. */
const needsBom = (csv: string, bom: boolean | 'auto' | undefined) =>
  (bom ?? 'auto') === 'auto' ? NON_ASCII.test(csv) : bom === true;

// Fields a spreadsheet would evaluate rather than display. Tab and CR are in the list because both
// Excel and Sheets skip leading whitespace before deciding.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

// A field needs quoting when it carries the delimiter, a quote, a newline, or edge whitespace that
// would otherwise be eaten by a lenient parser.
const needsQuoting = (field: string, delimiter: string) =>
  field.includes(delimiter) || /["\r\n]/.test(field) || field !== field.trim();

const quote = (field: string, delimiter: string) =>
  needsQuoting(field, delimiter) ? `"${field.replace(/"/g, '""')}"` : field;

/**
 * A cell's text. Dates go out as ISO 8601 - the only form that survives a spreadsheet's locale - and
 * nullish becomes an empty field rather than the string `"null"`.
 */
const serialize = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();

  return String(value);
};

const guardFormula = (field: string) => {
  // `-5` is a number written as text, not a formula - guarding it would corrupt an ordinary export.
  if (!FORMULA_PREFIX.test(field) || Number.isFinite(Number(field))) return field;

  return `'${field}`;
};

type FieldConfig = { delimiter: string; formulaGuard: boolean };

const toField = (value: unknown, { delimiter, formulaGuard }: FieldConfig) => {
  const text = serialize(value);
  const guarded = formulaGuard && typeof value === 'string' ? guardFormula(text) : text;

  return quote(guarded, delimiter);
};

const resolveColumns = <T>(table: TableCsvSource<T>, columns: TableCsvExportOptions<T>['columns']) => {
  if (columns === undefined || columns === 'visible') return table.visibleColumns();
  if (columns === 'all') return table.allColumns();

  const byKey = new Map(table.allColumns().map((column) => [column.key, column]));

  return columns
    .map((key) => {
      const column = byKey.get(key);

      // Quietly writing one column fewer than asked for would read as a data bug, not a typo.
      if (!column && isDevMode()) {
        throw new RuntimeError(
          TABLE_ERROR_CODES.UNKNOWN_EXPORT_COLUMN,
          `[et-table] CSV export was asked for the column "${key}", which this table does not declare.`,
        );
      }

      return column;
    })
    .filter((column): column is TableColumnDef<T> => column !== undefined);
};

/**
 * Build a table's rows as RFC 4180 CSV, without downloading anything - for uploading the file,
 * putting it on the clipboard, or asserting on it in a test. {@link injectTableCsvExport} returns the
 * same thing plus the download.
 *
 * A cell's text comes from the column's `exportValue`, else its `value` accessor. A column rendered
 * through an `etTableCell` template needs `exportValue`: a template is DOM, and there is nothing to
 * serialize it to. A column that declares `exportValue` is exported by it alone - an empty cell it
 * reports as `null` is written as an empty field, not as the raw `value` behind it.
 *
 * @example
 * const csv = tableToCsv(this.table(), { columns: 'all', delimiter: ';' });
 */
export const tableToCsv = <T>(table: TableCsvSource<T>, options: TableCsvSerializeOptions<T> = {}) => {
  const field: FieldConfig = { delimiter: options.delimiter ?? ',', formulaGuard: options.formulaGuard ?? true };
  const columns = resolveColumns(table, options.columns);
  const rows = options.rows ?? table.rows();
  const lines: string[] = [];

  if (options.header ?? true) {
    lines.push(columns.map((column) => toField(column.header ?? column.key, field)).join(field.delimiter));
  }

  for (const row of rows) {
    const fields = columns.map((column) => toField((column.exportValue ?? column.value)(row), field));

    lines.push(fields.join(field.delimiter));
  }

  // CRLF per RFC 4180. Excel accepts either; some older readers only accept this one.
  return lines.join('\r\n');
};

// Duck-typed rather than `instanceof`: `@ethlete/query`'s query is a plain object, and this is the
// same test `notification-promise.ts` uses to tell one from a promise.
const isQuery = (file: TableCsvExportFile): file is ReadonlyQuery<QueryArgs> =>
  typeof file === 'object' && file !== null && 'executionState' in file;

/**
 * A query's settled response, without executing it - the caller triggered it (or it is a GET that
 * auto-executes), and this only watches. Errors with the failure. A query that already carries a
 * response emits on subscribe.
 */
const queryToSource = (query: ReadonlyQuery<QueryArgs>, injector: Injector) =>
  toObservable(query.executionState, { injector }).pipe(
    filter((state) => !!state && state.type !== 'loading'),
    take(1),
    map((state) => {
      if (state?.type !== 'success') throw state?.error;

      return state.response as Blob | string;
    }),
  );

// Deferred like the rows below: building an export must not start anything, and `toObservable` would
// otherwise stand up an effect for a query nobody went on to subscribe to.
const fileToSource = (file: TableCsvExportFile, injector: Injector) =>
  defer(() => {
    if (isQuery(file)) return queryToSource(file, injector);
    if (isObservable(file)) return file.pipe(take(1));

    return from(file);
  });

/**
 * The `rows` option as an actual list: as given, from the provider it may be, or the table's own.
 * A provider's observable carries one list, so the first emission is the answer. Shared by the
 * download and by the directive's `toCsv`.
 *
 * @internal
 */
export const resolveTableCsvRows = <T>(
  rows: readonly T[] | TableCsvRowsProvider<T> | undefined,
  fallback: () => readonly T[],
): Observable<readonly T[]> =>
  // Deferred, so building an export requests nothing: the provider runs - and the table's rows are
  // read - when someone subscribes, which is also what makes a retry fetch again rather than replay.
  defer(() => {
    if (rows === undefined) return of(fallback());
    if (typeof rows !== 'function') return of(rows);

    const produced = rows();

    return isObservable(produced) ? produced.pipe(take(1)) : from(produced);
  });

// The options that describe how to *build* a file, which `file` excludes - see `file`.
const BUILD_OPTIONS = ['rows', 'columns', 'header', 'delimiter', 'formulaGuard', 'bom'] as const;

const without = <T>(options: TableCsvExportOptions<T>, keys: readonly (keyof TableCsvExportOptions<T>)[]) => {
  const rest = { ...options };

  for (const key of keys) delete rest[key];

  return rest;
};

/**
 * A bound `etTableCsvExport` config with one `export()` call's overrides applied. `file` and the
 * options that build a file are mutually exclusive, so whichever of the two the *call* asked for
 * drops the other group from the config - a `bom: false` default must not make `export({ file })`
 * a conflict the call site never wrote. Passing both in the same call still throws `ET3507`.
 *
 * @internal
 */
export const mergeTableCsvExportOptions = <T>(
  config: TableCsvExportOptions<T>,
  overrides: TableCsvExportOptions<T>,
): TableCsvExportOptions<T> => {
  if (overrides.file !== undefined) return { ...without(config, BUILD_OPTIONS), ...overrides };

  if (BUILD_OPTIONS.some((key) => overrides[key] !== undefined)) return { ...without(config, ['file']), ...overrides };

  return { ...config, ...overrides };
};

/**
 * Refuse the combination that cannot mean anything: the server already wrote the file, so nothing
 * describing how to build one can apply to it. Silently ignoring `columns` here would look like the
 * option was broken.
 */
const assertFileOptions = <T>(options: TableCsvExportOptions<T>) => {
  const ignored = BUILD_OPTIONS.filter((key) => options[key] !== undefined);

  if (!ignored.length || !isDevMode()) return;

  throw new RuntimeError(
    TABLE_ERROR_CODES.CONFLICTING_EXPORT_OPTIONS,
    `[et-table] CSV export was given \`file\` together with ${ignored.map((key) => `\`${key}\``).join(', ')}. The server already built that file, so there is nothing here to apply them to - drop them, or drop \`file\` and let the table serialize the rows.`,
  );
};

/**
 * Refuse to write a plausible, wrong file. A server-paginated table holds one page; exporting it
 * without saying so hands the user "the data" when it is 20 rows of 4 312. Dev mode only - in
 * production the page is written rather than nothing at all.
 */
const assertNotPartial = <T>({
  options,
  table,
  written,
}: {
  options: TableCsvExportOptions<T>;
  table: TableCsvSource<T>;
  /** How many rows the file is about to hold. */
  written: number;
}) => {
  // An explicit row list (a selection, a fetched-everything provider) is already deliberate, and
  // `partial` is the opt-in for the rest.
  if (options.rows !== undefined || options.partial || !isDevMode()) return;

  const total = table.totalRows?.() ?? null;

  if (total === null || written >= total) return;

  throw new RuntimeError(
    TABLE_ERROR_CODES.PARTIAL_EXPORT,
    `[et-table] CSV export would write ${written} of ${total} rows - this table's rows come from a server and it is holding one page. Pass \`rows\` (a list, or a provider such as \`tableCsvRowsFromPages\`), or \`file\` for a server-built export, or \`partial: true\` to write the loaded page on purpose.`,
  );
};

/**
 * The CSV as a file the browser downloads. Call it once from an injection context - a field
 * initializer - and the function it hands back can then be called from anywhere, including a click
 * handler.
 *
 * It hands back an observable that writes the file on subscribe and completes - **nothing happens
 * until you subscribe**. That is what lets an export whose rows have to be fetched (`rows` as a
 * provider, or `file`) be composed, cancelled and retried like any other request;
 * {@link TableCsvExportDirective.export} is the fire-and-forget version for a button.
 *
 * A no-op where there is no browser (server-side rendering), so a toolbar button needs no platform
 * check of its own. Use {@link tableToCsv} to get the same file as a string instead.
 *
 * @example
 * private exportCsv = injectTableCsvExport();
 * protected table = viewChild.required(TableComponent);
 *
 * protected download() {
 *   this.exportCsv(this.table(), { filename: 'people.csv' }).subscribe();
 * }
 */
export const injectTableCsvExport = () => {
  const download = injectFileDownload();
  const injector = inject(Injector);

  const save = (parts: BlobPart[], filename: string) => {
    download({
      content: parts,
      filename: filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`,
      type: 'text/csv;charset=utf-8',
    });
  };

  return <T>(table: TableCsvSource<T>, options: TableCsvExportOptions<T> = {}): Observable<void> => {
    const filename = options.filename ?? 'table.csv';

    if (options.file) {
      // Thrown on the way in rather than through the stream: this is a mistake in the call, so the
      // stack should point at the call.
      assertFileOptions(options);

      return fileToSource(options.file, injector).pipe(
        // Saved as it came: the server decided the columns, the delimiter and the encoding, and a BOM
        // this side would be a second one prepended to a file that may already carry its own.
        tap((file) => save([file], filename)),
        map(() => undefined),
      );
    }

    return resolveTableCsvRows(options.rows, () => table.rows()).pipe(
      tap((rows) => assertNotPartial({ options, table, written: rows.length })),
      map((rows) => tableToCsv(table, { ...options, rows })),
      tap((csv) => save(needsBom(csv, options.bom) ? [UTF8_BOM, csv] : [csv], filename)),
      map(() => undefined),
    );
  };
};
