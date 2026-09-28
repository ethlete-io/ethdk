import {
  afterEveryRender,
  afterNextRender,
  computed,
  Directive,
  DOCUMENT,
  inject,
  Injector,
  input,
  signal,
  untracked,
} from '@angular/core';
import { getFocusableElements, injectRenderer } from '@ethlete/core';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './headless/table-features';

/** Options for {@link TableKeyboardNavDirective}. */
export type TableKeyboardNavConfig = TableFeatureConfig;

/**
 * A focused cell: absolute row index in `rows()`, plus the column index in the row as rendered - the
 * leading utility columns (selection, expander) first, then the visible data columns, then the trailing
 * utility columns.
 */
type CellPosition = { row: number; column: number };

const UTILITY_CONTROL_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]';

const ERROR_MARK_SELECTOR = '.et-table-cell-error-icon[tabindex]';

const findInCell = (cell: HTMLElement, selector: string) =>
  // eslint-disable-next-line ethlete/no-dom-query -- the control lives in a feature component the table stamps through ngComponentOutlet, out of reach of a view query
  cell.querySelector<HTMLElement>(selector);

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/**
 * Opt-in arrow-key navigation over an `et-table`'s cells, following the
 * [ARIA grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/): the body becomes a **single tab
 * stop**, and the arrows move focus from cell to cell inside it - the selection and expander cells
 * included, whose control takes the focus itself. While it is enabled the table carries
 * `role="grid"` / `role="gridcell"`; without it, `role="table"` / `role="cell"`.
 *
 * It is opt-in because it changes what Tab does: a read-only display table is usually better off
 * letting Tab skip straight past it.
 *
 * | Key                          | Moves to                                  |
 * | ---------------------------- | ----------------------------------------- |
 * | `←` `→` `↑` `↓`              | the neighbouring cell                     |
 * | `Home` / `End`               | first / last cell of the row              |
 * | `Ctrl+Home` / `Ctrl+End`     | first / last cell of the grid             |
 * | `PageUp` / `PageDown`        | one viewport of rows up / down            |
 * | `Enter`                      | into the cell's own control, if it has one |
 * | `Escape`                     | back out to the cell                      |
 *
 * Composes with [virtual scrolling](/components/table#virtualization): a target row that isn't
 * rendered is scrolled into the window first and focused once it exists.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTableKeyboardNav />
 */
@Directive({
  selector: '[etTableKeyboardNav]',
  exportAs: 'etTableKeyboardNav',
  host: {
    '(keydown)': 'handleKeydown($event)',
    '(focusin)': 'handleFocusIn($event)',
  },
})
export class TableKeyboardNavDirective {
  private table = injectTableFeatureHost('etTableKeyboardNav');
  private renderer = injectRenderer();
  private injector = inject(Injector);
  private document = inject(DOCUMENT);

  /** See {@link TableKeyboardNavConfig}. */
  public config = input({} as TableKeyboardNavConfig, {
    alias: 'etTableKeyboardNav',
    transform: tableFeatureConfig<TableKeyboardNavConfig>,
  });

  // The one cell currently carrying `tabindex="0"`. Held rather than looked up, so moving the tab stop
  // is two attribute writes and no DOM query.
  private tabStop: HTMLElement | null = null;

  private controlsDemoted = false;

  private enabled = computed(() => this.config().enabled ?? true);

  // The roving target. It exists before anything is focused so that tabbing into the table lands
  // somewhere sensible - the first cell - rather than nowhere.
  private active = signal<CellPosition>({ row: 0, column: 0 });

  /**
   * The cell the grid's tab stop currently sits on: absolute row index and column index, where the
   * column index counts the utility columns - with selection on, column `0` is the checkbox.
   */
  public activeCell = this.active.asReadonly();

