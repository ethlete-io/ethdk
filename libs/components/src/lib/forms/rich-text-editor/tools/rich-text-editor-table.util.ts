import { injectRenderer } from '@ethlete/core';

/** The Ethlete renderer wrapper returned by `injectRenderer()`. */
type EditorRenderer = NonNullable<ReturnType<typeof injectRenderer>>;

/** Where the caret currently sits inside a table, if anywhere. */
export type TableContext = {
  table: HTMLTableElement;
  row: HTMLTableRowElement;
  cell: HTMLTableCellElement;
  rowIndex: number;
  cellIndex: number;
};

const allRows = (table: HTMLTableElement): HTMLTableRowElement[] => {
  const rows: HTMLTableRowElement[] = [];

  for (const section of table.children) {
    if (section instanceof HTMLTableSectionElement) {
      for (const row of section.children) if (row instanceof HTMLTableRowElement) rows.push(row);
    }
  }

  return rows;
};

/** Walks up from a node to the table cell/row/table wrapping it (within the editor root). */
export const findTableContext = (root: HTMLElement, node: Node | null): TableContext | null => {
  let el: HTMLElement | null = node instanceof HTMLElement ? node : (node?.parentElement ?? null);

  while (el && el !== root && !(el instanceof HTMLTableCellElement)) {
    el = el.parentElement;
  }

  if (!(el instanceof HTMLTableCellElement) || !root.contains(el)) return null;

  const cell = el;
  const row = cell.parentElement instanceof HTMLTableRowElement ? cell.parentElement : null;
  let table: HTMLElement | null = row;

  while (table && !(table instanceof HTMLTableElement)) table = table.parentElement;

  if (!row || !(table instanceof HTMLTableElement)) return null;

  const rows = allRows(table);

  return { table, row, cell, rowIndex: rows.indexOf(row), cellIndex: [...row.cells].indexOf(cell) };
};

/** The first editable cell of a table — where the caret lands after inserting. */
export const firstTableCell = (table: HTMLElement): HTMLElement | null =>
  table instanceof HTMLTableElement ? (allRows(table)[0]?.cells[0] ?? null) : null;

/** The cell nearest a context's (row, cell) position, clamped to what still exists — for restoring
 *  the caret after an edit removed the original row/column. `null` when the table has no cells. */
export const cellAt = (ctx: TableContext): HTMLElement | null => {
  const rows = allRows(ctx.table);

  if (rows.length === 0) return null;

  const row = rows[Math.min(ctx.rowIndex, rows.length - 1)] ?? rows[rows.length - 1];

  if (!row || row.cells.length === 0) return null;

  return row.cells[Math.min(ctx.cellIndex, row.cells.length - 1)] ?? null;
};

/** Table DOM operations bound to a renderer — kept together so table code tree-shakes as one unit. */
export const createTableOps = (renderer: EditorRenderer) => {
  const fillCell = (cell: HTMLElement) => renderer.appendChild(cell, renderer.createElement('br'));

  const makeCell = (tag: 'th' | 'td') => {
    const cell = renderer.createElement(tag) as HTMLElement;
    fillCell(cell);

    return cell;
  };

  /** Builds a `rows × cols` table (first row is the header) with empty, editable cells. */
  const create = (rows: number, cols: number): HTMLElement => {
    const table = renderer.createElement('table') as HTMLElement;
    const thead = renderer.createElement('thead') as HTMLElement;
    const headRow = renderer.createElement('tr') as HTMLElement;

    for (let c = 0; c < cols; c++) renderer.appendChild(headRow, makeCell('th'));

    renderer.appendChild(thead, headRow);
    renderer.appendChild(table, thead);

    const tbody = renderer.createElement('tbody') as HTMLElement;

    for (let r = 0; r < Math.max(rows - 1, 1); r++) {
      const tr = renderer.createElement('tr') as HTMLElement;
      for (let c = 0; c < cols; c++) renderer.appendChild(tr, makeCell('td'));
      renderer.appendChild(tbody, tr);
    }

    renderer.appendChild(table, tbody);

    return table;
  };

  /** Inserts a row (matching the current column count) above or below the caret's row. */
  const insertRow = (ctx: TableContext, position: 'above' | 'below') => {
    const tr = renderer.createElement('tr') as HTMLElement;
    for (let c = 0; c < ctx.row.cells.length; c++) renderer.appendChild(tr, makeCell('td'));

    const section = ctx.row.parentElement as HTMLElement;
    renderer.insertBefore(section, tr, position === 'above' ? ctx.row : ctx.row.nextSibling);
  };

  /** Inserts a column left or right of the caret's cell, adding a matching cell to every row. */
  const insertColumn = (ctx: TableContext, position: 'left' | 'right') => {
    for (const row of allRows(ctx.table)) {
      const cell = makeCell(row.parentElement?.nodeName === 'THEAD' ? 'th' : 'td');
      const at = row.cells[ctx.cellIndex] ?? null;
      renderer.insertBefore(row, cell, position === 'left' ? at : (at?.nextSibling ?? null));
    }
  };

  const deleteTable = (ctx: TableContext) => {
    const parent = ctx.table.parentElement;
    if (parent) renderer.removeChild(parent, ctx.table);
  };

  /** Removes the caret's row; removes the whole table when it was the last row. */
  const deleteRow = (ctx: TableContext) => {
    if (allRows(ctx.table).length <= 1) {
      deleteTable(ctx);

      return;
    }

    renderer.removeChild(ctx.row.parentElement as HTMLElement, ctx.row);
  };

  /** Removes the caret's column; removes the whole table when it was the last column. */
  const deleteColumn = (ctx: TableContext) => {
    if (ctx.row.cells.length <= 1) {
      deleteTable(ctx);

      return;
    }

    for (const row of allRows(ctx.table)) {
      const cell = row.cells[ctx.cellIndex];
      if (cell) renderer.removeChild(row, cell);
    }
  };

  return { create, insertRow, insertColumn, deleteRow, deleteColumn, deleteTable };
};
