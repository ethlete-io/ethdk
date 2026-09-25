import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormField } from '@angular/forms/signals';
import { provideRouter, Router } from '@angular/router';
import {
  TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
  TABLE_IMPORTS,
  TABLE_INLINE_EDIT_IMPORTS,
  TABLE_KEYBOARD_NAV_IMPORTS,
  TABLE_ROW_EXPANSION_IMPORTS,
  TABLE_ROW_ROUTER_LINK_IMPORTS,
  TABLE_SELECTION_IMPORTS,
  TableCellEditCommit,
  TableCellEditDirective,
  TableCellErrorMarkComponent,
  TableCellErrorTooltipDirective,
  TableCellStateValue,
  TableColumns,
  TableExpanderCellComponent,
  TableInlineEditDirective,
  TableInlineEditStylesComponent,
  TableKeyboardNavDirective,
  TableRowDetailComponent,
  TableRowExpansionDirective,
  TableRowRouterLinkDirective,
  TableSelectAllCellComponent,
  TableSelectCellComponent,
  TableSelectionDirective,
} from '../index';
import { useScenario } from './harness';

type Task = { id: number; title: string; owner: string; locked: boolean };

const TASKS: Task[] = [
  { id: 1, title: 'Write report', owner: 'Team A', locked: false },
  { id: 2, title: 'Review budget', owner: 'Team B', locked: true },
  { id: 3, title: 'Plan launch', owner: 'Team A', locked: false },
];

const COLUMNS = {
  title: { header: 'Title', value: (task) => task.title, editable: true },
  owner: { header: 'Owner', value: (task) => task.owner },
} satisfies TableColumns<Task>;

const taskId = (task: Task) => task.id;

const query = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];

const bodyRows = (host: HTMLElement) => queryAll(host, '.et-table-row');

const cellsOf = (row: HTMLElement) => queryAll(row, '.et-table-cell[data-col-key]');

const checkboxIn = (root: ParentNode) => query(root, 'et-checkbox');

@Component({
  selector: 'et-scenario-task-board',
  imports: [TABLE_IMPORTS, TABLE_SELECTION_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS],
  template: `
    <et-table
      [data]="tasks()"
      [columns]="columns"
      [rowKey]="taskId"
      [expandedRowTemplate]="detail"
      [etTableSelection]="{ selection: selected, selectableRow: unlocked }"
      [etTableRowExpansion]="{ expanded: expanded, expandableRow: unlocked }"
    >
      <ng-template #detail let-task
        ><p class="task-detail">Owned by {{ task.owner }}</p></ng-template
      >
    </et-table>
  `,
})
class TaskBoardComponent {
  tasks = signal<Task[]>(TASKS);
  columns = COLUMNS;
  taskId = taskId;
  selected = signal<Set<unknown>>(new Set());
  expanded = signal<Set<unknown>>(new Set());
  unlocked = (task: Task) => !task.locked;
  selection = viewChild.required(TableSelectionDirective<Task>);
  expansion = viewChild.required(TableRowExpansionDirective<Task>);
}

@Component({
  selector: 'et-scenario-task-editor',
  imports: [
    TABLE_IMPORTS,
    TABLE_INLINE_EDIT_IMPORTS,
    TABLE_KEYBOARD_NAV_IMPORTS,
    TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
    FormField,
  ],
  template: `
    <et-table
      [data]="tasks()"
      [columns]="columns"
      [rowKey]="taskId"
      [cellState]="cellState"
      [etTableInlineEdit]="{ editableCell: canEdit }"
      (cellCommit)="save($event)"
      (cellCancel)="cancels.set(cancels() + 1)"
      etTableKeyboardNav
      etTableCellErrorTooltip
    >
      <ng-template [etTableCellEdit]="columns.title" let-field="field">
        <input [formField]="field" class="title-editor" aria-label="Title" />
      </ng-template>
    </et-table>
  `,
})
class TaskEditorComponent {
  tasks = signal<Task[]>(TASKS);
  columns = COLUMNS;
  taskId = taskId;
  failures = signal<Record<number, string>>({});
  cancels = signal(0);
  commits: TableCellEditCommit<Task>[] = [];
  canEdit = (task: Task) => !task.locked;
  cellState = (task: Task, key: string): TableCellStateValue | null => {
    const message = this.failures()[task.id];

    return key === 'title' && message ? { state: 'error', message } : null;
  };
  edit = viewChild.required(TableInlineEditDirective<Task>);
  nav = viewChild.required(TableKeyboardNavDirective);
  editTemplate = viewChild.required(TableCellEditDirective);
  errorTooltip = viewChild.required(TableCellErrorTooltipDirective);

  save(commit: TableCellEditCommit<Task>) {
    this.commits.push(commit);
    this.tasks.update((tasks) =>
      tasks.map((task) => (task === commit.row ? { ...task, title: String(commit.next) } : task)),
    );
  }
}

