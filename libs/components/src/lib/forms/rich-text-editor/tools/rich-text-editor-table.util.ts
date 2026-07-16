import { injectRenderer } from '@ethlete/core';
import { RichTextEditorDom } from '../headless/internals/rich-text-editor-dom';

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

/** Whether the table still has a header row (a `<tr>` inside `<thead>`) — the picker always creates
 *  one, but "Delete row" can remove it. */
export const hasHeaderRow = (table: HTMLTableElement) => (table.tHead?.rows.length ?? 0) > 0;

/** Whether a context's caret row is the table's header row. */
export const isHeaderRow = (ctx: TableContext) => ctx.row.parentElement?.nodeName === 'THEAD';

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

    // body rows never belong in <thead> — from the header row, the new row lands at the top of the body
    if (isHeaderRow(ctx)) {
      const body = ctx.table.tBodies[0] ?? null;

      if (body) {
        renderer.insertBefore(body, tr, body.firstChild);
      } else {
        const tbody = renderer.createElement('tbody') as HTMLElement;
        renderer.appendChild(tbody, tr);
        renderer.appendChild(ctx.table, tbody);
      }

      return;
    }

    const section = ctx.row.parentElement as HTMLElement;
    renderer.insertBefore(section, tr, position === 'above' ? ctx.row : ctx.row.nextSibling);
  };

  /** Re-adds the header row (matching the current column count) after "Delete row" removed it. */
  const insertHeaderRow = (ctx: TableContext) => {
    const tr = renderer.createElement('tr') as HTMLElement;
    for (let c = 0; c < ctx.row.cells.length; c++) renderer.appendChild(tr, makeCell('th'));

    let head: HTMLElement | null = ctx.table.tHead;

    if (!head) {
      head = renderer.createElement('thead') as HTMLElement;
      renderer.insertBefore(ctx.table, head, ctx.table.firstChild);
    }

    renderer.appendChild(head, tr);
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

    const section = ctx.row.parentElement as HTMLElement;
    renderer.removeChild(section, ctx.row);

    // don't leave an empty <thead>/<tbody> behind
    if (section.childElementCount === 0) {
      renderer.removeChild(ctx.table, section);
    }
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

  return { create, insertRow, insertHeaderRow, insertColumn, deleteRow, deleteColumn, deleteTable };
};

/**
 * Arrow-key caret navigation across table boundaries, registered as the table tool's `keydown`
 * interceptor (so it ships — like all table code — only with `provideRichTextEditorTableTool`).
 * `exit` steps the caret OUT of an edge cell into the block next to the table (creating an empty
 * paragraph when the table ends the document); `enter` steps it INTO the first/last cell of an
 * adjacent root-level table instead of stranding it at the table's edge.
 */
