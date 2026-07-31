import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  isDevMode,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  injectColorThemes,
  injectStyleManager,
  ProvideColorDirective,
  RuntimeError,
  signalElementDimensions,
  signalHostElementDimensions,
} from '@ethlete/core';
import { Subscription, tap, timer } from 'rxjs';
import { ARROW_UP_ICON } from '../icon/headless/arrow-up-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import { TRIANGLE_EXCLAMATION_ICON } from '../icon/headless/triangle-exclamation-icon';
import { SkeletonItemComponent } from '../skeleton/skeleton-item.component';
import { reconcileColumnOrder, reconcileColumnWidths, reconcileHiddenColumns } from './headless/table-column-state';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableDetailStylesComponent } from './table-detail-styles.component';
import { TableExpanderCellComponent } from './table-expander-cell.component';
import {
  TABLE_FEATURE_HOST,
  TableCellErrorMark,
  TableHeaderAdornment,
  TableLayer,
  TableLeadColumn,
  TableCellEditing,
  TableCellNavigation,
  TableRowWindow,
  TableStateSlice,
} from './headless/table-features';
import { filterRows } from './headless/table-filter';
import { TableFooterDirective } from './headless/table-footer.directive';
import { TableRowsSource } from './headless/table-rows-source';
import { injectTableLabels, TableLabels } from './headless/table-labels';
import { sortRows } from './headless/table-sort';
import {
  TableCellContext,
  TableCellSkeletonContext,
  TableCellState,
  TableCellStateValue,
  TableColumnDef,
  TableColumns,
  TableColumnState,
  TableColumnTemplate,
  TableEmptyContext,
  TableErrorContext,
  TableExpandedRowContext,
  TableFilter,
  TableHeaderGroup,
  TableSort,
  TableSortDirection,
  TableState,
  TableTemplateSlot,
} from './table.types';

/** Horizontal sticky offsets (px) for pinned columns, keyed by column key. */
type StickyOffsets = { start: Record<string, number>; end: Record<string, number> };

/**
 * The rendered shape of the table, resolved from the signals **before** the template runs.
 *
 * The template binds fields, never calls methods: a method in a binding re-runs on every change
 * detection with nothing to memoize it, and in a table that means row-count × column-count calls per
 * pass. Each `…Vm` below is one `computed`, so the same work happens once per actual change and the
 * template is a plain projection of it. (Event bindings still call methods — that's the one place a
 * call belongs.)
 */
type TableStickyVm = {
  stickyStart: boolean;
  stickyEnd: boolean;
  offsetStart: number | null;
  offsetEnd: number | null;
};

/** One leading utility cell (selection, expander) — identical chrome in every row kind. */
type TableLeadCellVm = {
  key: string;
  cellClass: string;
  sticky: boolean;
  offset: number | null;
  lead: TableLeadColumn;
};

type TableHeaderCellVm<T> = TableStickyVm & {
  key: string;
  column: TableColumnDef<T>;
  align: string;
  sortable: boolean;
  ariaSort: 'ascending' | 'descending' | 'none' | null;
  sortLabel: string | null;
  direction: TableSortDirection | null;
  template: TemplateRef<unknown> | null;
};

type TableBodyCellVm<T> = TableStickyVm & {
  key: string;
  align: string;
  state: TableCellState | null;
  /** What went wrong, when the callback said — shown on the mark. */
  message: string | null;
  template: TemplateRef<unknown> | null;
  /** The cell's value, resolved through the column's accessor. */
  value: unknown;
  /** Context for a cell template, built here so the template outlet binds one object. */
  context: TableCellContext<T, unknown>;
  /**
   * The column's edit template and the editing feature's context, while this is the one cell in edit
   * mode. `null` for every other cell, which is every cell of a table without the feature.
   */
  edit: { template: TemplateRef<unknown>; context: object } | null;
};

type TableBodyRowVm<T> = {
  row: T;
  /** The row's absolute index in `rows()` — true even while a virtual window renders a slice. */
  index: number;
  /** `rowIdentity`'s result — what `@for` tracks by. */
  key: unknown;
  classes: string;
  stripe: boolean;
  showDetail: boolean;
  /** Enter/leave animation classes, empty unless this is the row the user just toggled. */
  enterAnimation: string;
  leaveAnimation: string;
  leads: TableLeadCellVm[];
  cells: TableBodyCellVm<T>[];
};

type TableFooterCellVm = TableStickyVm & {
  key: string;
  align: string;
  template: TemplateRef<unknown> | null;
};

/** One loading placeholder row: a bone per column, at a width that doesn't change between passes. */
type TablePlaceholderRowVm = {
  key: number;
  leads: TableLeadCellVm[];
  cells: {
    key: string;
    align: string;
    width: number;
    /** The column's own `etTableCellSkeleton`, when it has one. */
    template: TemplateRef<unknown> | null;
    context: TableCellSkeletonContext;
  }[];
};

/**
 * Default narrowest width (px) a column may end up at, whether dragged there or squeezed there by a
 * wider neighbour. Sized so the header still reads: a cell spends 24px on its own inline padding and
 * up to another 24px on a column-menu trigger, so anything much under this is all chrome and no
 * label. A column that genuinely needs less says so with `minWidth`.
 */
const MIN_COLUMN_WIDTH = 96;

/**
 * The default track for a column: it shares out the leftover room, but never shrinks past its floor —
 * which is what stops one wide (or resized) column from squeezing its neighbours down to their
 * padding and out of sight. Past that point the table scrolls instead, which the scroll fades
 * advertise.
 */
const defaultTrack = (minWidth: number) => `minmax(${minWidth}px, 1fr)`;

/**
 * Trailing track that soaks up the room left over by all-rigid columns — see
 * {@link TableComponent.hasFiller}. Slack, not a column, so unlike {@link DEFAULT_TRACK} it has no
 * floor: it must be free to collapse to nothing.
 */
const FILLER_TRACK = 'minmax(0, 1fr)';

/**
 * Whether a `grid-template-columns` track grows into leftover space: `auto` tracks are stretched by
 * the grid's default `justify-content: normal`, and `fr` tracks are flexible by definition.
 */
