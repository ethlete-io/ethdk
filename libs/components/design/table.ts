import checkboxBase from '../src/lib/forms/checkbox/checkbox.component.css?inline';
import { ARROW_UP_ICON } from '../src/lib/icon/headless/arrow-up-icon';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TRIANGLE_EXCLAMATION_ICON } from '../src/lib/icon/headless/triangle-exclamation-icon';
import tableDetailBase from '../src/lib/table/table-detail-styles.component.css?inline';
import tableExpanderBase from '../src/lib/table/table-expander-cell.component.css?inline';
import tableGroupHeaderBase from '../src/lib/table/table-group-header-row.component.css?inline';
import tableSelectBase from '../src/lib/table/table-select-cell.component.css?inline';
import tableSkeletonRowsBase from '../src/lib/table/table-skeleton-rows.component.css?inline';
import tableStickyColumnsBase from '../src/lib/table/table-sticky-columns-styles.component.css?inline';
import tableBase from '../src/lib/table/table.component.css?inline';
import { iconMarkup } from './icon';
import { skeletonItem, skeletonStyles } from './skeleton';

export type TableColumnMock = {
  header: string;
  /** Left out, `start`. */
  align?: 'start' | 'center' | 'end';
  /** Draws the header label as the sort button. */
  sortable?: boolean;
  /** The column's sort direction. Left out, unsorted. */
  sort?: 'asc' | 'desc';
  /** Pins the column (`etTableStickyColumns`), with its `inset-inline-*` offset in px. */
  sticky?: { side: 'start' | 'end'; offset: number };
  /** Extra attributes on the sort button, e.g. design markers. */
  labelAttributes?: string;
};

export type TableCellMock =
  | string
  | {
      value: string;
      /** `error` draws the built-in cell error mark before the value. */
      state?: 'error';
      /** The error message, drawn as the mark's label and title. */
      message?: string;
      /** Extra attributes on the cell, e.g. design markers. */
      attributes?: string;
    };

export type TableRowMock = {
  cells: TableCellMock[];
  /** Draws the row as selected (`etTableSelection`). */
  selected?: boolean;
  /** Draws the expander open and the detail row under the row, as HTML. */
  detail?: string;
  /** Leaves the expander out, as a row `canExpand` turns down. */
  noExpander?: boolean;
  /** Extra attributes on the row, e.g. design markers. */
  attributes?: string;
  /** Extra attributes on the expander button, e.g. design markers. */
  expanderAttributes?: string;
};

