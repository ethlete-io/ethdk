import { Component, computed, input, signal, ViewEncapsulation } from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { IconDirective, provideIcons, TABLE_ICON } from '../../../icon';
import { MENU_IMPORTS } from '../../../menu';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { cellAt, createTableOps, findTableContext, firstTableCell, TableContext } from './rich-text-editor-table.util';

const PICKER_ROWS = 6;
const PICKER_COLS = 8;

/**
 * The opt-in table tool's toolbar control: a menu that shows a grid-size picker to insert a table,
 * or row/column actions when the caret is inside one. Registered via `provideRichTextEditorTableTool`,
 * so all of this (and the table DOM ops it imports) only ships when a consumer opts in.
 */
@Component({
  selector: 'et-rich-text-editor-table-tool',
  templateUrl: './rich-text-editor-table-tool.component.html',
  styleUrl: './rich-text-editor-table-tool.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, IconDirective, ...MENU_IMPORTS],
  providers: [provideIcons(TABLE_ICON)],
  host: { class: 'et-rte-table-tool' },
})
export class RichTextEditorTableToolComponent {
  private renderer = injectRenderer();

  public editor = input.required<RichTextEditorDirective>();

  private ops = createTableOps(this.renderer);

  protected readonly pickerRows = Array.from({ length: PICKER_ROWS }, (_, i) => i);
  protected readonly pickerCols = Array.from({ length: PICKER_COLS }, (_, i) => i);

  protected hoverRows = signal(0);
  protected hoverCols = signal(0);
  protected sizeLabel = computed(() =>
    this.hoverRows() > 0 ? `${this.hoverRows()} × ${this.hoverCols()}` : 'Insert table',
  );

  /** Table context at the caret, recomputed when the menu opens (via `refreshContext`). */
  protected context = signal<TableContext | null>(null);

  protected disabled = computed(() => this.editor().disabled() || this.editor().readonly());

  protected refreshContext() {
    this.context.set(this.currentContext());
    this.hoverRows.set(0);
    this.hoverCols.set(0);
  }

  protected hover(row: number, col: number) {
    this.hoverRows.set(row + 1);
    this.hoverCols.set(col + 1);
  }

  protected insert(row: number, col: number) {
    const editor = this.editor();
    const root = editor.editorDom.root();

    if (!root || this.disabled()) return;

    const table = this.ops.create(row + 1, col + 1);
    const block = this.caretBlock(root);

    if (block) {
      this.renderer.insertBefore(root, table, block.nextSibling);
    } else {
      this.renderer.appendChild(root, table);
    }

    // A table with nothing after it traps the caret at the bottom edge, so add a trailing empty
    // paragraph to step down into. Nothing is added above (an existing block, or the editor top).
    if (!table.nextSibling) {
      this.renderer.insertBefore(root, this.emptyParagraph(), table.nextSibling);
    }

    editor.syncFromDom();
    queueMicrotask(() => this.restoreCaret(firstTableCell(table)));
  }

  protected addRow(position: 'above' | 'below') {
    this.mutate((ctx) => this.ops.insertRow(ctx, position));
  }

  protected addColumn(position: 'left' | 'right') {
    this.mutate((ctx) => this.ops.insertColumn(ctx, position));
  }

  protected removeRow() {
    this.mutate((ctx) => this.ops.deleteRow(ctx));
  }

  protected removeColumn() {
    this.mutate((ctx) => this.ops.deleteColumn(ctx));
  }

  protected removeTable() {
    this.mutate((ctx) => this.ops.deleteTable(ctx));
  }

  private mutate(operation: (ctx: TableContext) => void) {
    const ctx = this.context() ?? this.currentContext();

    if (!ctx || this.disabled()) return;

    operation(ctx);
    this.editor().syncFromDom();

    // keep the caret inside the (surviving) table so reopening the menu still shows the edit actions
    const survivingCell = ctx.table.isConnected ? cellAt(ctx) : null;
    queueMicrotask(() => this.restoreCaret(survivingCell));
  }

  private currentContext(): TableContext | null {
    const editor = this.editor();
    const root = editor.editorDom.root();
    const selection = editor.editorDom.getSelection();

    if (!root || !selection) return null;

    return findTableContext(root, selection.range.startContainer);
  }

  /** An empty paragraph (`<p><br></p>`) the caret can step into when exiting a table. */
  private emptyParagraph(): HTMLElement {
    const paragraph = this.renderer.createElement('p') as HTMLElement;
    this.renderer.appendChild(paragraph, this.renderer.createElement('br'));

    return paragraph;
  }

  /** The editor-root-level block the caret sits in, so a new table lands after it (not inside it). */
  private caretBlock(root: HTMLElement): HTMLElement | null {
    const selection = this.editor().editorDom.getSelection();

    if (!selection) return null;

    let node: HTMLElement | null =
      selection.range.startContainer instanceof HTMLElement
        ? selection.range.startContainer
        : selection.range.startContainer.parentElement;

    while (node && node.parentElement !== root) node = node.parentElement;

    return node;
  }

  /** Refocuses the editor and drops the caret into `cell` (or leaves focus alone when it is gone). */
  private restoreCaret(cell: HTMLElement | null) {
    this.editor().activate();

    const root = this.editor().editorDom.root();

    if (!cell || !root?.contains(cell)) return;

    const selection = root.ownerDocument.getSelection();
    const range = root.ownerDocument.createRange();

    range.selectNodeContents(cell);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}
