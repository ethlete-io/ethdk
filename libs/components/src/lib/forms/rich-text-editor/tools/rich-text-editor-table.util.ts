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

/** Whether the table still has a header row (a `<tr>` inside `<thead>`) - the picker always creates
 *  one, but "Delete row" can remove it. */
export const hasHeaderRow = (table: HTMLTableElement) => (table.tHead?.rows.length ?? 0) > 0;

/** Whether a context's caret row is the table's header row. */
export const isHeaderRow = (ctx: TableContext) => ctx.row.parentElement?.nodeName === 'THEAD';

/** The first editable cell of a table - where the caret lands after inserting. */
export const firstTableCell = (table: HTMLElement): HTMLElement | null =>
  table instanceof HTMLTableElement ? (allRows(table)[0]?.cells[0] ?? null) : null;

/** The cell nearest a context's (row, cell) position, clamped to what still exists - for restoring
 *  the caret after an edit removed the original row/column. `null` when the table has no cells. */
export const cellAt = (ctx: TableContext): HTMLElement | null => {
  const rows = allRows(ctx.table);

  if (rows.length === 0) return null;

  const row = rows[Math.min(ctx.rowIndex, rows.length - 1)] ?? rows[rows.length - 1];

  if (!row || row.cells.length === 0) return null;

  return row.cells[Math.min(ctx.cellIndex, row.cells.length - 1)] ?? null;
};

/** Table DOM operations bound to a renderer - kept together so table code tree-shakes as one unit. */
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

    // body rows never belong in <thead> - from the header row, the new row lands at the top of the body
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
 * interceptor (so it ships - like all table code - only with `provideRichTextEditorTableTool`).
 * `exit` steps the caret OUT of an edge cell into the block next to the table (creating an empty
 * paragraph when the table ends the document); `enter` steps it INTO the first/last cell of an
 * adjacent root-level table instead of stranding it at the table's edge.
 */
const isPlainArrowKey = (event: KeyboardEvent) =>
  event.key.startsWith('Arrow') &&
  !event.shiftKey &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.isComposing;

const visibleRects = (rects: DOMRectList) => Array.from(rects).filter((rect) => rect.height > 0);

const caretRect = (caret: Range): DOMRect | null => {
  const own = visibleRects(caret.getClientRects())[0];

  if (own) return own;

  const { startContainer, startOffset } = caret;
  const neighbour =
    startContainer instanceof Element
      ? (startContainer.childNodes[startOffset] ?? startContainer.childNodes[startOffset - 1])
      : null;

  if (!(neighbour instanceof Element)) return null;

  return visibleRects(neighbour.getClientRects())[0] ?? null;
};

/** Whether the caret sits on the first or last line box of `cell`; `true` where there is no layout to measure. */
const caretOnEdgeLine = (caret: Range, { cell, edge }: { cell: HTMLElement; edge: 'first' | 'last' }) => {
  const contents = cell.ownerDocument.createRange();

  contents.selectNodeContents(cell);

  if (typeof contents.getClientRects !== 'function') return true;

  const lines = visibleRects(contents.getClientRects());
  const rect = caretRect(caret);

  if (!lines.length || !rect) return true;

  const middle = rect.top + rect.height / 2;

  return edge === 'first'
    ? middle < Math.min(...lines.map((line) => line.bottom))
    : middle > Math.max(...lines.map((line) => line.top));
};

const CONTAINER_BLOCK_TAGS = /* @__PURE__ */ new Set(['UL', 'OL', 'BLOCKQUOTE']);
const TEXT_BLOCK_TAGS = /* @__PURE__ */ new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'LI']);

/** The text block at the `edge` of `block` that a caret can sit in, or `null` for an atom, a table or a divider. */
const caretBlockAt = (block: Element | null, edge: 'first' | 'last'): HTMLElement | null => {
  let target = block;

  while (target) {
    const inner = edge === 'first' ? target.firstElementChild : target.lastElementChild;
    const descend =
      CONTAINER_BLOCK_TAGS.has(target.tagName) ||
      (target.tagName === 'LI' && !!inner && CONTAINER_BLOCK_TAGS.has(inner.tagName));

    if (!descend) break;

    target = inner;
  }

  if (!(target instanceof HTMLElement) || !TEXT_BLOCK_TAGS.has(target.tagName)) return null;

  return target.getAttribute('contenteditable') === 'false' ? null : target;
};