export const createTableNav = (renderer: EditorRenderer) => {
  const collapseInto = (node: Node, offset: number) => {
    const doc = node.ownerDocument;
    const selection = doc?.getSelection();

    if (!doc) return;

    if (!selection) return;

    const range = doc.createRange();

    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const exit = (dom: RichTextEditorDom, key: string) => {
    if (!key.startsWith('Arrow')) return false;

    const el = dom.root();
    const editable = dom.getSelection();

    if (!el || !editable || !editable.range.collapsed) return false;

    const doc = el.ownerDocument;
    const { range } = editable;
    let cell: HTMLElement | null =
      range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;

    while (cell && cell !== el && !(cell instanceof HTMLTableCellElement)) cell = cell.parentElement;

    if (!(cell instanceof HTMLTableCellElement)) return false;

    const cellEl = cell;
    const row = cell.parentElement;
    const table = row?.parentElement?.parentElement;

    if (!(row instanceof HTMLTableRowElement) || !(table instanceof HTMLTableElement) || table.parentElement !== el) {
      return false;
    }

    const rows = allRows(table);
    const firstRow = rows[0] === row;
    const lastRow = rows[rows.length - 1] === row;
    const firstCell = row.cells[0] === cell;
    const lastCell = row.cells[row.cells.length - 1] === cell;

    const atCellStart = () => {
      const r = doc.createRange();
      r.selectNodeContents(cellEl);
      r.setEnd(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };
    const atCellEnd = () => {
      const r = doc.createRange();
      r.selectNodeContents(cellEl);
      r.setStart(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };

    let edge: 'before' | 'after' | null = null;

    if (key === 'ArrowUp' && firstRow) edge = 'before';
    else if (key === 'ArrowDown' && lastRow) edge = 'after';
    else if (key === 'ArrowLeft' && firstRow && firstCell && atCellStart()) edge = 'before';
    else if (key === 'ArrowRight' && lastRow && lastCell && atCellEnd()) edge = 'after';

    if (!edge) return false;

    stepOut(table, edge);

    return true;
  };

  /** Moves the caret out of `table` (a root-level block — both callers verify that) into the
   *  adjacent block, creating an empty paragraph when the table starts/ends the document. */
  const stepOut = (table: HTMLTableElement, edge: 'before' | 'after') => {
    const el = table.parentElement as HTMLElement;
    const doc = el.ownerDocument;
    const sibling = edge === 'before' ? table.previousElementSibling : table.nextElementSibling;
    let target = sibling instanceof HTMLElement ? sibling : null;

    if (!target) {
      target = renderer.createElement('p') as HTMLElement;
      renderer.appendChild(target, renderer.createElement('br'));
      renderer.insertBefore(el, target, edge === 'before' ? table : table.nextSibling);
    }

    const caret = doc.createRange();

    caret.selectNodeContents(target);
    caret.collapse(edge === 'before' ? false : true);

    const selection = doc.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(caret);
  };

  /** Tab / Shift+Tab cell navigation: next/previous cell in row-major order; from the table's
   *  last/first cell it steps OUT to the adjacent block (like the arrow-key `exit`), so Tab still
   *  offers a keyboard escape route out of the editor's table instead of trapping the caret. */
  const tab = (dom: RichTextEditorDom, event: KeyboardEvent) => {
    if (event.key !== 'Tab') return false;

    const el = dom.root();
    const editable = dom.getSelection();

    if (!el || !editable) return false;

    const ctx = findTableContext(el, editable.range.startContainer);

    if (!ctx || ctx.table.parentElement !== el) return false;

    const cells = allRows(ctx.table).flatMap((row) => [...row.cells]);
    const index = cells.indexOf(ctx.cell);
    const target = cells[index + (event.shiftKey ? -1 : 1)] ?? null;

    if (target) {
      collapseInto(target, 0);
    } else {
      stepOut(ctx.table, event.shiftKey ? 'before' : 'after');
    }

    return true;
  };

  const enter = (dom: RichTextEditorDom, key: string) => {
    if (!key.startsWith('Arrow')) return false;

    const el = dom.root();
    const editable = dom.getSelection();

    if (!el || !editable || !editable.range.collapsed) return false;

    const doc = el.ownerDocument;
    const { range } = editable;
    let block: Node | null = range.startContainer;

    while (block && block.parentNode !== el) block = block.parentNode;

    if (!block || block instanceof HTMLTableElement) return false;

    const blockNode = block;

    const atEdge = (side: 'start' | 'end') => {
      const r = doc.createRange();
      r.selectNodeContents(blockNode);
      if (side === 'start') r.setEnd(range.startContainer, range.startOffset);
      else r.setStart(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };

    const elementSibling = (from: Node, dir: 'next' | 'prev'): Element | null => {
      let sib = dir === 'next' ? from.nextSibling : from.previousSibling;
      while (sib && sib.nodeType !== Node.ELEMENT_NODE) sib = dir === 'next' ? sib.nextSibling : sib.previousSibling;

      return sib instanceof Element ? sib : null;
    };

    let table: Element | null = null;
    let edge: 'first' | 'last' = 'first';

    if ((key === 'ArrowDown' || key === 'ArrowRight') && atEdge('end')) {
      table = elementSibling(block, 'next');
      edge = 'first';
    } else if ((key === 'ArrowUp' || key === 'ArrowLeft') && atEdge('start')) {
      table = elementSibling(block, 'prev');
      edge = 'last';
    }

    if (!(table instanceof HTMLTableElement)) return false;

    const rows = allRows(table);
    const targetRow = edge === 'first' ? rows[0] : rows[rows.length - 1];
    const cell = targetRow?.cells[edge === 'first' ? 0 : targetRow.cells.length - 1];

    if (!cell) return false;

    collapseInto(cell, 0);

    return true;
  };

  return { exit, enter, tab };
};