@Component({ selector: 'et-scenario-task-page', template: '' })
class TaskPageComponent {}

@Component({
  selector: 'et-scenario-task-links',
  imports: [TABLE_IMPORTS, TABLE_ROW_ROUTER_LINK_IMPORTS],
  template: `<et-table [data]="tasks" [columns]="columns" [rowLink]="taskLink" etTableRowRouterLink />`,
})
class TaskLinksComponent {
  tasks = TASKS;
  columns = COLUMNS;
  taskLink = (task: Task) => ['/tasks', task.id];
  routing = viewChild.required(TableRowRouterLinkDirective);
}

describe('table feature scenarios: rows', () => {
  const scenario = useScenario({
    providers: [provideRouter([{ path: 'tasks/:id', component: TaskPageComponent }])],
  });

  it('selects rows one by one and all at once, skipping rows that may not be selected', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskBoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    s.flush();

    const selectAll = checkboxIn(query(host, 'et-table-select-all-cell'));
    const rowCells = queryAll(host, 'et-table-select-cell');

    expect(fixture.debugElement.queryAll(By.directive(TableSelectAllCellComponent))).toHaveLength(1);
    expect(fixture.debugElement.queryAll(By.directive(TableSelectCellComponent))).toHaveLength(3);
    expect(rowCells[1]?.querySelector('et-checkbox')).toBeNull();

    checkboxIn(query(bodyRows(host)[0] as HTMLElement, 'et-table-select-cell')).click();
    s.flush();

    expect([...board.selected()]).toEqual(['1']);
    expect(board.selection().isPartiallySelected()).toBe(true);
    expect(bodyRows(host)[0]?.classList).toContain('et-table-row--selected');

    selectAll.click();
    s.flush();

    expect([...board.selected()].sort()).toEqual(['1', '3']);
    expect(board.selection().isAllSelected()).toBe(true);
    expect(
      board
        .selection()
        .selectedRows()
        .map((task) => task.title),
    ).toEqual(['Write report', 'Plan launch']);

    selectAll.click();
    s.flush();
    expect(board.selected().size).toBe(0);
  });

  it('keeps the selection by row key when the data is replaced', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskBoardComponent);
    const board = fixture.componentInstance;

    s.flush();
    board.selected.set(new Set(['3']));
    board.tasks.set(TASKS.map((task) => ({ ...task })).reverse());
    s.flush();

    expect(
      board
        .selection()
        .selectedRows()
        .map((task) => task.id),
    ).toEqual([3]);
    expect(bodyRows(fixture.nativeElement as HTMLElement)[0]?.classList).toContain('et-table-row--selected');
  });

  it.fails('selects a row from a numeric key the consumer writes into the selection signal', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskBoardComponent);

    s.flush();
    fixture.componentInstance.selected.set(new Set([3]));
    s.flush();

    expect(
      fixture.componentInstance
        .selection()
        .selectedRows()
        .map((task) => task.id),
    ).toEqual([3]);
  });

  it('expands a row into a detail row and collapses it again', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskBoardComponent);
    const host = fixture.nativeElement as HTMLElement;
    const board = fixture.componentInstance;

    s.flush();

    const expanders = queryAll(host, 'et-table-expander-cell');

    expect(fixture.debugElement.queryAll(By.directive(TableExpanderCellComponent))).toHaveLength(3);
    expect(expanders[1]?.querySelector('button')).toBeNull();

    const toggle = query<HTMLButtonElement>(expanders[0] as HTMLElement, 'button');

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Expand row');

    toggle.click();
    s.flush();

    expect([...board.expanded()]).toEqual(['1']);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Collapse row');
    expect(query(host, 'et-table-row-detail .task-detail').textContent).toBe('Owned by Team A');
    expect(fixture.debugElement.queryAll(By.directive(TableRowDetailComponent))).toHaveLength(1);

    toggle.click();
    s.flush();

    expect(board.expanded().size).toBe(0);
    expect(host.querySelector('et-table-row-detail')).toBeNull();
  });

  it('opens a row from the consumer signal and ignores a key for a row that may not expand', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskBoardComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();
    fixture.componentInstance.expanded.set(new Set(['2', '3']));
    s.flush();

    expect(queryAll(host, 'et-table-row-detail .task-detail').map((detail) => detail.textContent)).toEqual([
      'Owned by Team A',
    ]);
    expect(fixture.componentInstance.expansion().isExpanded(TASKS[2] as Task)).toBe(true);
  });

  it('edits a cell by double click, commits with Enter and cancels with Escape', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskEditorComponent);
    const host = fixture.nativeElement as HTMLElement;
    const editor = fixture.componentInstance;

    s.flush();

    expect(editor.editTemplate()).toBeInstanceOf(TableCellEditDirective);
    expect(document.querySelectorAll('.et-style-manager > et-table-inline-edit-styles')).toHaveLength(1);
    expect(TableInlineEditStylesComponent).toBeDefined();

    const titleCell = () => cellsOf(bodyRows(host)[0] as HTMLElement)[0] as HTMLElement;

    titleCell().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    s.flush();

    const input = query<HTMLInputElement>(host, '.title-editor');

    expect(input.value).toBe('Write report');
    expect(editor.edit().editing()).toEqual({ row: TASKS[0], column: 'title' });

    input.value = 'Write final report';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    s.keydown('Enter', input);
    s.flush();

    expect(editor.commits).toEqual([
      { row: TASKS[0], column: 'title', previous: 'Write report', next: 'Write final report' },
    ]);
    expect(host.querySelector('.title-editor')).toBeNull();
    expect(titleCell().textContent?.trim()).toBe('Write final report');

    titleCell().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    s.flush();
    s.keydown('Escape', query(host, '.title-editor'));
    s.flush();

    expect(editor.cancels()).toBe(1);
    expect(editor.commits).toHaveLength(1);
    expect(host.querySelector('.title-editor')).toBeNull();
  });

  it('keeps a locked row and a column without an editor read-only', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskEditorComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    cellsOf(bodyRows(host)[1] as HTMLElement)[0]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    cellsOf(bodyRows(host)[0] as HTMLElement)[1]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    s.flush();

    expect(host.querySelector('.title-editor')).toBeNull();
    expect(fixture.componentInstance.edit().editCell(1, 0)).toBe(false);
  });

  it('moves the grid tab stop with the arrow keys and opens the focused cell with Enter', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskEditorComponent);
    const host = fixture.nativeElement as HTMLElement;
    const nav = fixture.componentInstance.nav();

    s.flush();

    const first = cellsOf(bodyRows(host)[0] as HTMLElement)[0] as HTMLElement;

    expect(first.getAttribute('tabindex')).toBe('0');

    first.focus();
    s.keydown('ArrowRight', first);
    s.flush();
    expect(nav.activeCell()).toEqual({ row: 0, column: 1 });
    expect(document.activeElement).toBe(cellsOf(bodyRows(host)[0] as HTMLElement)[1]);
    expect(first.getAttribute('tabindex')).toBe('-1');

    s.keydown('ArrowDown', document.activeElement as HTMLElement);
    s.keydown('Home', document.activeElement as HTMLElement);
    s.flush();
    expect(nav.activeCell()).toEqual({ row: 1, column: 0 });

    s.keydown('ArrowDown', document.activeElement as HTMLElement);
    s.flush();
    s.keydown('Enter', document.activeElement as HTMLElement);
    s.flush();

    expect(query<HTMLInputElement>(host, '.title-editor').value).toBe('Plan launch');
  });

  it('shows a failed cell message on a focusable mark', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskEditorComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();
    expect(host.querySelector('et-table-cell-error-mark')).toBeNull();

    fixture.componentInstance.failures.set({ 3: 'Title already taken' });
    s.flush();

    const marks = fixture.debugElement.queryAll(By.directive(TableCellErrorMarkComponent));

    expect(marks).toHaveLength(1);
    expect(fixture.componentInstance.errorTooltip()).toBeInstanceOf(TableCellErrorTooltipDirective);

    const icon = query(marks[0]?.nativeElement as HTMLElement, '.et-table-cell-error-icon');

    expect(icon.getAttribute('aria-label')).toBe('Title already taken');
    expect(icon.getAttribute('role')).toBe('img');
    expect(icon.hasAttribute('aria-hidden')).toBe(false);
    expect(icon.getAttribute('tabindex')).toBe('0');
    expect(icon.hasAttribute('title')).toBe(false);

    icon.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    s.flush();
    expect(document.querySelector('et-tooltip')?.textContent?.trim()).toBe('Title already taken');

    icon.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    s.flush();
    expect(document.querySelector('et-tooltip')).toBeNull();
  });

  it('links rows through the router and leaves modified clicks to the browser', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TaskLinksComponent);
    const host = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);

    s.flush();

    const links = queryAll(host, '.et-table-row-link');

    expect(fixture.componentInstance.routing()).toBeInstanceOf(TableRowRouterLinkDirective);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/tasks/1', '/tasks/2', '/tasks/3']);

    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });

    links[1]?.dispatchEvent(modified);
    await s.settle();
    expect(modified.defaultPrevented).toBe(false);
    expect(router.url).toBe('/');

    const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });

    links[1]?.dispatchEvent(plain);
    await s.settle();
    expect(plain.defaultPrevented).toBe(true);
    expect(router.url).toBe('/tasks/2');
  });
});