export type TableMockOptions = {
  columns: TableColumnMock[];
  rows: TableRowMock[];
  /** The `grid-template-columns` of the data columns, without the leading utility tracks. */
  tracks: string;
  /** Left out, `enclosed`, as `et-table` defaults to. */
  appearance?: 'enclosed' | 'divided' | 'zebra' | 'grid' | 'bare';
  /** Left out, `md`, as `et-table` defaults to. */
  density?: 'sm' | 'md' | 'lg';
  /** Draws the selection column; the value is the select-all checkbox state. */
  selection?: 'unchecked' | 'checked' | 'mixed';
  /** Draws the expander column (`etTableRowExpansion`). */
  expandable?: boolean;
  /** Draws the group header row (`etTableGroupHeaders`) over the data columns. */
  groups?: { label?: string; span: number }[];
  /** Draws the message row in place of the body: `empty` with the default label, `error` with the default icon and label. */
  message?: 'empty' | 'error';
  /** Draws this many skeleton rows in place of the body (`etTableSkeleton`), with the bone widths in % per column. */
  placeholder?: { rows: number; widths: number[] };
  /** Draws the busy bar over the first row, its sweep held at this fraction of its run from 0 to 1. */
  busyAt?: number;
  /** Rows with a click handler (`rowClick`), which take the pointer and the pressed tint. */
  interactive?: boolean;
  /** Cells take focus (`etTableKeyboardNav`). */
  cellNavigation?: boolean;
  /** The scroll edges with content past them: draws their shadow marks and scroll fades. */
  scrolled?: { inlineStart?: boolean; inlineEnd?: boolean; blockStart?: boolean };
  /** The error color theme name, the app's `type: 'error'` theme. */
  errorColor: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheets `table()` draws with: the real table, feature, checkbox, skeleton and icon CSS. */
export const tableStyles = /* @__PURE__ */ [
  iconBase,
  checkboxBase,
  skeletonStyles,
  tableBase,
  tableStickyColumnsBase,
  tableSelectBase,
  tableExpanderBase,
  tableGroupHeaderBase,
  tableDetailBase,
  tableSkeletonRowsBase,
  `.et-table-busy-bar[data-et-busy-at]::after {
  animation: none;
  transform: translateX(calc(-100% + var(--et-busy-at) * 350%));
}
.et-table-row--placeholder .et-skeleton-item::after {
  animation: none;
}`,
].join('\n');

const checkbox = (state: 'unchecked' | 'checked' | 'mixed', label: string) => {
  const checked = state === 'checked' ? 'true' : state === 'mixed' ? 'mixed' : 'false';

  return (
    `<et-checkbox class="et-checkbox" role="checkbox" aria-checked="${checked}" aria-label="${label}" tabindex="0">` +
    `<div class="et-checkbox-box">` +
    `<svg class="et-checkbox-checkmark" viewBox="0 0 16 16" aria-hidden="true"><polyline class="et-checkbox-checkmark-path" points="3.5 8 6.5 11 12.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>` +
    `<svg class="et-checkbox-indeterminate" viewBox="0 0 16 16" aria-hidden="true"><line class="et-checkbox-indeterminate-path" x1="4" y1="8" x2="12" y2="8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line></svg>` +
    `</div></et-checkbox>`
  );
};

const attr = (name: string, value: string | number | undefined) => (value === undefined ? '' : ` ${name}="${value}"`);

const styleAttr = (value: string) => ` style="${value}"`;

const stickyOf = (column: TableColumnMock | undefined) =>
  column?.sticky
    ? {
        className: ` et-table-sticky-${column.sticky.side}`,
        style: styleAttr(`inset-inline-${column.sticky.side}: ${column.sticky.offset}px`),
      }
    : { className: '', style: '' };

const ariaSort = (column: TableColumnMock) =>
  column.sort === 'asc' ? 'ascending' : column.sort === 'desc' ? 'descending' : column.sortable ? 'none' : undefined;

const headerCell = (column: TableColumnMock) => {
  const sticky = stickyOf(column);
  const text = `<span class="et-table-cell-text">${column.header}</span>`;
  const indicator = column.sort
    ? iconMarkup(ARROW_UP_ICON, 'et-table-sort-indicator').replace('<i ', `<i data-direction="${column.sort}" `)
    : '';
  const label = column.sortable
    ? `<button class="et-table-header-label et-table-header-label--sortable" type="button"${column.labelAttributes ? ` ${column.labelAttributes}` : ''}><span class="et-table-header-label-box">${text}${indicator}</span></button>`
    : `<span class="et-table-header-label"><span class="et-table-header-label-box">${text}</span></span>`;

  return `<div class="et-table-header-cell${sticky.className}" role="columnheader"${attr('data-align', column.align)}${attr('aria-sort', ariaSort(column))}${sticky.style}>${label}</div>`;
};

const bodyCell = (options: TableMockOptions, column: number) => (cell: TableCellMock) => {
  const sticky = stickyOf(options.columns[column]);
  const resolved = typeof cell === 'string' ? { value: cell } : cell;
  const mark =
    resolved.state === 'error'
      ? iconMarkup(TRIANGLE_EXCLAMATION_ICON, `et-table-cell-error-icon et-color--${options.errorColor}`).replace(
          ' aria-hidden="true"',
          ` role="img" aria-label="${resolved.message ?? ''}" title="${resolved.message ?? ''}"`,
        )
      : '';
  const extra = resolved.attributes ? ` ${resolved.attributes}` : '';

  return `<div class="et-table-cell${sticky.className}" role="cell"${attr('data-align', options.columns[column]?.align)}${attr('data-state', resolved.state)}${attr('tabindex', options.cellNavigation ? -1 : undefined)}${sticky.style}${extra}>${mark}<span class="et-table-cell-text">${resolved.value}</span></div>`;
};

const leadHeaderCells = (options: TableMockOptions) =>
  [
    options.selection
      ? `<div class="et-table-select-cell et-table-header-cell" role="columnheader"><et-table-select-all-cell>${checkbox(options.selection, 'Select all rows')}</et-table-select-all-cell></div>`
      : '',
    options.expandable ? `<div class="et-table-expander-cell et-table-header-cell" role="columnheader"></div>` : '',
  ].join('');

const leadBodyCells = (row: TableRowMock, options: TableMockOptions) => {
  const expanded = row.detail !== undefined;
  const expander =
    row.noExpander === true
      ? ''
      : `<button class="et-table-expander" type="button" aria-expanded="${expanded}" aria-label="${expanded ? 'Collapse row' : 'Expand row'}"${row.expanderAttributes ? ` ${row.expanderAttributes}` : ''}>${iconMarkup(CHEVRON_ICON, 'et-table-expander-icon').replace('<i ', `<i data-expanded="${expanded}" `)}</button>`;

  return [
    options.selection
      ? `<div class="et-table-select-cell et-table-cell" role="cell"><et-table-select-cell>${checkbox(row.selected ? 'checked' : 'unchecked', 'Select row')}</et-table-select-cell></div>`
      : '',
    options.expandable
      ? `<div class="et-table-expander-cell et-table-cell" role="cell"><et-table-expander-cell>${expander}</et-table-expander-cell></div>`
      : '',
  ].join('');
};

const leadCount = (options: TableMockOptions) => (options.selection ? 1 : 0) + (options.expandable ? 1 : 0);

const groupRow = (options: TableMockOptions) =>
  options.groups
    ? `<et-table-group-header-row class="et-table-group-row" role="row">${'<div class="et-table-group-cell" aria-hidden="true"></div>'.repeat(leadCount(options))}${options.groups
        .map((group) =>
          group.label
            ? `<div class="et-table-group-cell et-table-group-cell--labeled" role="columnheader" aria-colspan="${group.span}"${styleAttr(`grid-column: span ${group.span}`)}><span class="et-table-cell-text">${group.label}</span></div>`
            : `<div class="et-table-group-cell" aria-hidden="true"${styleAttr(`grid-column: span ${group.span}`)}></div>`,
        )
        .join('')}</et-table-group-header-row>`
    : '';

const bodyRow = (options: TableMockOptions) => (row: TableRowMock, index: number) => {
  const last = index === options.rows.length - 1;
  const classes = [
    'et-table-row',
    row.selected && 'et-table-row--selected',
    index % 2 === 1 && 'et-table-row--stripe',
    last && 'et-table-row--last',
    options.interactive && 'et-table-row--interactive',
  ].filter(Boolean);
  const cells = row.cells.map((cell, column) => bodyCell(options, column)(cell)).join('');
  const detail =
    row.detail === undefined
      ? ''
      : `<et-table-row-detail class="et-table-detail-row" role="row"><div class="et-table-detail-cell" role="cell"><div class="et-table-detail-body">${row.detail}</div></div></et-table-row-detail>`;

  return `<div class="${classes.join(' ')}" role="row"${attr('aria-selected', options.selection ? String(row.selected === true) : undefined)}${attr('tabindex', options.interactive ? 0 : undefined)}${row.attributes ? ` ${row.attributes}` : ''}>${leadBodyCells(row, options)}${cells}</div>${detail}`;
};

const placeholderRows = (options: TableMockOptions) => {
  const { rows, widths } = options.placeholder ?? { rows: 0, widths: [] };
  const lead = (className: string) => `<div class="${className} et-table-cell" role="cell"></div>`;

  return `<et-table-skeleton-rows class="et-table-skeleton-rows">${Array.from(
    { length: rows },
    (_, index) =>
      `<div class="et-table-row et-table-row--placeholder et-skeleton--animated${index % 2 === 1 ? ' et-table-row--stripe' : ''}${index === rows - 1 ? ' et-table-row--last' : ''}" role="row" aria-hidden="true">` +
      (options.selection ? lead('et-table-select-cell') : '') +
      (options.expandable ? lead('et-table-expander-cell') : '') +
      options.columns
        .map(
          (column, position) =>
            `<div class="et-table-cell" role="cell"${attr('data-align', column.align)}>${skeletonItem({ style: `inline-size: ${widths[position] ?? 60}%` })}</div>`,
        )
        .join('') +
      `</div>`,
  ).join('')}</et-table-skeleton-rows>`;
};

const messageRow = (options: TableMockOptions) =>
  options.message === 'error'
    ? `<div class="et-table-message-row" role="row"><div class="et-table-error-cell" role="cell" aria-live="polite">${iconMarkup(TRIANGLE_EXCLAMATION_ICON, `et-table-error-icon et-color--${options.errorColor}`)}<span>Could not load data</span></div></div>`
    : `<div class="et-table-message-row" role="row"><div class="et-table-empty-cell" role="cell">No data</div></div>`;

const body = (options: TableMockOptions) => {
  if (options.message) return messageRow(options);
  if (options.placeholder) return placeholderRows(options);

  return options.rows.map(bodyRow(options)).join('');
};

const scrollFades = (scrolled: TableMockOptions['scrolled']) =>
  `<div class="et-table-scroll-fades" role="presentation" aria-hidden="true">` +
  `<div class="et-table-scroll-fade et-table-scroll-fade--start${scrolled?.inlineStart ? ' et-table-scroll-fade--visible' : ''}"></div>` +
  `<div class="et-table-scroll-fade et-table-scroll-fade--end${scrolled?.inlineEnd ? ' et-table-scroll-fade--visible' : ''}"></div>` +
  `</div>`;

/** Draws `<et-table>` with its header, body rows and the built-in features as a static snapshot of one state. */
export const table = (options: TableMockOptions) => {
  const leads = [
    options.selection && 'var(--et-table-select-width, 44px)',
    options.expandable && 'var(--et-table-expander-width, 32px)',
  ];
  const tracks = [...leads.filter(Boolean), options.tracks].join(' ');
  const busy =
    options.busyAt === undefined
      ? ''
      : `<div class="et-table-busy-bar" role="presentation" data-et-busy-at${styleAttr(`--et-busy-at: ${options.busyAt}`)}></div>`;
  const host = [
    options.attributes,
    `class="${[
      'et-table-host',
      options.scrolled?.inlineStart && 'et-table-host--scrolled-inline-start',
      options.scrolled?.inlineEnd && 'et-table-host--scrolled-inline-end',
      options.scrolled?.blockStart && 'et-table-host--scrolled-block-start',
    ]
      .filter(Boolean)
      .join(' ')}"`,
    `data-appearance="${options.appearance ?? 'enclosed'}"`,
    `data-density="${options.density ?? 'md'}"`,
    options.placeholder || options.busyAt !== undefined ? 'aria-busy="true"' : '',
  ].filter(Boolean);

  return (
    `<et-table ${host.join(' ')}>` +
    `<div class="et-table" role="table"${styleAttr(`grid-template-columns: ${tracks}`)}>` +
    groupRow(options) +
    `<div class="et-table-header-row" role="row">${leadHeaderCells(options)}${options.columns.map(headerCell).join('')}</div>` +
    busy +
    body(options) +
    scrollFades(options.scrolled) +
    `</div></et-table>`
  );
};