const isFlexibleTrack = (track: string) => /\bauto\b|[\d.]fr\b/.test(track);

/** Detail-row enter/leave duration (must match the CSS animations) — see `markUserToggled`. */
const DETAIL_ANIMATION_MS = 200;

/**
 * Least horizontal room (px) the non-pinned columns must keep before sticky columns are suppressed:
 * below this, start+end pinned columns would cover the viewport and scrolling would reveal nothing.
 */
const MIN_UNPINNED_SPACE = 96;

/**
 * Cheap structural comparison for the small, plain state lists the table mirrors (sort entries, filter
 * values). Enough to stop an equal-but-new array from being written back — see the mirroring effect.
 */
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Sub-pixel slack (px) before a scroll offset counts as "there is content over there". */
const SCROLL_FADE_EPSILON = 1;

/**
 * Widths (%) a loading placeholder bar cycles through, so a block of them reads as ragged text rather
 * than a bar chart. Cycled by row + column index — see `placeholderGrid`.
 */
const PLACEHOLDER_WIDTHS = [72, 45, 88, 60, 34, 79];

/**
 * The default table. Renders typed rows and cells from a {@link TableColumns}
 * record on a CSS grid with a sticky header and an empty state. Light by
 * default — sort, filter, expansion, reordering, virtualization and state
 * persistence arrive as separate opt-in features.
 *
 * @example
 * const COLUMNS = {
 *   name: { header: 'Name', value: (user: User) => user.name },
 *   email: { header: 'Email', value: (user: User) => user.email },
 * } satisfies TableColumns<User>;
 *
 * <et-table [data]="users()" [columns]="COLUMNS" />
 */
@Component({
  selector: 'et-table',
  templateUrl: './table.component.html',
  styleUrl: './table.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet, NgTemplateOutlet, IconDirective, ProvideColorDirective, SkeletonItemComponent],
  providers: [
    { provide: TABLE_FEATURE_HOST, useExisting: TableComponent },
    provideIcons(ARROW_UP_ICON, TRIANGLE_EXCLAMATION_ICON),
  ],
  host: {
    class: 'et-table-host',
    '[attr.data-appearance]': 'appearance()',
    '[attr.data-density]': 'density()',
    '[style.--_et-table-group-h]': 'groupRowHeight() + "px"',
    '[attr.aria-busy]': 'resolvedLoading() ? "true" : null',
    '(scroll)': 'syncScrollFades()',
  },
})
export class TableComponent<T> {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  protected injector = inject(Injector);
  private injectedLabels = injectTableLabels();
  private styleManager = injectStyleManager();

  /** The rows to render. */
  public data = input<readonly T[]>([]);

  /**
   * A rows source to drive the table from — what `tableRowsFromQuery` / `tableRowsFromV2Query` return,
   * or any object of that shape. It supplies `data`, `loading` and `error`, and takes the table's sort
   * and filter changes back through its own setters, so one binding replaces six.
   *
   * Because such a source has already sorted and filtered on the server, `sortMode` and `filterMode`
   * default to `'server'` while one is bound — set them explicitly to override.
   */
  public rowsSource = input<TableRowsSource<T>>();

  /** The column definitions, keyed by column key (see {@link TableColumns}). */
  public columns = input<TableColumns<T>>({});

  /**
   * Stable per-row identity for change tracking (and, later, row-keyed state such
   * as selection/expansion). Defaults to row reference identity.
   */
  public rowKey = input<(row: T) => string | number>();

  /**
   * Wording for this table only, on top of the injected {@link TABLE_LABELS} set. Prefer
   * {@link provideTableLabels} for app-wide localization; use this for a one-off. Partial — omitted
   * keys keep the provided/default value.
   */
  public labels = input<Partial<TableLabels> | null>(null);

  /**
   * Whether the rows are being loaded. With nothing to show yet the body renders placeholder rows
   * ({@link loadingRows}); over rows that are already on screen it keeps them readable and runs a
   * busy bar under the header instead, so a refetch doesn't blank the table the user is reading.
   * The host carries `aria-busy` either way. @default false
   */
  public loading = input(false, { transform: booleanAttribute });

  /** How many placeholder rows to draw while loading with no rows yet. @default 5 */
  public loadingRows = input(5, { transform: numberAttribute });

  /**
   * The load's failure, if any — anything non-nullish counts (an `HttpErrorResponse`, a message, a
   * flag), so it takes a query's `error` signal as-is. Set, it replaces the body with the error
   * state: stale rows under an unreported failure are worse than an honest empty table. Say more than
   * the `error` label with {@link errorTemplate} (which gets the error) or a projected `[etTableError]`.
   */
  public error = input<unknown>(null);

  /**
   * Body content for the empty state, in place of the `empty` label. Context: `{ $implicit: rows }` —
   * the (empty) row list, so one template can serve "nothing here" and "nothing matches your filters".
   * Takes precedence over projected `[etTableEmpty]` content.
   */
  public emptyTemplate = input<TemplateRef<TableEmptyContext<T>>>();

  /**
   * Body content for the error state, in place of the `error` label. Context: `{ $implicit: error }` —
   * whatever was bound to {@link error} — so the template can render the message and a retry.
   * Takes precedence over projected `[etTableError]` content.
   */
  public errorTemplate = input<TemplateRef<TableErrorContext>>();

  /**
   * Per-cell async state, for a cell that loads or fails on its own (inline editing). Return
   * `'loading'` to replace that cell's content with a placeholder bar, `'error'` to mark it, or
   * `null`/nothing for a normal cell. Return `{ state: 'error', message }` and the message rides
   * along on the mark — as its `title` and accessible name, or as a tooltip with
   * `etTableCellErrorTooltip`. Resolved once per rendered cell (see `bodyRows`), but keep it cheap
   * anyway — a map lookup, not a search.
   */
  public cellState = input<(row: T, key: string) => TableCellStateValue | null | undefined>();

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
  public multiSort = input(false, { transform: booleanAttribute });

