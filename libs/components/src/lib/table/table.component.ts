import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  linkedSignal,
  model,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewEncapsulation,
  viewChildren,
} from '@angular/core';
import { RuntimeError, signalElementDimensions, signalHostElementDimensions } from '@ethlete/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, tap, timer } from 'rxjs';
import {
  TABLE_FEATURE_HOST,
  TableHeaderAdornment,
  TableLeadCellContext,
  TableLeadColumn,
  TableRowWindow,
} from './table-features';
import { filterRows } from './table-filter';
import { sortRows } from './table-sort';
import { TableFooterDirective } from './table-footer.directive';
import { TABLE_ERROR_CODES } from './table-errors';
import {
  AnyTableColumn,
  TableColumnState,
  TableExpandedRowContext,
  TableFilter,
  TableHeaderGroup,
  TableSort,
  TableSortDirection,
  TableState,
} from './table.types';

/** Horizontal sticky offsets (px) for pinned columns, keyed by column key. */
type StickyOffsets = { start: Record<string, number>; end: Record<string, number> };

const DEFAULT_TRACK = 'minmax(0, 1fr)';

/** Smallest width (px) a column can be dragged to. */
const MIN_COLUMN_WIDTH = 48;

/** Detail-row enter/leave duration (must match the CSS animations) — see `markUserToggled`. */
const DETAIL_ANIMATION_MS = 200;

/**
 * Least horizontal room (px) the non-pinned columns must keep before sticky columns are suppressed:
 * below this, start+end pinned columns would cover the viewport and scrolling would reveal nothing.
 */
const MIN_UNPINNED_SPACE = 96;

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
  imports: [NgTemplateOutlet],
  providers: [{ provide: TABLE_FEATURE_HOST, useExisting: TableComponent }],
  host: {
    class: 'et-table-host',
    '[attr.data-appearance]': 'appearance()',
    '[attr.data-density]': 'density()',
    '[style.--_et-table-group-h]': 'groupRowHeight() + "px"',
  },
})
export class TableComponent<T> {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

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

  /**
   * Make whole rows respond to clicks: adds a hover/pointer affordance and emits {@link rowClick}
   * (clicks landing on interactive cell content are ignored — see `rowClick`). @default false
   */
  public rowInteractive = input(false, { transform: booleanAttribute });

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

  // The rendered lead-column header cells, in lead-column order — measured so each lead column and
  // the pinned data columns know how far in they start.
  private leadHeaderCells = viewChildren<ElementRef<HTMLElement>>('leadHeaderCell');

  // The table's own expander cell template, registered as a lead column when expansion is on.
  private expanderCellTemplate = viewChild<TemplateRef<TableLeadCellContext>>('expanderCell');

  // Inline-start offset per lead column key, for when they're pinned alongside a sticky-start column.
  private leadStickyOffsets = signal<Record<string, number>>({});

  // UI contributed by opt-in features (filter menus, resize grips), rendered in every header cell.
  // Features register themselves (see TABLE_FEATURE_HOST) rather than being queried, so the table
  // never references a feature's dependencies — that's what keeps them out of an unused bundle.
  private headerAdornmentList = signal<TableHeaderAdornment[]>([]);

