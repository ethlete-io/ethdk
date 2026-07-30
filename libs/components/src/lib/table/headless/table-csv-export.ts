import { DOCUMENT, inject, isDevMode } from '@angular/core';
import { injectRenderer, RuntimeError } from '@ethlete/core';
import { TABLE_ERROR_CODES } from '../table-errors';
import { TableColumnDef } from '../table.types';

/**
 * The part of an `et-table` a CSV export reads. `TableComponent` satisfies it — the export is typed
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
};

/** Options for {@link tableToCsv} and {@link exportTableToCsv}. */
export type TableCsvExportOptions<T> = {
  /**
   * Which columns to write, and in which order: `'visible'` follows what the table shows (column
   * chooser + reorder), `'all'` adds the hidden ones, and an explicit key list writes exactly those,
   * in the order given.
   * @default 'visible'
   */
  columns?: 'visible' | 'all' | readonly string[];

  /**
   * The rows to write. Defaults to the table's rows — client-filtered and sorted, i.e. what the user
   * is looking at, including the parts virtualization or a footer's paging keeps off screen.
   *
   * Pass your own list for anything else: `selection.selectedRows()` for the selection, or the
   * untouched data to ignore the active filters. For a server-paginated table the table only ever
   * holds the current page — fetching the rest is the consumer's job, since only they have the query.
   */
  rows?: readonly T[];

  /** Write a header row of column labels. @default true */
  header?: boolean;

  /** Field separator. `';'` is what Excel expects in locales that use `,` as the decimal mark. @default ',' */
  delimiter?: string;

  /**
   * Prefix the file with a UTF-8 BOM. Excel reads a BOM-less CSV in the system's legacy code page,
   * which turns every non-ASCII character into mojibake; nothing else minds the BOM.
   * @default true
   */
  bom?: boolean;

  /**
   * Prefix a text field that starts with `=`, `+`, `-`, `@`, a tab or a carriage return with a `'`,
   * so a spreadsheet treats it as text instead of a formula. This is CSV injection: without it, a
   * row someone else authored can execute in the reader's spreadsheet when they open the file.
   *
   * Only text is guarded — numbers, booleans and dates are written as-is, as is a string that is
   * simply a negative number. Turn it off only when the file is not headed for a spreadsheet.
   * @default true
   */
  formulaGuard?: boolean;

  /** Downloaded file name; `.csv` is appended when missing. Ignored by {@link tableToCsv}. @default 'table.csv' */
  filename?: string;
};

// What tells Excel the file is UTF-8; see `bom`.
const UTF8_BOM = '\uFEFF';

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
 * A cell's text. Dates go out as ISO 8601 — the only form that survives a spreadsheet's locale — and
 * nullish becomes an empty field rather than the string `"null"`.
 */
const serialize = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();

  return String(value);
};

const guardFormula = (field: string) => {
  // `-5` is a number written as text, not a formula — guarding it would corrupt an ordinary export.
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
 * Build a table's rows as RFC 4180 CSV, without downloading anything — for uploading the file,
 * putting it on the clipboard, or asserting on it in a test. {@link exportTableToCsv} is the same
 * thing plus the download.
 *
 * A cell's text comes from the column's `exportValue`, else its `value` accessor. A column rendered
 * through an `etTableCell` template needs `exportValue`: a template is DOM, and there is nothing to
 * serialize it to.
 *
 * @example
 * const csv = tableToCsv(this.table(), { columns: 'all', delimiter: ';' });
 */
export const tableToCsv = <T>(table: TableCsvSource<T>, options: TableCsvExportOptions<T> = {}) => {
  const field: FieldConfig = { delimiter: options.delimiter ?? ',', formulaGuard: options.formulaGuard ?? true };
  const columns = resolveColumns(table, options.columns);
  const rows = options.rows ?? table.rows();
  const lines: string[] = [];

  if (options.header ?? true) {
    lines.push(columns.map((column) => toField(column.header ?? column.key, field)).join(field.delimiter));
  }

  for (const row of rows) {
    const fields = columns.map((column) => toField(column.exportValue?.(row) ?? column.value(row), field));

    lines.push(fields.join(field.delimiter));
  }

  // CRLF per RFC 4180. Excel accepts either; some older readers only accept this one.
  return lines.join('\r\n');
};

/**
 * The CSV as a file the browser downloads. Call it once from an injection context — a field
 * initializer — and the function it hands back can then be called from anywhere, including a click
 * handler. It is `inject()`-based because a download is DOM work, which this library does through the
 * document and renderer it was given rather than through the globals.
 *
 * A no-op where there is no browser (server-side rendering), so a toolbar button needs no platform
 * check of its own. Use {@link tableToCsv} to get the same file as a string instead.
 *
 * @example
 * private exportCsv = injectTableCsvExport();
 * protected table = viewChild.required(TableComponent);
 *
 * protected download() {
 *   this.exportCsv(this.table(), { filename: 'people.csv' });
 * }
 */
export const injectTableCsvExport = () => {
  const document = inject(DOCUMENT);
  const renderer = injectRenderer();

  return <T>(table: TableCsvSource<T>, options: TableCsvExportOptions<T> = {}) => {
    const csv = tableToCsv(table, options);
    // No window means no browser: server-side there is nothing to hand a file to.
    const view = document.defaultView;

    if (!view) return;

    const name = options.filename ?? 'table.csv';
    const filename = name.toLowerCase().endsWith('.csv') ? name : `${name}.csv`;
    const parts = (options.bom ?? true) ? [UTF8_BOM, csv] : [csv];
    const url = view.URL.createObjectURL(new view.Blob(parts, { type: 'text/csv;charset=utf-8' }));
    const link = renderer.createElement('a');

    renderer.setProperties(link, { href: url, download: filename, rel: 'noopener' });
    renderer.setStyle(link, { display: 'none' });

    // Firefox only follows the click of an anchor that is in the document.
    renderer.appendChild(document.body, link);
    link.click();
    renderer.removeChild(document.body, link);

    // The blob would otherwise be held until the tab closes; the click has already read it.
    view.URL.revokeObjectURL(url);
  };
};