/** ArrowLeft/ArrowRight as a step through the text order, which runs right to left in RTL content. */
const logicalInlineKey = (key: string, element: HTMLElement): 'forward' | 'backward' | null => {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;

  const rtl = element.ownerDocument.defaultView?.getComputedStyle(element).direction === 'rtl';

  return (key === 'ArrowRight') !== rtl ? 'forward' : 'backward';
};

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

  const exit = (dom: RichTextEditorDom, event: KeyboardEvent) => {
    if (!isPlainArrowKey(event)) return false;

    const { key } = event;
    const el = dom.root();
    const editable = dom.getSelection();

    if (!el || !editable || !editable.range.collapsed) return false;

    const doc = el.ownerDocument;
    const { range } = editable;
    const ctx = findTableContext(el, range.startContainer);

    if (!ctx || ctx.table.parentElement !== el) return false;

    const { table, row, cell } = ctx;
    const rows = allRows(table);
    const firstRow = rows[0] === row;
    const lastRow = rows[rows.length - 1] === row;
    const firstCell = row.cells[0] === cell;
    const lastCell = row.cells[row.cells.length - 1] === cell;

    const atCellStart = () => {
      const r = doc.createRange();
      r.selectNodeContents(cell);
      r.setEnd(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };
    const atCellEnd = () => {
      const r = doc.createRange();
      r.selectNodeContents(cell);
      r.setStart(range.startContainer, range.startOffset);

      return r.toString().length === 0;
    };

    let edge: 'before' | 'after' | null = null;
    const inlineKey = logicalInlineKey(key, cell);

    if (key === 'ArrowUp' && firstRow && caretOnEdgeLine(range, { cell: cell, edge: 'first' })) edge = 'before';
    else if (key === 'ArrowDown' && lastRow && caretOnEdgeLine(range, { cell: cell, edge: 'last' })) edge = 'after';
    else if (inlineKey === 'backward' && firstRow && firstCell && atCellStart()) edge = 'before';
    else if (inlineKey === 'forward' && lastRow && lastCell && atCellEnd()) edge = 'after';

    if (!edge) return false;

    stepOut(table, edge);

    return true;
  };

  /** Moves the caret out of `table` (a root-level block - both callers verify that) into the
   *  adjacent text block, creating an empty paragraph when there is none to land in. */
  const stepOut = (table: HTMLTableElement, edge: 'before' | 'after') => {
    const el = table.parentElement as HTMLElement;
    const sibling = edge === 'before' ? table.previousElementSibling : table.nextElementSibling;
    let target = caretBlockAt(sibling, edge === 'before' ? 'last' : 'first');

    if (!target) {
      target = renderer.createElement('p') as HTMLElement;
      renderer.appendChild(target, renderer.createElement('br'));
      renderer.insertBefore(el, target, edge === 'before' ? table : table.nextSibling);
    }

    collapseInto(target, edge === 'before' ? target.childNodes.length : 0);
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

  const enter = (dom: RichTextEditorDom, event: KeyboardEvent) => {
    if (!isPlainArrowKey(event)) return false;

    const { key } = event;
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

    const inlineKey = blockNode instanceof HTMLElement ? logicalInlineKey(key, blockNode) : null;
    let table: Element | null = null;
    let edge: 'first' | 'last' = 'first';

    if ((key === 'ArrowDown' || inlineKey === 'forward') && atEdge('end')) {
      table = blockNode instanceof Element ? blockNode.nextElementSibling : null;
      edge = 'first';
    } else if ((key === 'ArrowUp' || inlineKey === 'backward') && atEdge('start')) {
      table = blockNode instanceof Element ? blockNode.previousElementSibling : null;
      edge = 'last';
    }

    if (!(table instanceof HTMLTableElement)) return false;

    const rows = allRows(table);
    const targetRow = edge === 'first' ? rows[0] : rows[rows.length - 1];
    const cell = targetRow?.cells[edge === 'first' ? 0 : targetRow.cells.length - 1];

    if (!cell) return false;

    collapseInto(cell, edge === 'first' ? 0 : cell.childNodes.length);

    return true;
  };

  return { exit, enter, tab };
};