  protected headerAdornments = computed(() =>
    [...this.headerAdornmentList()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  // Leading utility columns from features (selection), plus the table's own expander column when a
  // detail template is set. One generic loop per row kind renders them all.
  private leadColumnList = signal<TableLeadColumn[]>([]);

  // A registered row window (virtual scrolling); `null` renders every row.
  private rowWindow = signal<TableRowWindow | null>(null);

  // Inline-start offset for the auto-pinned expander column (it sits after the select column).
  // Recompute sticky-column offsets when the host resizes (column widths change).
  private hostDimensions = signalHostElementDimensions();

  // Rendered height of the spanning group-header row (0 when there are no groups), so the sub-header
  // row can stick just below it. ResizeObserver-backed, tracking the first group cell.
  private groupCellDimensions = signalElementDimensions(computed(() => [...this.groupCells()]));

  protected groupRowHeight = computed(() => this.groupCellDimensions()?.offset?.height ?? 0);

  // Measured inline offsets for pinned columns (see the effect that fills them).
  private stickyOffsets = signal<StickyOffsets>({ start: {}, end: {} });

  // True when pinning is measured to crowd the non-pinned columns off-screen (see the sticky effect):
  // sticky positioning is then dropped so every column scrolls normally instead of hiding behind the pins.
  private stickySuppressed = signal(false);

  /** Whether row expansion is active (a detail template was provided). */
  public expandable = computed(() => this.expandedRowTemplate() !== undefined);

  // See markUserToggled / detailAnimation: gates the detail row's animation to user-driven toggles.
  private userToggledKey = signal<unknown>(null);
  private userToggleReset: Subscription | undefined;

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
  // User-resized column widths (px), keyed by column key. Reset when the `columns` input changes;
  // a manual restoreState() persists until then (same linkedSignal semantics as order/visibility).
  private columnWidths = linkedSignal<AnyTableColumn<T>[], Record<string, number>>({
    source: () => this.columns(),
    computation: () => ({}),
  });

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
  public hasStickyStart = computed(
    () => !this.stickySuppressed() && this.visibleColumns().some((column) => column.sticky === 'start'),
  );

  /** Whether any visible column is pinned (start or end) — the grid then sizes to its tracks so pinning works. */
  public hasStickyColumns = computed(
    () => !this.stickySuppressed() && this.visibleColumns().some((column) => !!column.sticky),
  );

  /** Whether any visible column defines a footer cell (drives the sticky footer row). */
  public hasFooter = computed(() => this.visibleColumns().some((column) => !!column.footerCell));

  /**
   * The leading utility columns in render order: whatever features registered (selection), then the
   * table's own expander column when a detail template is set.
   */
  protected leadColumns = computed<TableLeadColumn[]>(() => {
    const leads = [...this.leadColumnList()];

    if (this.expandable()) {
      leads.push({
        key: 'et-table-expander',
        width: 'var(--et-table-expander-width, 32px)',
        // after any feature column, so a select checkbox stays leftmost
        order: 100,
        cellClass: 'et-table-expander-cell',
        bodyCell: this.expanderCellTemplate,
      });
    }

    return leads.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  /** The `grid-template-columns` value for the visible columns (plus a leading expander track when expandable). */
  public templateColumns = computed(() => {
    const widths = this.columnWidths();
    const tracks = this.visibleColumns().map((column) => {
      const resized = widths[column.key];

      return resized !== undefined ? `${resized}px` : (column.width ?? DEFAULT_TRACK);
    });

    // Leading utility columns come first, in registration order (see `leadColumns`). Their widths are
    // px, not rem: they must fit their control (a 24px button / 16px checkbox plus the cell's 4px
    // inline padding) regardless of the host app's root font size.
    return [...this.leadColumns().map((lead) => lead.width), ...tracks].join(' ');
  });

  /** The serializable, versioned table state — column order, visibility, sort, filters and expanded rows. */
  public state = computed<TableState>(() => {
    const sort = this.sort();
    const multiSorted = sort.length > 1;
    const sortByKey = new Map(sort.map((entry, index) => [entry.key, { direction: entry.direction, index }]));
    const filtersByKey = new Map(this.filters().map((entry) => [entry.key, entry.values]));

    const widths = this.columnWidths();

    const columns = this.orderedColumns().map((column) => {
      const entry: TableColumnState = { key: column.key, hidden: this.hiddenColumns().has(column.key) };
      const columnSort = sortByKey.get(column.key);
      const columnFilter = filtersByKey.get(column.key);

      if (columnSort) {
        entry.sort = columnSort.direction;

        if (multiSorted) entry.sortPriority = columnSort.index;
      }

      if (columnFilter?.length) entry.filterValues = columnFilter;

      if (widths[column.key] !== undefined) entry.width = widths[column.key];

      return entry;
    });

    const rowKey = this.rowKey();
    const expandedKeys = this.expandedKeys();

    // Expanded rows only serialize when a rowKey gives them a stable string identity.
    const expanded = rowKey && expandedKeys.size ? [...expandedKeys].map(String) : undefined;

    return expanded ? { v: 1, columns, expanded } : { v: 1, columns };
  });

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

  /** The rows actually rendered — a registered row window's slice (virtual scrolling), or all of them. */
  public renderedRows = computed<readonly T[]>(() => {
    const window = this.rowWindow();
    const rows = this.rows();

    return window ? (window.slice(rows) as readonly T[]) : rows;
  });

  /** Absolute index of the first rendered row, so cell contexts keep true row indices while windowed. */
  public rowIndexOffset = computed(() => this.rowWindow()?.offset() ?? 0);

  /** Spacer sizes standing in for the rows a window leaves out, or `null` when every row renders. */
  protected spacers = computed(() => {
    const window = this.rowWindow();

    if (!window || !this.rows().length) return null;

    return { start: window.paddingStart(), end: window.paddingEnd() };
  });

  constructor() {
    // Measure pinned columns' inline offsets from header-cell widths (re-runs on resize and
    // structural change). Sticky-start columns stack from the left edge (clearing the expander),
    // sticky-end columns stack from the right — pin from the edges, so widths sum cleanly.
    effect(() => {
      this.hostDimensions();
      // Re-measure when a column is resized (widths change but the host doesn't), so pinned
      // columns keep their offsets in sync with the new track widths.
      this.columnWidths();

      const columns = this.visibleColumns();
      const cells = this.headerCells();

      // `signalElementDimensions` observes one element; sticky offsets need the widths of *every*
      // header cell summed in order, re-read whenever the host resizes or a column width changes —
      // both of which this effect already tracks above.
      // eslint-disable-next-line ethlete/prefer-element-dimensions
      const width = (index: number) => cells[index]?.nativeElement.getBoundingClientRect().width ?? 0;

      const start: Record<string, number> = {};

      // Leading utility columns stack from the edge, each starting after the ones before it.
      const leadCells = this.leadHeaderCells();
      const leadOffsets: Record<string, number> = {};
      let leadWidth = 0;

      this.leadColumns().forEach((lead, index) => {
        leadOffsets[lead.key] = leadWidth;
        // Same as above: a running sum over all lead cells, not one observable element.
        // eslint-disable-next-line ethlete/prefer-element-dimensions
        leadWidth += leadCells[index]?.nativeElement.getBoundingClientRect().width ?? 0;
      });

      this.leadStickyOffsets.set(leadOffsets);

      let left = leadWidth;
      let pinnedStartWidth = 0;
      let pinnedEndWidth = 0;
      let hasStartPin = false;

      for (let index = 0; index < columns.length; index++) {
        const column = columns[index];

        if (column?.sticky === 'start') {
          start[column.key] = left;
          pinnedStartWidth += width(index);
          hasStartPin = true;
        }

        left += width(index);
      }

      const end: Record<string, number> = {};
      let right = 0;

      for (let index = columns.length - 1; index >= 0; index--) {
        const column = columns[index];

        if (column?.sticky === 'end') {
          end[column.key] = right;
          pinnedEndWidth += width(index);
        }

        right += width(index);
      }

      this.stickyOffsets.set({ start, end });

      // Suppress pinning when the columns that would stay put (pins, plus the leading utility columns
      // when a start pin makes them sticky too) leave the scrollable columns too little room to ever
      // surface. Track widths don't change when we unpin, so this can't oscillate.
      // The host's own width is already tracked reactively above, so read it from there.
      const containerWidth = this.hostDimensions()?.client?.width ?? 0;
      const pinnedWidth = pinnedStartWidth + pinnedEndWidth + (hasStartPin ? leadWidth : 0);
      const hasUnpinned = columns.some((column) => !column?.sticky);

      this.stickySuppressed.set(hasUnpinned && containerWidth > 0 && containerWidth - pinnedWidth < MIN_UNPINNED_SPACE);
    });
  }

  /**
   * Called by an opt-in feature (e.g. `<et-table-filters>`) to add UI to every header cell. Part of
   * the feature contract — see `TableFeatureHost`; consumers never call this.
   */
  public registerHeaderAdornment(adornment: TableHeaderAdornment) {
    this.headerAdornmentList.update((adornments) => [...adornments, adornment]);
  }

  /**
   * Called by an opt-in feature to add a leading utility column (e.g. `<et-table-selection>`). Part of
   * the feature contract; consumers never call this.
   */
  public registerLeadColumn(column: TableLeadColumn) {
    this.leadColumnList.update((columns) => [...columns, column]);
  }

  /**
   * Called by an opt-in feature to window the rendered rows (`<et-table-virtual-scroll>`). Part of the
   * feature contract; consumers never call this.
   */
  public registerRowWindow(window: TableRowWindow) {
    if (isDevMode() && this.rowWindow()) {
      throw new RuntimeError(
        TABLE_ERROR_CODES.DUPLICATE_ROW_WINDOW,
        '[et-table] Two features tried to window the rows. Use only one row-windowing feature per table.',
      );
    }

    this.rowWindow.set(window);
  }

  /** A rendered body cell, for a feature measuring real row height. Part of the feature contract. */
  public firstBodyCellElement() {
    return this.bodyCells()[0]?.nativeElement ?? null;
  }

  /** Apply a previously captured {@link TableState} — column order, visibility, sort, filters and expanded rows. */
  public restoreState(next: TableState) {
    this.columnOrder.set(next.columns.map((column) => column.key));
    this.hiddenColumns.set(new Set(next.columns.filter((column) => column.hidden).map((column) => column.key)));

    const widths: Record<string, number> = {};

    for (const column of next.columns) {
      if (typeof column.width === 'number') widths[column.key] = column.width;
    }

    this.columnWidths.set(widths);

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

    this.markUserToggled(key);
    this.expandedKeys.set(next);
  }

  /** The inline-start offset (px) of a lead column, when the leading columns are pinned. */
  protected leadStickyStart(key: string) {
    return this.leadStickyOffsets()[key] ?? 0;
  }

  /** Row classes contributed by lead columns (selection marks its rows). */
  protected leadRowClasses(row: T) {
    return this.leadColumns()
      .map((lead) => lead.rowClass?.(row))
      .filter((className): className is string => !!className)
      .join(' ');
  }

  protected canExpand(row: T) {
    return this.expandable() && (this.expandableRow()?.(row) ?? true);
  }

  /**
   * The animation class for a detail row's enter/leave, or `''` to mount/unmount it instantly.
   *
   * Only the row the user just toggled animates. A detail row also mounts and unmounts when the rows
   * themselves change — paging away and back, sorting, a query refresh — and animating those replays
   * an open/close the user never asked for (and pays the layout cost mid page-change).
   */
  protected detailAnimation(row: T, phase: 'enter' | 'leave') {
    return this.userToggledKey() === this.rowIdentity(row) ? `et-table-detail--${phase}` : '';
  }

  /**
   * Emit {@link rowClick} for a row (click or keyboard), unless the activation came from interactive
   * content inside it. Takes a plain `Event`: Angular types `$event` for the `keydown.enter` /
   * `keydown.space` pseudo-events that way, and the keyboard case is narrowed below.
   */
  protected activateRow(row: T, event: Event) {
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

  /** The table's own element. Part of the feature contract (features are never projected into the DOM). */
  public get element() {
    return this.elementRef.nativeElement;
  }

  /** The visible columns, in render order. Part of the feature contract. */
  public visibleColumnsMeta() {
    return this.visibleColumns();
  }

  /** The rendered header cells, ordered like {@link visibleColumnsMeta}. Part of the feature contract. */
  public headerCellElements() {
    return this.headerCells().map((ref) => ref.nativeElement);
  }

  /** The rendered body cells of one column. Part of the feature contract (reorder animates them). */
  public bodyCellElementsFor(key: string) {
    return this.bodyCells()
      .map((ref) => ref.nativeElement)
      .filter((cell) => cell.dataset['colKey'] === key);
  }

  /** A column's effective pinning, or `null` when unpinned/suppressed. Part of the feature contract. */
  public effectiveStickyOf(key: string): 'start' | 'end' | null {
    const column = this.columnsByKey().get(key);

    return column ? this.effectiveSticky(column) : null;
  }

  /**
   * Insert a column next to another in the full column order, keeping hidden columns in place. Part of
   * the feature contract — `<et-table-reorder>` commits a drop with it.
   */
  public moveColumnNextTo(key: string, target: { overKey: string; before: boolean }) {
    this.columnOrder.update((order) => {
      const next = order.filter((entry) => entry !== key);
      const overIndex = next.indexOf(target.overKey);

      if (overIndex === -1) return order;

      next.splice(target.before ? overIndex : overIndex + 1, 0, key);

      return next;
    });
  }

  /**
   * The column's current rendered header width in px. Part of the feature contract — `<et-table-resize>`
   * uses it as the baseline for a drag.
   */
  public renderedColumnWidth(key: string) {
    const cell = this.headerCells().find((ref) => ref.nativeElement.getAttribute('data-col-key') === key);

    return cell?.nativeElement.getBoundingClientRect().width ?? 0;
  }

  /**
   * Override a column's width, clamped between a usable minimum and the table's own width — a column
   * wider than the visible table only scrolls uselessly and makes it easy to strand the layout in a
   * strange state. Stored in `state()` so it round-trips. Part of the feature contract.
   */
  public setColumnWidth(key: string, width: number) {
    const max = this.elementRef.nativeElement.clientWidth || Number.MAX_SAFE_INTEGER;
    const clamped = Math.min(max, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));

    this.columnWidths.update((widths) => ({ ...widths, [key]: clamped }));
  }

  /** Reset a column to its default width (drops the user override), e.g. on grip double-click. */
  public resetColumnWidth(key: string) {
    this.columnWidths.update((widths) => {
      if (widths[key] === undefined) return widths;

      const next = { ...widths };
      delete next[key];

      return next;
    });
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const direction = this.sortDirection(key);

    return direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
  }

  /** A column's effective pinning, or `null` when it isn't pinned or pinning is suppressed (see {@link stickySuppressed}). */
  protected effectiveSticky(column: AnyTableColumn<T>): 'start' | 'end' | null {
    return this.stickySuppressed() ? null : (column.sticky ?? null);
  }

  /** The inline-start offset (px) for a start-pinned column, or `null` when it isn't pinned there. */
  protected stickyStart(key: string): number | null {
    return this.stickySuppressed() ? null : (this.stickyOffsets().start[key] ?? null);
  }

  /** The inline-end offset (px) for an end-pinned column, or `null` when it isn't pinned there. */
  protected stickyEnd(key: string): number | null {
    return this.stickySuppressed() ? null : (this.stickyOffsets().end[key] ?? null);
  }

  // The row key whose expansion the user just toggled, cleared once the animation has run. Compared
  // by identity in `detailAnimation`, so any other (re-)mount of a detail row skips its animation.
  private markUserToggled(key: unknown) {
    this.userToggledKey.set(key);
    this.userToggleReset?.unsubscribe();
    this.userToggleReset = timer(DETAIL_ANIMATION_MS)
      .pipe(
        tap(() => this.userToggledKey.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  // Walk the event's composed path up to the row element; bail if it passed through anything the
  // user meant to click instead of the row (a control, a menu trigger, or a utility cell). Uses
  // composedPath (not `.closest()`, which the styleguide forbids) so it also works across shadow roots.
  private originatesFromInteractive(event: Event) {
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
}
