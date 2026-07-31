import {
  afterNextRender,
  computed,
  Directive,
  DOCUMENT,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FieldTree, form } from '@angular/forms/signals';
import { getFocusableElements, injectRenderer, RuntimeError } from '@ethlete/core';
import { TableFeatureConfig, tableFeatureConfig } from './headless/table-features';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableInlineEditStylesComponent } from './table-inline-edit-styles.component';
import { injectStyleManager } from '@ethlete/core';
import { TableComponent } from './table.component';
import { TableCellEditContext, TableColumnDef } from './table.types';

/** What one committed edit reports. The mutation is the consumer's — see {@link TableInlineEditDirective}. */
export type TableCellEditCommit<T> = {
  /** The row that was edited. */
  row: T;
  /** The edited column's key. */
  column: string;
  /** The cell's value before the edit. */
  previous: unknown;
  /** The value the editor produced. Equal to `previous` when the user changed nothing. */
  next: unknown;
};

/** Which cell an edit was about — what `cellCancel` reports. */
export type TableCellEditTarget<T> = {
  row: T;
  /** The column's key. */
  column: string;
};

/** Options for {@link TableInlineEditDirective}. */
export type TableInlineEditConfig<T> = TableFeatureConfig & {
  /**
   * Gate individual cells on top of the column's `editable` — e.g. a row the current user may not
   * change, or a field that is locked once it has a value. Defaults to every cell of an editable column.
   */
  editableCell?: (row: T, column: string) => boolean;
};

// The one open edit. `position` is where the cell is (absolute row index, visible-column index), which
// is what focus goes back to and what the Tab step counts from.
type TableEditSession<T> = {
  row: T;
  column: TableColumnDef<T>;
  position: { row: number; column: number };
  previous: unknown;
  context: TableCellEditContext<T, unknown>;
};

/**
 * Opt-in inline cell editing for `et-table`: a cell of an `editable` column swaps its content for the
 * column's `etTableCellEdit` template, and Enter or Escape puts it back.
 *
 * The editor is yours. The feature holds the draft as a **signal-forms field** and hands it to the
 * template, so the control is bound exactly the way every control in this library is bound
 * (`[formField]`) — there is no cell-editor interface to implement.
 *
 * | Key / gesture       | Does                                                        |
 * | ------------------- | ----------------------------------------------------------- |
 * | double-click        | starts editing the cell                                       |
 * | `Enter`             | starts editing the focused cell, and commits the open one     |
 * | `Escape`            | cancels, restoring the value                                  |
 * | `Tab` / `Shift+Tab` | commits and moves to the next cell in the row, editing it too |
 *
 * `Enter` needs cell focus, which is [`etTableKeyboardNav`](/components/table#keyboard-navigation) —
 * without it the double-click flow still works, and the two features agree on `Enter` through the table
 * (navigation offers the cell here first, and only drills into its content when this feature passes).
 *
 * **The feature does not write to your data.** `commit` reports the change; you perform the mutation
 * and report its progress back through the table's `cellState`, which is what shows the cell as saving
 * or failed.
 *
 * @example
 * <et-table
 *   [data]="people()"
 *   [columns]="COLUMNS"
 *   [cellState]="cellStateOf"
 *   (cellCommit)="save($event)"
 *   etTableInlineEdit
 *   etTableKeyboardNav
 * >
 *   <ng-template [etTableCellEdit]="COLUMNS.name" let-field="field">
 *     <et-form-field size="sm"><et-input [formField]="field" aria-label="Name" /></et-form-field>
 *   </ng-template>
 * </et-table>
 */