  constructor() {
    this.table.registerCellNavigation({ enabled: this.enabled });

    // The table renders every cell at `tabindex="-1"`; without this there would be no `0` anywhere and
    // Tab could never get in. It also repairs the tab stop after a render replaced the cell it was on -
    // which is every scroll of a virtualized table, and every sort, filter or page change of any table.
    afterEveryRender({
      write: () => {
        if (!this.enabled()) {
          this.restoreControls();

          return;
        }

        this.demoteUtilityControls();

        // A render can destroy the cell the tab stop was on (any scroll of a virtualized table, any
        // sort, filter or page change of any table). `isConnected` is how that is noticed.
        if (this.tabStop?.isConnected) return;

        const { row, column } = untracked(this.active);

        // The roving row may have scrolled out of a window's range. Anchoring on the first rendered
        // cell keeps the body reachable; the arrows carry on from wherever the user then is.
        const cell = this.table.gridCellElementAt(row, column);
        const target = cell ? this.focusTargetOf(cell, column) : this.firstRenderedTarget();

        this.applyRovingTabIndex(target);
      },
    });
  }

  /** Move the roving target to a cell and focus it, scrolling it into view first when it isn't rendered. */
  public focusCell(position: CellPosition) {
    const row = clamp(position.row, Math.max(0, this.table.rows().length - 1));
    const column = clamp(position.column, Math.max(0, this.table.gridColumnCount() - 1));

    this.active.set({ row, column });

    const cell = this.table.gridCellElementAt(row, column);

    if (cell) {
      this.focusTarget(this.focusTargetOf(cell, column));

      return;
    }

    // Not rendered: a window is holding it back. Ask for it, then take the focus once the render that
    // creates it has run - there is no element to focus before that.
    this.table.scrollRowIntoView(row);
    afterNextRender(
      {
        write: () => {
          const rendered = this.table.gridCellElementAt(row, column);

          if (!rendered) return;

          this.focusTarget(this.focusTargetOf(rendered, column));
        },
      },
      { injector: this.injector },
    );
  }

  // Focus landing on a cell - a click, or Tab arriving from outside - becomes the roving target, so the
  // arrows continue from wherever the user actually is.
  protected handleFocusIn(event: FocusEvent) {
    if (!this.enabled()) return;

    const hit = this.gridCellFromEvent(event);

    if (!hit) return;

    this.active.set(hit.position);
    this.applyRovingTabIndex(this.focusTargetOf(hit.cell, hit.position.column));
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (!this.enabled()) return;

    const hit = this.gridCellFromEvent(event);

    if (!hit) return;

    const target = this.focusTargetOf(hit.cell, hit.position.column);

    // Focus is on something *inside* the cell (a link, an edit control) - the arrows and Home/End are
    // that control's, not ours. Only Escape is still ours, to get back out.
    if (event.target !== target) {
      if (event.key === 'Escape') {
        event.preventDefault();
        target.focus();
      }

      return;
    }

    const next = this.targetOf(event, hit.position);

    if (!next) return;

    // A utility cell's control is already the focus target: Enter is the control's own key.
    if (next === 'drill' && target !== hit.cell) return;

    event.preventDefault();

    if (next === 'drill') {
      if (!this.isUtilityColumn(hit.position.column)) {
        const dataColumn = hit.position.column - this.table.leadColumnsMeta().length;

        if (this.table.editCell(hit.position.row, dataColumn)) return;
        if (this.drillInto(hit.cell)) return;
      }

      this.table.activateRowAt(hit.position.row);

      return;
    }

    this.focusCell(next);
  }

