import { Component, computed, ElementRef, input, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { injectHasTouchInput, injectRenderer } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../../button';
import { IconDirective, provideIcons, TABLE_ICON } from '../../../icon';
import { MENU_IMPORTS, MenuDirective } from '../../../menu';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import {
  cellAt,
  createTableOps,
  findTableContext,
  firstTableCell,
  hasHeaderRow,
  isHeaderRow,
  TableContext,
} from './rich-text-editor-table.util';

const PICKER_ROWS = 6;
const PICKER_COLS = 8;

const PICKER_KEY_STEPS: Record<string, { row: number; col: number }> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

const clampToPicker = (value: number, max: number) => Math.max(0, Math.min(value, max));

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
  /** On touch, open the menu without stealing focus so the keyboard (and docked toolbar) stay put. */
  protected hasTouchInput = injectHasTouchInput();

  public editor = input.required<RichTextEditorDirective>();

  protected menu = viewChild.required(MenuDirective);
  protected pickerGrid = viewChild<ElementRef<HTMLElement>>('pickerGrid');

  /** The editor's strings — the tool is part of that editor's toolbar. */
  protected labels = computed(() => this.editor().resolvedLabels());

  private ops = createTableOps(this.renderer);

  protected readonly pickerRows = Array.from({ length: PICKER_ROWS }, (_, i) => i);
  protected readonly pickerCols = Array.from({ length: PICKER_COLS }, (_, i) => i);

  protected hoverRows = signal(0);
  protected hoverCols = signal(0);
  protected sizeLabel = computed(() => {
    const labels = this.labels();

    return this.hoverRows() > 0 ? labels.tableSizePreview(this.hoverRows(), this.hoverCols()) : labels.tableInsert;
  });

  /** Table context at the caret, recomputed when the menu opens (via `refreshContext`). */
  protected context = signal<TableContext | null>(null);

  /** Set when a touch/pen release already inserted, so the synthetic click after a tap doesn't insert twice. */
  private insertedByPointer = false;

  /** "Insert header row" only shows when the table lost its header (the picker always creates one). */
  protected canAddHeaderRow = computed(() => {
    const ctx = this.context();

    return !!ctx && !hasHeaderRow(ctx.table);
  });

  /** "Insert row above" makes no sense from inside the header row — nothing goes above the header. */
  protected inHeaderRow = computed(() => {
    const ctx = this.context();

    return !!ctx && isHeaderRow(ctx);
  });

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

  /**
   * Arrow-key support for the size picker — it has no menu items, so the menu's own keyboard
   * navigation has nothing to drive. The menu opens with the panel focused; the first arrow steps
   * onto the 1×1 cell and further arrows move through the grid, with Enter/Space committing via the
   * focused cell's native click. Listens on the `et-menu` element (= the panel) so the initial
   * panel-targeted keydown is caught alongside the bubbling cell ones.
   */
  protected handlePickerKeydown(event: KeyboardEvent) {
    // caret inside a table: the menu shows regular items, which the menu navigates itself
    if (this.context()) return;

    const grid = this.pickerGrid()?.nativeElement;

    if (!grid) return;

    // A focused cell isn't a menu item and doesn't target the panel, so the menu's own
    // Escape/Tab handling never sees its keydowns — mirror it (panel-targeted ones still work).
    if (event.target instanceof Element && grid.contains(event.target)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.menu().closeLevel('escape');

        return;
      }

      if (event.key === 'Tab') {
        this.menu().closeAll('tab');

        return;
      }
    }

    const step = PICKER_KEY_STEPS[event.key];

    if (!step) return;

    // eslint-disable-next-line ethlete/no-dom-query -- cells carry no unique hook; an atomic class query is simplest
    const cells = Array.from(grid.querySelectorAll<HTMLButtonElement>('.et-rte-table-picker-cell'));
    const focused = cells.indexOf(event.target as HTMLButtonElement);
    const row = focused === -1 ? 0 : clampToPicker(Math.floor(focused / PICKER_COLS) + step.row, PICKER_ROWS - 1);
    const col = focused === -1 ? 0 : clampToPicker((focused % PICKER_COLS) + step.col, PICKER_COLS - 1);
    const cell = cells[row * PICKER_COLS + col];

    if (!cell) return;

    event.preventDefault();
    cell.focus();
    this.hover(row, col);
  }

  /**
   * Touch implicitly captures the pointer on the cell it went down on, which would stop
   * `pointerenter` from reaching the other cells — release it so a swipe extends the selection.
   */
  protected beginSwipeSelection(event: PointerEvent) {
    this.insertedByPointer = false;

    if (event.target instanceof Element && event.target.hasPointerCapture(event.pointerId)) {
      event.target.releasePointerCapture(event.pointerId);
    }
  }

  /**
   * Commits a touch/pen selection where the finger lifts. A swipe's down and up targets differ,
   * so no cell ever gets the click event — the grid's pointerup is the only commit signal.
   * Mouse keeps committing via the cell's click.
   */
  protected commitSwipeSelection(event: PointerEvent) {
    if (event.pointerType === 'mouse') return;

    const rows = this.hoverRows();
    const cols = this.hoverCols();

    if (!rows || !cols) return;

    this.insertedByPointer = true;
    this.insert(rows - 1, cols - 1);
    this.menu().closeAll();
  }

  protected insertFromCell(row: number, col: number) {
    if (this.insertedByPointer) {
      this.insertedByPointer = false;

      return;
    }

    this.insert(row, col);
    this.menu().closeAll();
  }

  public insert(row: number, col: number) {
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

  protected addHeaderRow() {
    this.mutate((ctx) => this.ops.insertHeaderRow(ctx));
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