@Directive({
  selector: '[etTableInlineEdit]',
  exportAs: 'etTableInlineEdit',
  host: {
    '(dblclick)': 'handleDoubleClick($event)',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class TableInlineEditDirective<T> {
  private table = injectHostTable<T>();
  private renderer = injectRenderer();
  private injector = inject(Injector);
  private document = inject(DOCUMENT);

  /** See {@link TableInlineEditConfig}. */
  public config = input({} as TableInlineEditConfig<T>, {
    alias: 'etTableInlineEdit',
    transform: tableFeatureConfig<TableInlineEditConfig<T>>,
  });

  /**
   * A cell was committed — with Enter, with Tab, or by opening another one. Perform the mutation here
   * and drive the table's `cellState` from it; the feature has already closed the editor.
   */
  public cellCommit = output<TableCellEditCommit<T>>();

  /** An edit was abandoned with Escape, or because its row left the table. Nothing was changed. */
  public cellCancel = output<TableCellEditTarget<T>>();

  // The draft the open editor writes into. One signal — and so one form — for every edit, because only
  // one cell is ever open; starting an edit seeds it with the cell's current value.
  private draft = signal<unknown>(null);

  // What the template binds with [formField]. `form()` needs an injection context, which is why it is
  // built once here rather than per session.
  private draftField = form(this.draft) as FieldTree<unknown>;

  private session = signal<TableEditSession<T> | null>(null);

  private enabled = computed(() => this.config().enabled ?? true);

  /** The cell currently being edited, or `null`. */
  public editing = computed(() => {
    const session = this.session();

    return session && ({ row: session.row, column: session.column.key } satisfies TableCellEditTarget<T>);
  });

  constructor() {
    // The edit-mode cell's rules ship with the feature, so a read-only table has none of them.
    injectStyleManager().mount(TableInlineEditStylesComponent);

    this.table.registerCellEditing({
      cell: computed(() => {
        const session = this.session();

        return (
          session && {
            row: this.table.rowIdentity(session.row),
            column: session.column.key,
            context: session.context,
          }
        );
      }),
      editCell: (rowIndex, columnIndex) => this.editCell(rowIndex, columnIndex),
      enabled: this.enabled,
    });

    // A refetch, a filter or a page change can take the edited row away while its editor is open. Left
    // alone the draft would go on floating over whatever row moved into that position.
    effect(() => {
      const rows = this.table.rows();
      const session = untracked(this.session);

      if (!session) return;

      const identity = this.table.rowIdentity(session.row);

      if (!rows.some((row) => this.table.rowIdentity(row) === identity)) untracked(() => this.cancel());
    });
  }

  /**
   * Start editing the cell at an absolute row index and a visible-column index. Returns whether it
   * opened — `false` for a column that isn't `editable`, has no `etTableCellEdit` template, or was
   * turned down by `editableCell`. Also the table's `editCell` seam, which is how `Enter` arrives.
   */
  public editCell(rowIndex: number, columnIndex: number) {
    if (!this.enabled()) return false;

    const row = untracked(() => this.table.rows())[rowIndex];
    const column = untracked(() => this.table.visibleColumns())[columnIndex];

    if (!row || !column || !this.canEdit(row, column)) return false;

    this.begin({ row, column, position: { row: rowIndex, column: columnIndex } });

    return true;
  }

  /** Close the open editor and report the draft as a commit. Does nothing when no cell is open. */
  public commit() {
    const session = untracked(this.session);

    if (!session) return;

    const next = untracked(this.draft);

    // Closed before the consumer hears about it: they will start a request and drive `cellState`, and
    // the cell has to be showing its value again by then for that state to land on anything.
    this.session.set(null);
    this.restoreFocus(session);
    this.cellCommit.emit({ row: session.row, column: session.column.key, previous: session.previous, next });
  }

  /** Close the open editor, discarding the draft. Does nothing when no cell is open. */
  public cancel() {
    const session = untracked(this.session);

    if (!session) return;

    this.session.set(null);
    this.restoreFocus(session);
    this.cellCancel.emit({ row: session.row, column: session.column.key });
  }

  protected handleDoubleClick(event: MouseEvent) {
    if (!this.enabled()) return;

    const hit = this.cellFrom(event);

    if (!hit) return;

    // A double-click also selects the text under it, which is exactly what the editor is about to
    // replace — so the selection would be left behind on top of the field.
    if (this.editCell(hit.row, hit.column)) this.document.getSelection()?.removeAllRanges();
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (!this.enabled()) return;

    const session = untracked(this.session);

    if (!session) return;

    const cell = this.cellOf(session);

    // Only the open editor's own keystrokes are ours. Everything else in the table — another row's
    // link, a header's sort button — carries on as it would without this feature.
    if (!cell || !event.composedPath().includes(cell)) return;

    // Escape gets out from anywhere in the cell, including the cell itself: an editor with nothing
    // focusable in it would otherwise be a trap.
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();

      return;
    }

    // Enter and Tab have to come from *inside* the editor. The `Enter` that opens one is dispatched on
    // the cell, and keyboard navigation may have handed it over before this listener ran — so without
    // this the editor would be closed by the very keystroke that opened it. Host-listener order between
    // two directives on the same element is not ours to choose, so it must not matter.
    if (event.target === cell) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.commit();

        return;
      case 'Tab':
        event.preventDefault();
        this.commitAndMove(session, event.shiftKey ? -1 : 1);

        return;
      default:
        return;
    }
  }

  // Tab moves within the row only. The next row may not be rendered (a virtual window), and a Tab that
  // scrolls the grid is not what someone typing down a form expects; at the row's edge the cell simply
  // keeps focus, so the next Tab leaves the grid exactly as it would from any other cell.
  private commitAndMove(session: TableEditSession<T>, step: number) {
    const { row: rowIndex, column: columnIndex } = session.position;
    const nextIndex = columnIndex + step;

    this.commit();

    const cell = this.table.bodyCellElementAt(rowIndex, nextIndex);

    if (!cell) return;

    // Focus first: keyboard navigation, when it is on, picks the cell up as its new roving target from
    // this very event, and the editor that may open next then focuses out of the right place.
    this.focusCellElement(cell);

    const row = untracked(() => this.table.rows())[rowIndex];
    const column = untracked(() => this.table.visibleColumns())[nextIndex];

    if (row && column && this.canEdit(row, column))
      this.begin({ row, column, position: { row: rowIndex, column: nextIndex } });
  }

  private begin({ row, column, position }: Omit<TableEditSession<T>, 'previous' | 'context'>) {
    // Opening a second cell commits the first — one cell is in edit mode at a time, and abandoning the
    // typing someone just did is not what moving on means.
    this.commit();

    const previous = column.value(row);

    this.draft.set(previous);
    this.session.set({
      row,
      column,
      position,
      previous,
      context: { $implicit: row, value: previous, field: this.draftField },
    });

    // The editor does not exist until the render this just scheduled has run.
    afterNextRender({ write: () => this.focusEditor() }, { injector: this.injector });
  }

  private focusEditor() {
    const session = untracked(this.session);

    if (!session) return;

    const cell = this.cellOf(session);

    if (!cell) return;

    getFocusableElements(cell, this.document)[0]?.focus();
  }

  // Back to the cell the editor was in, so the arrows carry on from there rather than from wherever the
  // browser puts focus when the editor is destroyed (the document body).
  private restoreFocus(session: TableEditSession<T>) {
    const cell = this.cellOf(session);

    if (cell) this.focusCellElement(cell);
  }

  // A body cell is only focusable while a cell-navigation feature is on, which inline editing does not
  // require. Giving it a `-1` stop of its own costs nothing (it stays out of the tab order) and is what
  // keeps focus inside the table after a commit on a table without the arrows.
  private focusCellElement(cell: HTMLElement) {
    if (!cell.hasAttribute('tabindex')) this.renderer.setAttribute(cell, 'tabindex', '-1');

    cell.focus();
  }

  private canEdit(row: T, column: TableColumnDef<T>) {
    // Without a template there is nothing to swap the cell's content for, so `editable` alone would
    // blank the cell on Enter. Treating that as "not editable" is the quiet, correct answer.
    if (!column.editable || !this.table.columnTemplate('cellEdit', column.key)) return false;

    return this.config().editableCell?.(row, column.key) ?? true;
  }

  private cellOf(session: TableEditSession<T>) {
    return this.table.bodyCellElementAt(session.position.row, session.position.column);
  }

  /**
   * The body cell an event came from, as a position — `null` when it started outside the grid body.
   * The rendered cells are rows major, so their index carries both coordinates; this is the same
   * arithmetic keyboard navigation does, and it exists because `closest()` is banned here.
   */
  private cellFrom(event: Event) {
    const cells = this.table.bodyCellElements();
    const path = event.composedPath();
    const index = cells.findIndex((candidate) => path.includes(candidate));

    if (index === -1) return null;

    const columns = untracked(() => this.table.visibleColumns()).length;

    if (!columns) return null;

    return {
      row: this.table.renderedRowOffset() + Math.floor(index / columns),
      column: index % columns,
    };
  }
}

// The feature reads cell values through the columns' `value` accessors, which the row-type-agnostic
// feature seam deliberately hides — so it injects the table itself, as the CSV export does. Placed
// anywhere else the directive could only ever silently do nothing, so name the mistake instead.
const injectHostTable = <T>() => {
  const table = inject(TableComponent, { optional: true }) as TableComponent<T> | null;

  if (!table) {
    throw new RuntimeError(
      TABLE_ERROR_CODES.FEATURE_OUTSIDE_TABLE,
      `[etTableInlineEdit] must be used on an <et-table>.`,
    );
  }

  return table;
};