  /**
   * `'client'` sorts the rows in the browser via {@link sortRows}; `'server'`
   * leaves rows untouched so the backend can sort.
   * @default 'client'
   */
  public sortMode = input<'client' | 'server'>();

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
  public filterMode = input<'client' | 'server'>();

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

  /** The sort mode in effect: what you set, else `'server'` when a {@link rowsSource} is bound. */
  public resolvedSortMode = computed<'client' | 'server'>(
    () => this.sortMode() ?? (this.rowsSource() ? 'server' : 'client'),
  );

  /** The filter mode in effect: what you set, else `'server'` when a {@link rowsSource} is bound. */
  public resolvedFilterMode = computed<'client' | 'server'>(
    () => this.filterMode() ?? (this.rowsSource() ? 'server' : 'client'),
  );

  /** The strings in effect here: the injected label set with this table's `labels` applied. */
  public resolvedLabels = computed<TableLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  /**
   * The app's error color theme, for the table's own error UI (the error state, an errored cell).
   * Looked up by `type` rather than through `injectErrorTheme()`, which throws when an app registered
   * no `type: 'error'` theme: a table must not require one just to render a list. Without one the
   * error UI stays on the surface's own colors.
   */
  public errorColorTheme = injectColorThemes({ optional: true })?.find((theme) => theme.type === 'error');

  // Inline-start offset per lead column key, for when they're pinned alongside a sticky-start column.
  private leadStickyOffsets = signal<Record<string, number>>({});

  // UI contributed by opt-in features (filter menus, resize grips), rendered in every header cell.
  // Features register themselves (see TABLE_FEATURE_HOST) rather than being queried, so the table
  // never references a feature's dependencies — that's what keeps them out of an unused bundle.
  private headerAdornmentList = signal<TableHeaderAdornment[]>([]);