  // Which cell a key asks for, or `null` when the key isn't ours. Split out so the handler stays one
  // decision and this stays a table of moves.
  private targetOf(event: KeyboardEvent, from: CellPosition) {
    const jump = event.ctrlKey || event.metaKey;
    const lastRow = Math.max(0, this.table.rows().length - 1);
    const lastColumn = Math.max(0, this.table.gridColumnCount() - 1);

    const inlineStep =
      event.currentTarget instanceof Element && getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;

    switch (event.key) {
      case 'ArrowRight':
        return { ...from, column: from.column + inlineStep };
      case 'ArrowLeft':
        return { ...from, column: from.column - inlineStep };
      case 'ArrowDown':
        return { ...from, row: from.row + 1 };
      case 'ArrowUp':
        return { ...from, row: from.row - 1 };
      case 'Home':
        return jump ? { row: 0, column: 0 } : { ...from, column: 0 };
      case 'End':
        return jump ? { row: lastRow, column: lastColumn } : { ...from, column: lastColumn };
      case 'PageDown':
        return { ...from, row: from.row + this.table.rowsPerPage() };
      case 'PageUp':
        return { ...from, row: from.row - this.table.rowsPerPage() };
      case 'Enter':
        return 'drill' as const;
      default:
        return null;
    }
  }

  private drillInto(cell: HTMLElement) {
    // The error mark is demoted out of the Tab order while the grid is on, so Enter is its way in.
    const target = getFocusableElements(cell, this.document)[0] ?? findInCell(cell, ERROR_MARK_SELECTOR) ?? undefined;

    target?.focus();

    return target !== undefined;
  }

  // One `tabindex="0"` in the whole body, on the cell the roving target is on; every other cell keeps
  // the `-1` the table rendered. Written here rather than bound in the table's template because the
  // alternative is rebuilding every rendered row's view model on each arrow press.
  private gridCellFromEvent(event: Event) {
    const cells = this.table.gridCellElements();
    const path = event.composedPath();
    const index = cells.findIndex((candidate) => path.includes(candidate));
    const cell = index === -1 ? undefined : cells[index];
    const columns = untracked(() => this.table.gridColumnCount());

    if (!cell || !columns) return null;

    return {
      cell,
      position: {
        row: this.table.renderedRowOffset() + Math.floor(index / columns),
        column: index % columns,
      },
    };
  }

  private isUtilityColumn(column: number) {
    const leads = this.table.leadColumnsMeta().length;

    return column < leads || column >= leads + this.table.visibleColumnsMeta().length;
  }

  // A utility cell's control takes the focus itself, so Space and Enter reach it without a drill step. A
  // row that cannot be selected or expanded renders no control, and then the cell is the target.
  private focusTargetOf(cell: HTMLElement, column: number) {
    if (!this.isUtilityColumn(column)) return cell;

    return findInCell(cell, UTILITY_CONTROL_SELECTOR) ?? cell;
  }

  private firstRenderedTarget() {
    const cell = this.table.gridCellElements()[0];

    return cell ? this.focusTargetOf(cell, 0) : null;
  }

  private focusTarget(target: HTMLElement) {
    this.applyRovingTabIndex(target);
    target.focus();
  }

  private demoteUtilityControls() {
    this.controlsDemoted = true;

    for (const control of this.utilityControls()) {
      if (control !== this.tabStop && control.getAttribute('tabindex') !== '-1') {
        this.renderer.setAttribute(control, 'tabindex', '-1');
      }
    }
  }

  private restoreControls() {
    if (!this.controlsDemoted) return;

    this.controlsDemoted = false;
    this.tabStop = null;

    for (const control of this.utilityControls()) {
      this.renderer.setAttribute(control, 'tabindex', '0');
    }
  }

  private utilityControls() {
    const columns = this.table.gridColumnCount();

    if (columns === this.table.visibleColumnsMeta().length) return [];

    return this.table
      .gridCellElements()
      .filter((_, index) => this.isUtilityColumn(index % columns))
      .map((cell) => findInCell(cell, UTILITY_CONTROL_SELECTOR))
      .filter((control) => control !== null);
  }

  private applyRovingTabIndex(cell: HTMLElement | null) {
    if (this.tabStop === cell) return;

    if (this.tabStop?.isConnected) this.renderer.setAttribute(this.tabStop, 'tabindex', '-1');

    this.tabStop = cell;

    if (cell) this.renderer.setAttribute(cell, 'tabindex', '0');
  }
}
