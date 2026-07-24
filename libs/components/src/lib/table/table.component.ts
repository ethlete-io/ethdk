import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  isDevMode,
  linkedSignal,
  model,
  output,
  signal,
  TemplateRef,
  ViewEncapsulation,
  viewChildren,
} from '@angular/core';
import {
  DragHandleDirective,
  DragMoveEvent,
  DragStartEvent,
  forceReflow,
  injectPrefersReducedMotion,
  injectRenderer,
  RuntimeError,
  signalHostElementDimensions,
} from '@ethlete/core';
import { CheckboxComponent } from '../forms/checkbox';
import { createVirtualWindow } from '../internals/virtual-window';
import {
  MenuCheckboxGroupComponent,
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuDirective,
  MenuSearchDirective,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from '../menu';
import { filterRows } from './table-filter';
import { sortRows } from './table-sort';
import { TableFooterDirective } from './table-footer.directive';
import { TABLE_ERROR_CODES } from './table-errors';
import {
  AnyTableColumn,
  TableColumnState,
  TableExpandedRowContext,
  TableFilter,
  TableFilterOption,
  TableFilterOptionsProvider,
  TableHeaderGroup,
  TableSort,
  TableSortDirection,
  TableState,
} from './table.types';

/** Horizontal sticky offsets (px) for pinned columns, keyed by column key. */
type StickyOffsets = { start: Record<string, number>; end: Record<string, number> };

const DEFAULT_TRACK = 'minmax(0, 1fr)';

/**
 * The default table. Renders typed rows and cells from a {@link tableColumns}
 * definition on a CSS grid with a sticky header and an empty state. Light by
 * default — sort, filter, expansion, reordering, virtualization and state
 * persistence arrive as separate opt-in features.
 *
 * @example
 * const columns = tableColumns<User>([
 *   { key: 'name', header: 'Name', value: (u) => u.name },
 *   { key: 'email', header: 'Email', value: (u) => u.email },
 * ]);
 *
 * <et-table [data]="users()" [columns]="columns" />
 */
@Component({
  selector: 'et-table',
  templateUrl: './table.component.html',
  styleUrl: './table.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgTemplateOutlet,
    DragHandleDirective,
    CheckboxComponent,
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuSearchDirective,
    MenuCheckboxGroupComponent,
    MenuCheckboxItemComponent,
  ],
  host: {
    class: 'et-table-host',
    '[attr.data-appearance]': 'appearance()',
    '[attr.data-density]': 'density()',
    '[style.--_et-table-group-h]': 'groupRowHeight() + "px"',
  },
})
export class TableComponent<T> {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);
  private renderer = injectRenderer();
  private prefersReducedMotion = injectPrefersReducedMotion();

  /** The rows to render. */
  public data = input<readonly T[]>([]);

  /** The typed column definitions (see {@link tableColumns}). */
  public columns = input<AnyTableColumn<T>[]>([]);

  /**
   * Stable per-row identity for change tracking (and, later, row-keyed state such
   * as selection/expansion). Defaults to row reference identity.
   */
  public rowKey = input<(row: T) => string | number>();

  /** Text shown when there are no rows and no `[etTableEmpty]` content is projected. */
  public emptyLabel = input('No data');

  /**
   * The table's visual frame. `'enclosed'` (default) is a bordered, rounded surface panel with a
   * tinted header band; `'divided'` is borderless with row dividers; `'zebra'` stripes rows; `'grid'`
   * draws full cell borders; `'bare'` has no chrome. @default 'enclosed'
   */
  public appearance = input<'enclosed' | 'divided' | 'zebra' | 'grid' | 'bare'>('enclosed');

  /** Row density (cell padding): `'sm'` tight, `'md'` default, `'lg'` roomy. @default 'md' */
  public density = input<'sm' | 'md' | 'lg'>('md');

  /**
   * The active sort, as an ordered list of `{ key, direction }`. Two-way bindable.
   * In `'client'` mode the table sorts rows by it; in `'server'` mode it's yours to
   * feed into query args.
   */
  public sort = model<TableSort[]>([]);

  /** Allow more than one column to be sorted at once. @default false */
  public multiSort = input(false);

  /**
   * `'client'` sorts the rows in the browser via {@link sortRows}; `'server'`
   * leaves rows untouched so the backend can sort.
   * @default 'client'
   */
  public sortMode = input<'client' | 'server'>('client');

  /**
   * The active filters, as `{ key, values }` per filtered column. Two-way bindable.
   * In `'client'` mode the table filters rows by it; in `'server'` mode it's yours
   * to feed into query args.
   */
  public filters = model<TableFilter[]>([]);

  /**
   * `'client'` filters the rows in the browser via {@link filterRows}; `'server'`
   * leaves rows untouched so the backend can filter.
   * @default 'client'
   */
  public filterMode = input<'client' | 'server'>('client');

  /**
   * The detail template rendered as a full-width row when a row is expanded. Setting
   * it enables row expansion (an expander column is prepended). Context: `{ $implicit: row }`.
   * Nest another `<et-table>` here for sub-tables.
   */
  public expandedRowTemplate = input<TemplateRef<TableExpandedRowContext<T>>>();

  /** Gate which rows can expand. Defaults to all rows (when a detail template is set). */
  public expandableRow = input<(row: T) => boolean>();

  /** The set of expanded row keys (by `rowKey`, else row reference). Two-way bindable. */
  public expandedKeys = model<Set<unknown>>(new Set());

  /** Show a leading checkbox column for multi-row selection. @default false */
  public selectable = input(false);

  /** The set of selected row keys (by `rowKey`, else row reference). Two-way bindable. */
  public selection = model<Set<unknown>>(new Set());

  /** Gate which rows can be selected. Defaults to all rows (when `selectable`). */
  public selectableRow = input<(row: T) => boolean>();

  /**
   * Make whole rows respond to clicks: adds a hover/pointer affordance and emits {@link rowClick}
   * (clicks landing on interactive cell content are ignored — see `rowClick`). @default false
   */
  public rowInteractive = input(false);

  /** Allow reordering columns by dragging their headers. @default false */
  public reorderable = input(false);

  /**
   * Render only the rows near the viewport instead of all of them. The table is its own scroll
   * container, so give it a bounded height (e.g. `style="block-size: 24rem"`) for the window to
   * track. @default false
   */
  public virtualScroll = input(false);

  /** Row height assumed before a real row is measured — tune it to your row size for a stable first paint. @default 48 */
  public estimateRowHeight = input(48);

  /** Rows kept rendered just outside the viewport on each side, to hide scroll flicker. @default 6 */
  public overscan = input(6);

  /**
   * Emitted when an interactive row (see {@link rowInteractive}) is clicked, with the row as payload.
   * Clicks originating from interactive descendants — buttons, links, inputs, selects, a menu trigger,
   * and the selection/expander cells — are ignored, so in-row controls keep working. The table bakes
   * in no navigation; call `router.navigate` (etc.) yourself. For crawlable per-row links, render a
   * real `<a>` in a cell instead.
   */
  public rowClick = output<T>();

  // Whether the consumer projected an `[etTableFooter]` slot, so its chrome (border, sticky bar)
  // renders only when there's actually footer content.
  protected footerSlot = contentChild(TableFooterDirective);

  private headerCells = viewChildren<ElementRef<HTMLElement>>('headerCell');

  // Every rendered body cell (tagged with `data-col-key`); the first drives virtual-window
  // measurement, and they're grouped by column to animate a column shift on reorder drop.
  private bodyCells = viewChildren<ElementRef<HTMLElement>>('bodyCell');

  // Group-header cells; the first is measured to offset the sub-header row's sticky position.
  private groupCells = viewChildren<ElementRef<HTMLElement>>('groupCell');

  // The leading utility-column headers (select checkbox, expander), measured so pinned data
  // columns — and the expander itself — clear them.
  protected selectHeaderCell = viewChildren<ElementRef<HTMLElement>>('selectHeaderCell');
  protected expanderHeaderCell = viewChildren<ElementRef<HTMLElement>>('expanderHeaderCell');

  // Inline-start offset for the auto-pinned expander column (it sits after the select column).
  protected expanderStickyOffset = signal(0);
  // Recompute sticky-column offsets when the host resizes (column widths change).
  private hostDimensions = signalHostElementDimensions();

  // Rendered height of the spanning group-header row (0 when there are no groups), so the
  // sub-header row can stick just below it.
  protected groupRowHeight = signal(0);

  // Measured inline offsets for pinned columns (see the effect that fills them).
  private stickyOffsets = signal<StickyOffsets>({ start: {}, end: {} });

  /** Whether row expansion is active (a detail template was provided). */
  public expandable = computed(() => this.expandedRowTemplate() !== undefined);

  // The column key currently being drag-reordered.
  protected draggingColumn = signal<string | null>(null);

  // Live pointer position of the reorder drag — drives the floating ghost header.
  protected dragPointer = signal<{ x: number; y: number } | null>(null);

  // Where a drop would land: the column it would insert next to, and which side.
  private dragTarget = signal<{ key: string; before: boolean } | null>(null);

  // Viewport x of the drop indicator line, and the header/body span it covers.
  protected dragIndicatorX = signal<number | null>(null);
  protected dragBounds = signal<{ top: number; height: number } | null>(null);

  // Column order + visibility overrides reset when the `columns` input changes, but
  // a manual restoreState() persists until then (linkedSignal semantics).
  private columnOrder = linkedSignal(() => this.columns().map((column) => column.key));
  private hiddenColumns = linkedSignal(
    () =>
      new Set(
        this.columns()
          .filter((column) => column.hidden)
          .map((column) => column.key),
      ),
  );

  private columnsByKey = computed(() => {
    const map = new Map<string, AnyTableColumn<T>>();

    for (const column of this.columns()) {
      if (isDevMode() && map.has(column.key)) {
        throw new RuntimeError(
          TABLE_ERROR_CODES.DUPLICATE_COLUMN_KEY,
          `[etTable] Duplicate column key "${column.key}". Column keys must be unique.`,
        );
      }

      map.set(column.key, column);
    }

    return map;
  });

  /** The header text of the column being dragged, shown in the floating ghost. */
  protected draggedColumnHeader = computed(() => {
    const key = this.draggingColumn();

    return key ? (this.columnsByKey().get(key)?.header ?? key) : null;
  });

  private orderedColumns = computed(() => {
    const map = this.columnsByKey();

    return this.columnOrder()
      .map((key) => map.get(key))
      .filter((column): column is AnyTableColumn<T> => column !== undefined);
  });

  /** Columns currently displayed, in order. */
  public visibleColumns = computed(() =>
    this.orderedColumns().filter((column) => !this.hiddenColumns().has(column.key)),
  );

  /** Whether any visible column declares a `group` (drives the spanning group-header row). */
  public hasGroups = computed(() => this.visibleColumns().some((column) => !!column.group));

  /**
   * The spanning group-header row as maximal runs of adjacent visible columns sharing a `group`.
   * Ungrouped columns each form their own single-track run (`label: null`) so the row still covers
   * every track — dragging a column out of a group simply splits the run.
   */
  public headerGroups = computed<TableHeaderGroup[]>(() => {
    const runs: TableHeaderGroup[] = [];

    for (const column of this.visibleColumns()) {
      const label = column.group ?? null;
      const last = runs[runs.length - 1];

      if (last && label !== null && last.label === label) {
        last.span += 1;
      } else {
        runs.push({ key: column.key, label, span: 1 });
      }
    }

    return runs;
  });

  /** Whether any visible column is pinned to the inline-start edge (also pins the expander column). */
  public hasStickyStart = computed(() => this.visibleColumns().some((column) => column.sticky === 'start'));

  /** Whether any visible column is pinned (start or end) — the grid then sizes to its tracks so pinning works. */
  public hasStickyColumns = computed(() => this.visibleColumns().some((column) => !!column.sticky));

  /** Whether any visible column defines a footer cell (drives the sticky footer row). */
  public hasFooter = computed(() => this.visibleColumns().some((column) => !!column.footerCell));

  /** The `grid-template-columns` value for the visible columns (plus a leading expander track when expandable). */
  public templateColumns = computed(() => {
    const tracks = this.visibleColumns().map((column) => column.width ?? DEFAULT_TRACK);

    // Leading utility columns, in render order: expander first, then the select checkbox is
    // prepended before it so the checkbox is leftmost.
    if (this.expandable()) tracks.unshift('var(--et-table-expander-width, 2.75rem)');
    if (this.selectable()) tracks.unshift('var(--et-table-select-width, 2.75rem)');

    return tracks.join(' ');
  });

  /** The serializable, versioned table state — column order, visibility, sort, filters and expanded rows. */
  public state = computed<TableState>(() => {
    const sort = this.sort();
    const multiSorted = sort.length > 1;
    const sortByKey = new Map(sort.map((entry, index) => [entry.key, { direction: entry.direction, index }]));
    const filtersByKey = new Map(this.filters().map((entry) => [entry.key, entry.values]));

    const columns = this.orderedColumns().map((column) => {
      const entry: TableColumnState = { key: column.key, hidden: this.hiddenColumns().has(column.key) };
      const columnSort = sortByKey.get(column.key);
      const columnFilter = filtersByKey.get(column.key);

      if (columnSort) {
        entry.sort = columnSort.direction;

        if (multiSorted) entry.sortPriority = columnSort.index;
      }

      if (columnFilter?.length) entry.filterValues = columnFilter;

      return entry;
    });

    const rowKey = this.rowKey();
    const expandedKeys = this.expandedKeys();

    // Expanded rows only serialize when a rowKey gives them a stable string identity.
    const expanded = rowKey && expandedKeys.size ? [...expandedKeys].map(String) : undefined;

    return expanded ? { v: 1, columns, expanded } : { v: 1, columns };
  });

  // Per-column filter-menu search text (client-side for static options; drives a provider's setQuery).
  private filterSearchQueries = signal<Record<string, string>>({});

  /**
   * The rendered rows — client-filtered then client-sorted for whichever of
   * `filterMode`/`sortMode` is `'client'`.
   */
  public rows = computed(() => {
    const columns = this.columns();
    let result: readonly T[] = this.data();

    if (this.filterMode() !== 'server') {
      result = filterRows({ rows: result, filters: this.filters(), columns });
    }

    if (this.sortMode() !== 'server') {
      result = sortRows({ rows: result, sort: this.sort(), columns });
    }

    return [...result];
  });

  /** The currently-rendered rows that can be selected (respects `selectableRow`), for select-all. */
  private selectableData = computed(() => {
    const gate = this.selectableRow();

    return gate ? this.rows().filter((row) => gate(row)) : this.rows();
  });

  /** True when every selectable row in the current data set is selected. */
  public isAllSelected = computed(() => {
    const rows = this.selectableData();
    const selection = this.selection();

    return rows.length > 0 && rows.every((row) => selection.has(this.rowIdentity(row)));
  });

  /** True when some — but not all — selectable rows are selected (checkbox indeterminate). */
  public isPartiallySelected = computed(() => {
    const rows = this.selectableData();
    const selection = this.selection();
    const selected = rows.filter((row) => selection.has(this.rowIdentity(row))).length;

    return selected > 0 && selected < rows.length;
  });

  /** The selected rows within the current data set (selection keys with no matching row are ignored). */
  public selectedRows = computed(() => {
    const selection = this.selection();

    return this.rows().filter((row) => selection.has(this.rowIdentity(row)));
  });

  /**
   * Windows {@link rows} to the viewport when {@link virtualScroll} is on: `paddingTop()`/
   * `paddingBottom()` stand in for the rows outside {@link renderedRows}, rendered as spacer
   * grid cells. Pass-through (renders everything) while virtual scrolling is off.
   */
  public virtualWindow = createVirtualWindow({
    container: computed(() => (this.virtualScroll() ? this.elementRef.nativeElement : null)),
    itemCount: computed(() => this.rows().length),
    estimateItemHeight: this.estimateRowHeight,
    overscan: this.overscan,
  });

  /** The rows actually rendered — the virtual window's slice of {@link rows}, or all of them. */
  public renderedRows = computed(() => {
    if (!this.virtualScroll()) return this.rows();

    const { start, end } = this.virtualWindow.range();

    return this.rows().slice(start, end);
  });

  /** Absolute index of the first rendered row, so cell contexts keep true row indices while virtualized. */
  public rowIndexOffset = computed(() => (this.virtualScroll() ? this.virtualWindow.range().start : 0));

  constructor() {
    // Feed a real rendered row's height back into the window so its scroll math self-corrects
    // from the estimate. Uniform-height model: any base row stands in for all of them.
    effect(() => {
      if (!this.virtualScroll()) return;

      const cell = this.bodyCells()[0];

      if (cell) this.virtualWindow.measureItem(cell.nativeElement);
    });

    // Track the group-header row's height so the sub-header row sticks right below it.
    effect(() => {
      const cell = this.groupCells()[0];

      this.groupRowHeight.set(cell ? cell.nativeElement.offsetHeight : 0);
    });

    // Measure pinned columns' inline offsets from header-cell widths (re-runs on resize and
    // structural change). Sticky-start columns stack from the left edge (clearing the expander),
    // sticky-end columns stack from the right — pin from the edges, so widths sum cleanly.
    effect(() => {
      this.hostDimensions();

      const columns = this.visibleColumns();
      const cells = this.headerCells();
      const width = (index: number) => cells[index]?.nativeElement.getBoundingClientRect().width ?? 0;

      const start: Record<string, number> = {};
      // Leading utility columns stack from the edge: select checkbox (at 0), then the expander.
      const selectWidth = this.selectHeaderCell()[0]?.nativeElement.getBoundingClientRect().width ?? 0;

      this.expanderStickyOffset.set(selectWidth);

      let left = selectWidth + (this.expanderHeaderCell()[0]?.nativeElement.getBoundingClientRect().width ?? 0);

      for (let index = 0; index < columns.length; index++) {
        const column = columns[index];

        if (column?.sticky === 'start') start[column.key] = left;

        left += width(index);
      }

      const end: Record<string, number> = {};
      let right = 0;

      for (let index = columns.length - 1; index >= 0; index--) {
        const column = columns[index];

        if (column?.sticky === 'end') end[column.key] = right;

        right += width(index);
      }

      this.stickyOffsets.set({ start, end });
    });
  }

  /** Apply a previously captured {@link TableState} — column order, visibility, sort, filters and expanded rows. */
  public restoreState(next: TableState) {
    this.columnOrder.set(next.columns.map((column) => column.key));
    this.hiddenColumns.set(new Set(next.columns.filter((column) => column.hidden).map((column) => column.key)));

    const sort = next.columns
      .filter((column) => column.sort)
      .sort((a, b) => (a.sortPriority ?? 0) - (b.sortPriority ?? 0))
      .map((column) => ({ key: column.key, direction: column.sort as TableSortDirection }));

    this.sort.set(sort);

    const filters = next.columns
      .filter((column) => column.filterValues?.length)
      .map((column) => ({ key: column.key, values: column.filterValues ?? [] }));

    this.filters.set(filters);

    this.expandedKeys.set(new Set(next.expanded ?? []));
  }

  /** The sort direction for a column key, or `null` when it isn't sorted. */
  public sortDirection(key: string): TableSortDirection | null {
    return this.sort().find((entry) => entry.key === key)?.direction ?? null;
  }

  /**
   * Cycle a column's sort: unsorted → ascending → descending → unsorted. In
   * single-sort mode this replaces any other sort; with `multiSort` it toggles
   * this column while keeping the others (appended in click order).
   */
  public toggleSort(key: string) {
    const current = this.sort();
    const direction = this.sortDirection(key);
    const others = this.multiSort() ? current.filter((entry) => entry.key !== key) : [];

    if (direction === null) {
      this.sort.set([...others, { key, direction: 'asc' }]);
    } else if (direction === 'asc') {
      this.sort.set([...others, { key, direction: 'desc' }]);
    } else {
      this.sort.set(others);
    }
  }

  /** The selected filter values for a column key (empty when unfiltered). */
  public filterValuesFor(key: string): unknown[] {
    return this.filters().find((entry) => entry.key === key)?.values ?? [];
  }

  /** Replace a column's selected filter values (drops the entry when empty). */
  public setFilterValues(key: string, values: unknown[]) {
    const others = this.filters().filter((entry) => entry.key !== key);

    this.filters.set(values.length ? [...others, { key, values }] : others);
  }

  /** Whether a column is currently visible. */
  public isColumnVisible(key: string) {
    return !this.hiddenColumns().has(key);
  }

  /** Show or hide a column. */
  public setColumnVisible(key: string, visible: boolean) {
    this.hiddenColumns.update((hidden) => {
      const next = new Set(hidden);

      if (visible) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  /** Toggle a column's visibility. */
  public toggleColumnVisibility(key: string) {
    this.setColumnVisible(key, !this.isColumnVisible(key));
  }

  /** Move a column to a new index within the full column order. */
  public moveColumn(key: string, toIndex: number) {
    this.columnOrder.update((order) => {
      const from = order.indexOf(key);

      if (from === -1) return order;

      const next = [...order];
      next.splice(from, 1);
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, key);

      return next;
    });
  }

  /** Whether a row is currently expanded. */
  public isExpanded(row: T) {
    return this.expandedKeys().has(this.rowIdentity(row));
  }

  /** Toggle a row's expanded state. */
  public toggleExpanded(row: T) {
    const key = this.rowIdentity(row);
    const next = new Set(this.expandedKeys());

    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }

    this.expandedKeys.set(next);
  }

  /** Whether a row is selected. */
  public isSelected(row: T) {
    return this.selection().has(this.rowIdentity(row));
  }

  /** Select or deselect a single row. */
  public setSelected(row: T, selected: boolean) {
    const key = this.rowIdentity(row);
    const next = new Set(this.selection());

    if (selected) {
      next.add(key);
    } else {
      next.delete(key);
    }

    this.selection.set(next);
  }

  /** Select all selectable rows in the current data set, or clear them when all are already selected. */
  public toggleAll() {
    const rows = this.selectableData();

    if (this.isAllSelected()) {
      const next = new Set(this.selection());

      for (const row of rows) next.delete(this.rowIdentity(row));

      this.selection.set(next);
    } else {
      const next = new Set(this.selection());

      for (const row of rows) next.add(this.rowIdentity(row));

      this.selection.set(next);
    }
  }

  protected canExpand(row: T) {
    return this.expandable() && (this.expandableRow()?.(row) ?? true);
  }

  protected canSelect(row: T) {
    return this.selectableRow()?.(row) ?? true;
  }

  /** Emit {@link rowClick} for a row (click or keyboard), unless the activation came from interactive content inside it. */
  protected activateRow(row: T, event: MouseEvent | KeyboardEvent) {
    if (!this.rowInteractive() || this.originatesFromInteractive(event)) return;

    // Enter/Space on a focused row shouldn't also scroll the page.
    if (event instanceof KeyboardEvent) event.preventDefault();

    this.rowClick.emit(row);
  }

  /**
   * Stable identity for row-keyed state (change tracking, expansion, selection): the string form of
   * `rowKey` (so it matches its serialized form regardless of string/number), or the row reference.
   */
  protected rowIdentity(row: T): unknown {
    const rowKey = this.rowKey();

    return rowKey ? String(rowKey(row)) : row;
  }

  /** Begin a reorder drag: lift a floating ghost of the header, leaving the table markup in place. */
  protected startColumnDrag(key: string, event: DragStartEvent) {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();

    this.draggingColumn.set(key);
    this.dragPointer.set({ x: event.clientX, y: event.clientY });
    this.dragTarget.set(null);
    this.dragIndicatorX.set(null);
    this.dragBounds.set({ top: rect.top, height: rect.height });
  }

  /** Track the pointer during a reorder drag: move the ghost and show where the column would drop. */
  protected updateColumnDrag(event: DragMoveEvent) {
    if (!this.draggingColumn()) return;

    this.dragPointer.set({ x: event.clientX, y: event.clientY });
    this.resolveDropTarget(event.clientX);
  }

  /** End a reorder drag: commit the deferred move once, then animate the columns into place. */
  protected endColumnDrag() {
    const dragging = this.draggingColumn();
    const target = this.dragTarget();
    const firstLefts = this.captureColumnLefts();

    if (dragging && target && target.key !== dragging) {
      this.commitColumnReorder({ dragging, overKey: target.key, before: target.before });
    }

    this.draggingColumn.set(null);
    this.dragPointer.set(null);
    this.dragTarget.set(null);
    this.dragIndicatorX.set(null);
    this.dragBounds.set(null);

    if (dragging && !this.prefersReducedMotion()) {
      // The order changed synchronously; FLIP once the reordered grid has rendered.
      afterNextRender(() => this.playReorderFlip(firstLefts), { injector: this.injector });
    }
  }

  protected isFiltered(key: string) {
    return this.filterValuesFor(key).length > 0;
  }

  protected asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const direction = this.sortDirection(key);

    return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
  }

  /** The inline-start offset (px) for a start-pinned column, or `null` when it isn't pinned there. */
  protected stickyStart(key: string): number | null {
    return this.stickyOffsets().start[key] ?? null;
  }

  /** The inline-end offset (px) for an end-pinned column, or `null` when it isn't pinned there. */
  protected stickyEnd(key: string): number | null {
    return this.stickyOffsets().end[key] ?? null;
  }

  /** The async options provider for a column, or `null` when its options are a static list. */
  protected filterProviderOf(column: AnyTableColumn<T>): TableFilterOptionsProvider | null {
    const options = column.filterOptions;

    return options && !Array.isArray(options) ? options : null;
  }

  protected filterSearchQuery(key: string) {
    return this.filterSearchQueries()[key] ?? '';
  }

  protected setFilterSearchQuery(column: AnyTableColumn<T>, query: string) {
    this.filterSearchQueries.update((current) => ({ ...current, [column.key]: query }));
    this.filterProviderOf(column)?.setQuery?.(query);
  }

  /** The options for a column's filter menu — provider-backed, or the static list filtered by the search text. */
  protected filterOptionsFor(column: AnyTableColumn<T>): TableFilterOption[] {
    const provider = this.filterProviderOf(column);

    if (provider) return provider.options();

    const options = (column.filterOptions as TableFilterOption[] | undefined) ?? [];

    if (!column.filterSearch) return options;

    const query = this.filterSearchQuery(column.key).trim().toLowerCase();

    return query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
  }

  protected filterLoading(column: AnyTableColumn<T>) {
    return this.filterProviderOf(column)?.loading?.() ?? false;
  }

  protected filterHasMore(column: AnyTableColumn<T>) {
    return this.filterProviderOf(column)?.hasMore?.() ?? false;
  }

  protected filterLoadMore(column: AnyTableColumn<T>) {
    this.filterProviderOf(column)?.loadMore?.();
  }

  // Walk the event's composed path up to the row element; bail if it passed through anything the
  // user meant to click instead of the row (a control, a menu trigger, or a utility cell). Uses
  // composedPath (not `.closest()`, which the styleguide forbids) so it also works across shadow roots.
  private originatesFromInteractive(event: MouseEvent | KeyboardEvent) {
    for (const target of event.composedPath()) {
      if (target === event.currentTarget) break;
      if (!(target instanceof HTMLElement)) continue;

      const tag = target.tagName;

      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true;
      if (target.hasAttribute('etMenuTrigger') || target.getAttribute('role') === 'button') return true;
      if (target.classList.contains('et-table-select-cell') || target.classList.contains('et-table-expander-cell')) {
        return true;
      }
    }

    return false;
  }

  // Resolve which column the pointer is over and which side, and place the drop indicator at that edge.
  private resolveDropTarget(clientX: number) {
    const dragging = this.draggingColumn();
    const cells = this.headerCells();
    const columns = this.visibleColumns();

    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      const overKey = columns[index]?.key;

      if (!cell || !overKey) continue;

      const rect = cell.nativeElement.getBoundingClientRect();

      if (clientX < rect.left || clientX > rect.right) continue;

      if (overKey === dragging) {
        // Hovering the dragged column itself — no move, no indicator.
        this.dragTarget.set(null);
        this.dragIndicatorX.set(null);

        return;
      }

      const before = clientX < rect.left + rect.width / 2;

      this.dragTarget.set({ key: overKey, before });
      this.dragIndicatorX.set(before ? rect.left : rect.right);

      return;
    }
  }

  // Insert the dragged column next to `overKey` in the full column order (hidden columns kept in place).
  private commitColumnReorder({ dragging, overKey, before }: { dragging: string; overKey: string; before: boolean }) {
    this.columnOrder.update((order) => {
      const next = order.filter((key) => key !== dragging);
      const overIndex = next.indexOf(overKey);

      if (overIndex === -1) return order;

      next.splice(before ? overIndex : overIndex + 1, 0, dragging);

      return next;
    });
  }

  // Left edge of every visible column's header, keyed by column, captured before a reorder commit.
  private captureColumnLefts() {
    const cells = this.headerCells();
    const columns = this.visibleColumns();
    const lefts = new Map<string, number>();

    cells.forEach((cell, index) => {
      const key = columns[index]?.key;

      if (key) lefts.set(key, cell.nativeElement.getBoundingClientRect().left);
    });

    return lefts;
  }

  // FLIP each column that moved: slide its header + body cells from their old x to the new one.
  private playReorderFlip(firstLefts: Map<string, number>) {
    const cells = this.headerCells();
    const columns = this.visibleColumns();
    const bodyByColumn = this.bodyCellsByColumn();

    cells.forEach((cell, index) => {
      const key = columns[index]?.key;
      const firstLeft = key ? firstLefts.get(key) : undefined;

      if (!key || firstLeft === undefined) return;

      const delta = firstLeft - cell.nativeElement.getBoundingClientRect().left;

      if (Math.abs(delta) < 1) return;

      const elements = [cell.nativeElement, ...(bodyByColumn.get(key) ?? [])];

      // FLIP: pin each cell at its old x with no transition…
      for (const element of elements) {
        this.renderer.setStyle(element, { transition: 'none', transform: `translateX(${delta}px)` });
      }

      forceReflow(cell.nativeElement);

      // …then let it transition back to its new resting position.
      for (const element of elements) {
        this.renderer.setStyle(element, { transition: 'transform 200ms ease' });
        this.renderer.removeStyle(element, 'transform');
      }
    });
  }

  // Group the rendered body cells by their `data-col-key`, for the reorder FLIP.
  private bodyCellsByColumn() {
    const grouped = new Map<string, HTMLElement[]>();

    for (const cell of this.bodyCells()) {
      const key = cell.nativeElement.dataset['colKey'];

      if (!key) continue;

      const group = grouped.get(key);

      if (group) {
        group.push(cell.nativeElement);
      } else {
        grouped.set(key, [cell.nativeElement]);
      }
    }

    return grouped;
  }
}