  protected headerAdornments = computed(() =>
    this.headerAdornmentList()
      .filter((adornment) => adornment.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  // Serializable state owned by features (a selection), carried in `state().features`.
  private stateSliceList = signal<TableStateSlice[]>([]);

  // A feature's replacement for the errored-cell mark (the tooltip version). Null until one registers,
  // which is what keeps the overlay runtime out of a table that only needs to mark the cell.
  private cellErrorMarkList = signal<TableCellErrorMark[]>([]);

  protected cellErrorMark = computed(() => this.cellErrorMarkList().find((mark) => mark.enabled?.() ?? true) ?? null);

  // Floating UI contributed by features (the reorder drag ghost). The table hosts it so a feature
  // never needs a view — and never an element — of its own.
  private layerList = signal<TableLayer[]>([]);

  protected layers = computed(() => this.layerList().filter((layer) => layer.enabled?.() ?? true));

  // Leading utility columns from features (selection), plus the table's own expander column when a
  // detail template is set. One generic loop per row kind renders them all.
  private leadColumnList = signal<TableLeadColumn[]>([]);

  // A registered row window (virtual scrolling); `null` renders every row.
  private registeredRowWindow = signal<TableRowWindow | null>(null);

  // A feature that owns cell focus (etTableKeyboardNav). While one is live the body's cells become the
  // focus targets, which is the one thing the base has to know about: a focusable cell needs a
  // `tabindex`, and the row must stop being a tab stop of its own or the body would have two.
  private cellNavigationList = signal<TableCellNavigation[]>([]);

  /** Whether a feature has taken over cell focus — see {@link registerCellNavigation}. */
  public cellNavigation = computed(() =>
    this.cellNavigationList().some((navigation) => navigation.enabled?.() ?? true),
  );

  // A feature that edits cells in place (etTableInlineEdit). The base knows only which cell is open and
  // what to render in it — the session, the draft and the commit are all the feature's.
  private cellEditingList = signal<TableCellEditing[]>([]);

  private cellEditing = computed(() => this.cellEditingList().find((editing) => editing.enabled?.() ?? true) ?? null);

  private rowWindow = computed(() => {
    const window = this.registeredRowWindow();

    return window && (window.enabled?.() ?? true) ? window : null;
  });

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

  // Columns whose track is let out to `max-content` for one frame so it can be measured. Empty except
  // during an `autosizeColumns` pass.
  private autosizing = signal<ReadonlySet<string>>(new Set());

  // Total frozen width (px) at each inline edge — the leading utility columns and start pins, and the
  // end pins. Where the scroll fades sit; see `scrollFades`.
  private pinnedInsets = signal<{ start: number; end: number }>({ start: 0, end: 0 });

  /**
   * Where content is currently scrolled out of view horizontally. Drives the edge gradients: they mark
   * the boundary the rows disappear under, which is *not* the viewport edge when columns are pinned —
   * a pinned column is the thing they slide beneath, so the fade sits at its inner edge instead. That
   * offset is what a generic scroll-fade wrapper can't know, so the table draws its own.
   */
  protected scrollFades = signal<{ start: boolean; end: boolean }>({ start: false, end: false });

  /** The inline offset (px) each edge gradient is pushed in by, so it clears any pinned columns. */
  protected fadeInset = this.pinnedInsets.asReadonly();

  /** Whether row expansion is active (a detail template was provided). */
  public expandable = computed(() => this.expandedRowTemplate() !== undefined);

  // See markUserToggled / bodyRows: gates the detail row's animation to user-driven toggles.
  private userToggledKey = signal<unknown>(null);
  private userToggleReset: Subscription | undefined;

  // The declared columns paired with their keys, in declaration order — the form everything else
  // (rendering, features, state) works with. Keys are the record's, so they can't collide.
  private columnDefs = computed<TableColumnDef<T>[]>(() =>
    Object.entries(this.columns()).map(([key, column]) => ({ ...column, key })),
  );

  // Column order, visibility and user-resized widths (px). All three are reconciled rather than
  // reset when the `columns` input changes identity, so a reorder / resize / hidden column (or a
  // restoreState()) survives a consumer rebuilding its definitions — see `table-column-state.ts`.
  private columnOrder = linkedSignal<TableColumnDef<T>[], string[]>({
    source: () => this.columnDefs(),
    computation: (columns, previous) =>
      reconcileColumnOrder(
        columns.map((column) => column.key),
        previous?.value,
      ),
  });
  private hiddenColumns = linkedSignal<TableColumnDef<T>[], Set<string>>({
    source: () => this.columnDefs(),
    computation: (columns, previous) =>
      reconcileHiddenColumns(columns, previous && { columns: previous.source, hidden: previous.value }),
  });
  private columnWidths = linkedSignal<TableColumnDef<T>[], Record<string, number>>({
    source: () => this.columnDefs(),
    computation: (columns, previous) => reconcileColumnWidths(columns, previous?.value),
  });

  private columnsByKey = computed(() => new Map(this.columnDefs().map((column) => [column.key, column])));

  // Templates registered by the `etTableCell` / `etTableHeaderCell` / `etTableFooterCell`
  // directives, resolved to a column key by identity against the `columns` record.
  private columnTemplateList = signal<TableColumnTemplate[]>([]);

  public columnTemplates = computed(() => {
    const keyByColumn = new Map<object, string>(Object.entries(this.columns()).map(([key, column]) => [column, key]));
    const slots: Record<TableTemplateSlot, Map<string, TemplateRef<unknown>>> = {
      cell: new Map(),
      header: new Map(),
      footer: new Map(),
      filterOption: new Map(),
      cellSkeleton: new Map(),
      cellEdit: new Map(),
    };

    for (const registration of this.columnTemplateList()) {
      const key = keyByColumn.get(registration.column());

      if (key === undefined) {
        // Silently rendering nothing would look like a broken template, so name the mistake.
        if (isDevMode()) {
          throw new RuntimeError(
            TABLE_ERROR_CODES.UNKNOWN_TEMPLATE_COLUMN,
            `[et-table] A column template is bound to a column this table does not render. Bind it to a column of the same \`columns\` record (e.g. [etTableCell]="COLUMNS.role").`,
          );
        }

        continue;
      }

      slots[registration.slot].set(key, registration.template);
    }

    return slots;
  });

  private orderedColumns = computed(() => {
    const map = this.columnsByKey();

    return this.columnOrder()
      .map((key) => map.get(key))
      .filter((column): column is TableColumnDef<T> => column !== undefined);
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

  /** Whether any visible column is pinned to the trailing edge. */
  public hasStickyEnd = computed(
    () => !this.stickySuppressed() && this.visibleColumns().some((column) => column.sticky === 'end'),
  );

  /** Whether any visible column is pinned (start or end) — the grid then sizes to its tracks so pinning works. */
  public hasStickyColumns = computed(
    () => !this.stickySuppressed() && this.visibleColumns().some((column) => !!column.sticky),
  );

  /** Whether any visible column has a registered footer cell (drives the sticky footer row). */
  public hasFooter = computed(() => {
    const footers = this.columnTemplates().footer;

    return this.visibleColumns().some((column) => footers.has(column.key));
  });

  /**
   * The leading utility columns in render order: whatever features registered (selection), then the
   * table's own expander column when a detail template is set.
   */
  public leadColumns = computed<TableLeadColumn[]>(() => {
    const leads = this.leadColumnList().filter((lead) => lead.enabled?.() ?? true);

    if (this.expandable()) {
      leads.push({
        key: 'et-table-expander',
        width: 'var(--et-table-expander-width, 32px)',
        // after any feature column, so a select checkbox stays leftmost
        order: 100,
        cellClass: 'et-table-expander-cell',
        bodyComponent: TableExpanderCellComponent,
      });
    }

    return leads.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  /**
   * The column tracks, plus whether they are all rigid.
   *
   * A track that is `auto` or flexible (`fr`) soaks up whatever room is left over, so such a grid
   * always fills its container. Once every column carries a fixed length — which is what resizing
   * every column does — that stops being true, and the table's chrome (header band, row dividers,
   * vertical rules) would stop at the last column instead of at the panel's edge. {@link hasFiller}
   * is the fix.
   */
  private columnTracks = computed(() => {
    const widths = this.columnWidths();
    const measuring = this.autosizing();
    const tracks = this.visibleColumns().map((column) => {
      // Mid-autosize this column is let out to its content so it can be measured — see `autosizeColumns`.
      if (measuring.has(column.key)) return 'max-content';

      const resized = widths[column.key];

      return resized !== undefined ? `${resized}px` : (column.width ?? defaultTrack(this.minWidthOf(column.key)));
    });

    // An end-pinned column already owns the trailing edge of the scroll viewport; a slack track
    // between it and that edge would only strand it away from the last real column. Nor during a
    // measurement pass: `max-content` isn't flexible, so it would otherwise add — and immediately
    // drop — a filler cell in every row for that one frame.
    const fixed = tracks.length > 0 && !measuring.size && !tracks.some(isFlexibleTrack) && !this.hasStickyEnd();

    // Leading utility columns come first, in registration order (see `leadColumns`). Their widths are
    // px, not rem: they must fit their control (a 24px button / 16px checkbox plus the cell's 4px
    // inline padding) regardless of the host app's root font size.
    const leads = this.leadColumns().map((lead) => lead.width);

    return { template: [...leads, ...tracks, ...(fixed ? [FILLER_TRACK] : [])].join(' '), fixed };
  });

  /** The `grid-template-columns` value for the visible columns (plus a leading expander track when expandable). */
  public templateColumns = computed(() => this.columnTracks().template);

  /**
   * Whether a trailing filler track is in play. It carries an empty cell in every row so the header
   * band, row dividers and vertical rules run to the panel's edge instead of stopping at the last
   * rigid column.
   */
  protected hasFiller = computed(() => this.columnTracks().fixed);

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

    // Whatever the imported features own (a selection). Absent when no feature contributed, so a plain
    // table's state is exactly what it was before the bag existed.
    const slices = this.stateSliceList();
    const features: Record<string, unknown> = {};

    for (const slice of slices) {
      const value = slice.read();

      if (value !== undefined) features[slice.key] = value;
    }

    const hasFeatures = Object.keys(features).length > 0;

    return {
      v: 2,
      columns,
      ...(expanded ? { expanded } : {}),
      ...(hasFeatures ? { features } : {}),
    };
  });

  /**
   * The rendered rows — client-filtered then client-sorted for whichever of
   * `filterMode`/`sortMode` is `'client'`.
   */
  public rows = computed(() => {
    const columns = this.columns();
    // A bound source owns the rows; `data` is what a table without one renders.
    let result: readonly T[] = this.rowsSource()?.rows() ?? this.data();

    if (this.resolvedFilterMode() !== 'server') {
      result = filterRows({ rows: result, filters: this.filters(), columns });
    }

    if (this.resolvedSortMode() !== 'server') {
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

  /** The failure in effect: the `error` input, else whatever a bound {@link rowsSource} reports. */
  public resolvedError = computed(() => this.error() ?? this.rowsSource()?.error?.() ?? null);

  /** Whether there is a failure to show — the error state then stands in for the body. */
  public hasError = computed(() => this.resolvedError() !== null && this.resolvedError() !== undefined);

  /** Whether rows are loading: the `loading` input, or a bound {@link rowsSource} with a request out. */
  public resolvedLoading = computed(() => this.loading() || (this.rowsSource()?.loading?.() ?? false));

  /** Loading with nothing to show yet: placeholder rows stand in for the rows that are coming. */
  protected showPlaceholderRows = computed(() => this.resolvedLoading() && !this.hasError() && !this.rows().length);

  /**
   * Loading over rows that are already on screen: they stay, and the busy bar carries the news. This
   * is the case a paged/refetching table is in most of the time, and blanking it there would cost the
   * user their place for no gain.
   */
  protected showBusyBar = computed(() => this.resolvedLoading() && !this.hasError() && this.rows().length > 0);

  /** The leading utility cells, with the pinning every row kind applies to them. */
  protected leadCells = computed<TableLeadCellVm[]>(() => {
    const pinned = this.hasStickyStart();
    const offsets = this.leadStickyOffsets();

    return this.leadColumns().map((lead) => ({
      key: lead.key,
      cellClass: lead.cellClass,
      sticky: pinned,
      offset: pinned ? (offsets[lead.key] ?? 0) : null,
      lead,
    }));
  });

  protected headerCellVms = computed<TableHeaderCellVm<T>[]>(() => {
    const offsets = this.stickyOffsets();
    const suppressed = this.stickySuppressed();
    const templates = this.columnTemplates().header;
    const labels = this.resolvedLabels();

    return this.visibleColumns().map((column) => {
      const direction = this.sortDirection(column.key);
      // The header announces what the *next* activation does, and the cycle is asc → desc → clear.
      const next = direction === null ? 'asc' : direction === 'asc' ? 'desc' : null;

      return {
        ...this.stickyVmOf(column, { offsets, suppressed }),
        key: column.key,
        column,
        align: column.align ?? 'start',
        sortable: !!column.sortable,
        ariaSort: column.sortable
          ? direction === 'asc'
            ? 'ascending'
            : direction === 'desc'
              ? 'descending'
              : 'none'
          : null,
        sortLabel: column.sortable ? labels.sortAction(column.header ?? column.key, next) : null,
        direction,
        template: templates.get(column.key) ?? null,
      };
    });
  });

  protected bodyRows = computed<TableBodyRowVm<T>[]>(() => {
    const offsets = this.stickyOffsets();
    const suppressed = this.stickySuppressed();
    const templates = this.columnTemplates().cell;
    const columns = this.visibleColumns();
    const leads = this.leadCells();
    const cellState = this.cellState();
    const indexOffset = this.rowIndexOffset();
    const toggledKey = this.userToggledKey();
    const expandable = this.expandable();
    // At most one cell is ever open, so the edit templates are only looked up once there is one.
    const editing = this.cellEditing()?.cell() ?? null;
    const editTemplates = editing ? this.columnTemplates().cellEdit : null;

    return this.renderedRows().map((row, index) => {
      const key = this.rowIdentity(row);
      // Only the row the user just toggled animates; any other (re)mount appears instantly.
      const animated = toggledKey === key;

      return {
        row,
        key,
        index: indexOffset + index,
        classes: leads
          .map((lead) => lead.lead.rowClass?.(row))
          .filter((className): className is string => !!className)
          .join(' '),
        stripe: (indexOffset + index) % 2 === 1,
        showDetail: expandable && this.canExpand(row) && this.isExpanded(row),
        enterAnimation: animated ? 'et-table-detail--enter' : '',
        leaveAnimation: animated ? 'et-table-detail--leave' : '',
        leads,
        cells: columns.map((column) => {
          const value = column.value(row);

          // The callback may answer with the bare state or with a message alongside it.
          const answer = cellState?.(row, column.key) ?? null;
          const state = typeof answer === 'string' ? answer : (answer?.state ?? null);
          const editTemplate =
            editing && editing.row === key && editing.column === column.key
              ? (editTemplates?.get(column.key) ?? null)
              : null;

          return {
            ...this.stickyVmOf(column, { offsets, suppressed }),
            key: column.key,
            align: column.align ?? 'start',
            state,
            message: typeof answer === 'string' ? null : (answer?.message ?? null),
            template: templates.get(column.key) ?? null,
            value,
            context: { $implicit: row, value, index: indexOffset + index },
            edit: editTemplate && editing ? { template: editTemplate, context: editing.context } : null,
          };
        }),
      };
    });
  });

  protected footerCells = computed<TableFooterCellVm[]>(() => {
    const offsets = this.stickyOffsets();
    const suppressed = this.stickySuppressed();
    const templates = this.columnTemplates().footer;

    return this.visibleColumns().map((column) => ({
      ...this.stickyVmOf(column, { offsets, suppressed }),
      key: column.key,
      align: column.align ?? 'start',
      template: templates.get(column.key) ?? null,
    }));
  });

  /** The placeholder rows, in the same tracks as real ones so the layout doesn't jump when data lands. */
  protected placeholderGrid = computed<TablePlaceholderRowVm[]>(() => {
    const columns = this.visibleColumns();
    const leads = this.leadCells();
    const templates = this.columnTemplates().cellSkeleton;

    return Array.from({ length: Math.max(1, this.loadingRows()) }, (_, rowIndex) => ({
      key: rowIndex,
      leads,
      cells: columns.map((column, columnIndex) => {
        // Cycled, not random: a fresh width per pass would make the block twitch.
        const width = PLACEHOLDER_WIDTHS[(rowIndex + columnIndex) % PLACEHOLDER_WIDTHS.length] ?? 60;

        return {
          key: column.key,
          align: column.align ?? 'start',
          width,
          template: templates.get(column.key) ?? null,
          context: { $implicit: rowIndex, width },
        };
      }),
    }));
  });

  /**
   * The height of a real row, remembered from the last time this table had any. Placeholder rows adopt
   * it, so a refetch or a page change keeps the table exactly as tall as the data the user was just
   * looking at. `null` until a row has been rendered — the first load has nothing to measure, which is
   * what `etTableCellSkeleton` is for.
   */
  protected measuredRowHeight = signal<number | null>(null);

  /** Spacer sizes standing in for the rows a window leaves out, or `null` when every row renders. */
  protected spacers = computed(() => {
    const window = this.rowWindow();

    if (!window || !this.rows().length) return null;

    return { start: window.paddingStart(), end: window.paddingEnd() };
  });

  /**
   * The keys of the currently hidden columns, in declared order. Nothing in the table's own chrome
   * shows a hidden column — the column menu's "Hide column" takes one away and has no way back — so
   * this is what an app builds its own "columns" chooser from, together with {@link allColumns},
   * {@link setColumnVisible} and {@link showAllColumns}.
   *
   * @example
   * // a menu of every column, checked when visible
   * for (const column of table.allColumns()) {
   *   … table.isColumnVisible(column.key) … table.toggleColumnVisibility(column.key) …
   * }
   */
  public hiddenColumnKeys = computed(() =>
    this.orderedColumns()
      .filter((column) => this.hiddenColumns().has(column.key))
      .map((column) => column.key),
  );

  /**
   * Every declared column in the current order, hidden ones included — the counterpart to
   * {@link visibleColumns}, and the list a "columns" chooser iterates.
   */
  public allColumns = computed(() => this.orderedColumns());

  constructor() {
    // Remember how tall a real row is, so placeholder rows can match it on the next load. Measured from
    // a rendered body cell (the row itself is `display: contents` and has no box of its own) whenever
    // the rendered rows change — cheap, and the only way to know a row's height when its cells hold
    // arbitrary content. A table that has never had rows keeps `null` and falls back to a text line.
    afterEveryRender(() => {
      const cell = this.firstBodyCellElement();

      if (!cell) return;

      const height = Math.round(cell.getBoundingClientRect().height);

      if (height > 0 && height !== untracked(this.measuredRowHeight)) this.measuredRowHeight.set(height);
    });

    // The detail row's CSS is the biggest block the table has and does nothing without expansion, so it
    // is mounted the first time a table has a detail template rather than shipped in the base sheet.
    // See TableDetailStylesComponent; the style manager de-duplicates across every table in the app.
    effect(() => {
      if (!this.expandable()) return;

      untracked(() => this.styleManager.mount(TableDetailStylesComponent));
    });

    // A bound rows source owns the sort/filter state, but everything here — features, `state()`, the
    // header models — reads `sort()` / `filters()`. Mirror the source into them rather than teaching
    // every reader about two sources of truth. Writes go the other way (see `applySort`), and each
    // branch only sets when the value actually differs, so the two can't ping-pong.
    effect(() => {
      const source = this.rowsSource();

      if (!source) return;

      const sort = source.sort?.();
      const filters = source.filters?.();

      untracked(() => {
        if (sort && !sameJson(sort, this.sort())) this.sort.set([...sort]);
        if (filters && !sameJson(filters, this.filters())) this.filters.set([...filters]);
      });
    });

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
      const suppressed = hasUnpinned && containerWidth > 0 && containerWidth - pinnedWidth < MIN_UNPINNED_SPACE;

      this.stickySuppressed.set(suppressed);

      this.pinnedInsets.set(
        suppressed
          ? { start: 0, end: 0 }
          : { start: hasStartPin ? leadWidth + pinnedStartWidth : 0, end: pinnedEndWidth },
      );
    });

    // The fades depend on the live scroll offset, which no signal tracks — recheck on scroll, and
    // whenever the host or the tracks resize (either can change what overflows).
    effect(() => {
      this.hostDimensions();
      this.templateColumns();
      afterNextRender({ read: () => this.syncScrollFades() }, { injector: this.injector });
    });
  }

  protected syncScrollFades() {
    const element = this.elementRef.nativeElement;
    // `scrollLeft` counts down from 0 in RTL, so compare distances rather than raw offsets.
    const offset = Math.abs(element.scrollLeft);
    const remaining = element.scrollWidth - element.clientWidth - offset;
    const next = { start: offset > SCROLL_FADE_EPSILON, end: remaining > SCROLL_FADE_EPSILON };
    const current = this.scrollFades();

    if (next.start !== current.start || next.end !== current.end) this.scrollFades.set(next);
  }

  /**
   * A template registered for one of a column's slots, or `null`. Part of the feature contract — the
   * filter menu reads its option template through it; consumers register templates instead.
   */
  public columnTemplate(slot: TableTemplateSlot, key: string): TemplateRef<unknown> | null {
    return this.columnTemplates()[slot].get(key) ?? null;
  }

  /**
   * Called by an `etTableCell` / `etTableHeaderCell` / `etTableFooterCell` template to render itself
   * into a column's cells. Part of the template contract; consumers never call this.
   */
  public registerColumnTemplate(registration: TableColumnTemplate) {
    this.columnTemplateList.update((templates) => [...templates, registration]);
  }

  /**
   * Called by a feature to contribute its own serializable state to `state()` / `restoreState()`. Part
   * of the feature contract — see {@link TableFeatureHost}; consumers never call this.
   */
  public registerStateSlice(slice: TableStateSlice) {
    this.stateSliceList.update((slices) => [...slices, slice]);
  }

  /**
   * Called by `etTableCellErrorTooltip` to replace the mark drawn in failed cells. Part of the feature
   * contract — see {@link TableFeatureHost}; consumers never call this.
   */
  public registerCellErrorMark(mark: TableCellErrorMark) {
    this.cellErrorMarkList.update((marks) => [...marks, mark]);
  }

  /** Counterpart to {@link registerColumnTemplate}, called when the template's view is destroyed. */
  public unregisterColumnTemplate(registration: TableColumnTemplate) {
    this.columnTemplateList.update((templates) => templates.filter((entry) => entry !== registration));
  }

  /**
   * Called by an opt-in feature (e.g. `etTableFilters`) to stamp a component into every header cell.
   * Part of the feature contract — see `TableFeatureHost`; consumers never call this.
   */
  public registerHeaderAdornment(adornment: TableHeaderAdornment) {
    this.headerAdornmentList.update((adornments) => [...adornments, adornment]);
  }

  /**
   * Called by an opt-in feature to add a leading utility column (e.g. `etTableSelection`). Part of the
   * feature contract; consumers never call this.
   */
  public registerLeadColumn(column: TableLeadColumn) {
    this.leadColumnList.update((columns) => [...columns, column]);
  }

  /**
   * Called by an opt-in feature to window the rendered rows (`etTableVirtualScroll`). Part of the
   * feature contract; consumers never call this.
   */
  public registerRowWindow(window: TableRowWindow) {
    if (isDevMode() && this.registeredRowWindow()) {
      throw new RuntimeError(
        TABLE_ERROR_CODES.DUPLICATE_ROW_WINDOW,
        '[et-table] Two features tried to window the rows. Use only one row-windowing feature per table.',
      );
    }

    this.registeredRowWindow.set(window);
  }

  /**
   * Called by an opt-in feature to render its own floating UI inside the table (`etTableReorder`'s
   * drag ghost). Part of the feature contract; consumers never call this.
   */
  public registerLayer(layer: TableLayer) {
    this.layerList.update((layers) => [...layers, layer]);
  }

  /**
   * Called by an opt-in feature to take over cell focus (`etTableKeyboardNav`). Part of the feature
   * contract; consumers never call this.
   */
  public registerCellNavigation(navigation: TableCellNavigation) {
    this.cellNavigationList.update((list) => [...list, navigation]);
  }

  /**
   * Called by an opt-in feature to edit cells in place (`etTableInlineEdit`). Part of the feature
   * contract; consumers never call this.
   */
  public registerCellEditing(editing: TableCellEditing) {
    this.cellEditingList.update((list) => [...list, editing]);
  }

  /**
   * Offer a cell to a registered editing feature. Part of the feature contract — it is how
   * `etTableKeyboardNav` hands `Enter` over to `etTableInlineEdit` without either knowing about the
   * other. `false` when nothing took it.
   */
  public editCell(rowIndex: number, columnIndex: number) {
    return this.cellEditing()?.editCell(rowIndex, columnIndex) ?? false;
  }

  /** A rendered body cell, for a feature measuring real row height. Part of the feature contract. */
  public firstBodyCellElement() {
    return this.bodyCells()[0]?.nativeElement ?? null;
  }

  /** Absolute index of the first rendered row. Part of the feature contract. */
  public renderedRowOffset() {
    return this.rowIndexOffset();
  }

  /** Every rendered body cell, rows major. Part of the feature contract. */
  public bodyCellElements() {
    return this.bodyCells().map((cell) => cell.nativeElement);
  }

  /**
   * The rendered body cell at an absolute row index and visible-column index. Part of the feature
   * contract. `null` when the row is outside a window's rendered range — ask {@link scrollRowIntoView}
   * for it first.
   */
  public bodyCellElementAt(rowIndex: number, columnIndex: number) {
    const columns = this.visibleColumns().length;
    const rendered = rowIndex - this.rowIndexOffset();

    if (rendered < 0 || rendered >= this.renderedRows().length) return null;
    if (columnIndex < 0 || columnIndex >= columns) return null;

    // `bodyCells` is every rendered data cell in DOM order, rows major — lead cells carry no `#bodyCell`
    // ref, so the arithmetic doesn't have to know how many of them there are.
    return this.bodyCells()[rendered * columns + columnIndex]?.nativeElement ?? null;
  }

  /**
   * Bring an absolute row index into view. Part of the feature contract. Returns `true` when a
   * registered window did it — the row is then only rendered after the next change detection, which is
   * what the caller has to wait for.
   */
  public scrollRowIntoView(rowIndex: number) {
    const window = this.rowWindow();

    if (window?.scrollToIndex) {
      window.scrollToIndex(rowIndex);

      return true;
    }

    // Every row is rendered, so the element itself knows how to get on screen. `nearest` keeps a cell
    // that is already visible exactly where it is instead of jumping it to an edge.
    this.bodyCellElementAt(rowIndex, 0)?.parentElement?.scrollIntoView({ block: 'nearest' });

    return false;
  }

  /** How many rows fit the scroll viewport. Part of the feature contract — the PageUp/PageDown step. */
  public rowsPerPage() {
    const rowHeight = this.measuredRowHeight() ?? this.firstBodyCellElement()?.offsetHeight ?? 0;
    const viewport = this.elementRef.nativeElement.clientHeight;

    if (!rowHeight || !viewport) return 1;

    return Math.max(1, Math.floor(viewport / rowHeight) - 1);
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

    // Hand each feature its own slice back. A slice with no matching feature (it wasn't imported here)
    // is left alone rather than dropped, so a round-trip through a table that lacks a feature doesn't
    // erase that feature's state elsewhere.
    for (const slice of this.stateSliceList()) {
      const value = next.features?.[slice.key];

      if (value !== undefined) slice.write(value);
    }
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
      this.applySort([...others, { key, direction: 'asc' }]);
    } else if (direction === 'asc') {
      this.applySort([...others, { key, direction: 'desc' }]);
    } else {
      this.applySort(others);
    }
  }

  /**
   * Set a column's sort direction outright, or clear it with `null` — what a column menu's explicit
   * "Sort ascending / descending / Clear" entries need, where {@link toggleSort}'s cycle would make
   * the result depend on the column's current state. Honours `multiSort` the same way.
   */
  public setSort(key: string, direction: TableSortDirection | null) {
    const others = this.multiSort() ? this.sort().filter((entry) => entry.key !== key) : [];

    this.applySort(direction ? [...others, { key, direction }] : others);
  }

  /** Whether a column carries a user width override (a resize), i.e. whether there is one to reset. */
  public hasColumnWidthOverride(key: string) {
    return this.columnWidths()[key] !== undefined;
  }

  /** The selected filter values for a column key (empty when unfiltered). */
  public filterValuesFor(key: string): unknown[] {
    return this.filters().find((entry) => entry.key === key)?.values ?? [];
  }

  /** Replace a column's selected filter values (drops the entry when empty). */
  public setFilterValues(key: string, values: unknown[]) {
    const others = this.filters().filter((entry) => entry.key !== key);
    const next = values.length ? [...others, { key, values }] : others;
    const source = this.rowsSource();

    if (source?.setFilters) {
      source.setFilters(next);

      return;
    }

    this.filters.set(next);
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

  /** Show every hidden column again, in one go. */
  public showAllColumns() {
    this.hiddenColumns.update((hidden) => (hidden.size ? new Set<string>() : hidden));
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
  /** Whether a row can expand — expansion is on and the row passes `expandableRow`. */
  public canExpand(row: T) {
    return this.expandable() && (this.expandableRow()?.(row) ?? true);
  }

  /**
   * The animation class for a detail row's enter/leave, or `''` to mount/unmount it instantly.
   *
   * Only the row the user just toggled animates. A detail row also mounts and unmounts when the rows
   * themselves change — paging away and back, sorting, a query refresh — and animating those replays
   * an open/close the user never asked for (and pays the layout cost mid page-change).
   */
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
  public rowIdentity(row: T): unknown {
    const rowKey = this.rowKey();

    return rowKey ? String(rowKey(row)) : row;
  }

  /** The table's own element. Part of the feature contract (a feature is a directive on it). */
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
   * the feature contract — `etTableReorder` commits a drop with it.
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
   * The column's current rendered header width in px. Part of the feature contract — `etTableResize`
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
    const clamped = Math.min(max, Math.max(this.minWidthOf(key), Math.round(width)));

    this.columnWidths.update((widths) => ({ ...widths, [key]: clamped }));
  }

  /**
   * The narrowest a column may be: its own `minWidth`, else {@link MIN_COLUMN_WIDTH}. One source for
   * both floors a column has — the flexible track's, and how far a resize drag may go — so the two
   * can't disagree.
   */
  public minWidthOf(key: string) {
    return this.columnsByKey().get(key)?.minWidth ?? MIN_COLUMN_WIDTH;
  }

  /**
   * Fit columns to their widest rendered content, then keep that as a width override.
   *
   * Measured by letting the tracks out to `max-content` for one frame and reading back what the
   * browser gave them, rather than by adding up text metrics — that way arbitrary cell content (a
   * badge, an avatar, a nested component) is measured as it actually lays out, and the cell's own
   * padding is included for free. Only *rendered* rows count, so on a virtualized table this fits the
   * current window, as it must: the rows outside it have no width to measure.
   */
  public autosizeColumns(keys: readonly string[]) {
    const measurable = keys.filter((key) => this.columnsByKey().has(key));

    if (!measurable.length) return;

    this.autosizing.set(new Set(measurable));

    afterNextRender(
      {
        read: () => {
          // Read every width before writing any, so committing the first doesn't reflow the rest.
          const measured = measurable.map((key) => [key, Math.ceil(this.renderedColumnWidth(key))] as const);

          this.autosizing.set(new Set());

          for (const [key, width] of measured) {
            if (width > 0) this.setColumnWidth(key, width);
          }
        },
      },
      { injector: this.injector },
    );
  }

  /** Fit one column to its widest rendered content — see {@link autosizeColumns}. */
  public autosizeColumn(key: string) {
    this.autosizeColumns([key]);
  }

  /** Fit every visible column to its widest rendered content — see {@link autosizeColumns}. */
  public autosizeAllColumns() {
    this.autosizeColumns(this.visibleColumns().map((column) => column.key));
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

  /** A column's effective pinning, or `null` when it isn't pinned or pinning is suppressed (see {@link stickySuppressed}). */
  public effectiveSticky(column: TableColumnDef<T>): 'start' | 'end' | null {
    return this.stickySuppressed() ? null : (column.sticky ?? null);
  }

  /**
   * The one place sort state is written. A bound {@link rowsSource} owns it — it resets the page and
   * refetches — and its own value syncs back into `sort` (see the constructor), so everything else can
   * keep reading `sort()` whichever drives it.
   */
  private applySort(sort: TableSort[]) {
    const source = this.rowsSource();

    if (source?.setSort) {
      source.setSort(sort);

      return;
    }

    this.sort.set(sort);
  }

  // ── Render models ───────────────────────────────────────────────────────
  // See the `…Vm` types above: everything the template binds is resolved here, so a binding is a field
  // read rather than a call the framework has to repeat on every change-detection pass.

  /** A column's pinning and offsets, shared by its header, body and footer cells. */
  private stickyVmOf(
    column: TableColumnDef<T>,
    pinning: { offsets: StickyOffsets; suppressed: boolean },
  ): TableStickyVm {
    const { offsets, suppressed } = pinning;

    const sticky = suppressed ? null : (column.sticky ?? null);

    return {
      stickyStart: sticky === 'start',
      stickyEnd: sticky === 'end',
      offsetStart: suppressed ? null : (offsets.start[column.key] ?? null),
      offsetEnd: suppressed ? null : (offsets.end[column.key] ?? null),
    };
  }

  // The row key whose expansion the user just toggled, cleared once the animation has run. Compared
  // by identity in `bodyRows`, so any other (re-)mount of a detail row skips its animation.
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
