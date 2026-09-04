import { DOCUMENT, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
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
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, merge, Subscription, take, tap, timer } from 'rxjs';
import {
  injectColorThemes,
  injectRenderer,
  injectStyleManager,
  ProvideColorDirective,
  RuntimeError,
  signalDeferredLoading,
  signalHostElementDimensions,
} from '@ethlete/core';
import { ARROW_UP_ICON } from '../icon/headless/arrow-up-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import { TRIANGLE_EXCLAMATION_ICON } from '../icon/headless/triangle-exclamation-icon';
import {
  ReconcilableColumn,
  reconcileColumnOrder,
  reconcileColumnWidths,
  reconcileHiddenColumns,
} from './headless/table-column-state';
import { TableCardSurfaceDirective } from './table-card-surface.directive';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableRowBoxStylesComponent } from './table-row-box-styles.component';
import {
  TABLE_FEATURE_HOST,
  TableCellErrorMark,
  TableHeaderAdornment,
  TableLayer,
  TableLeadColumn,
  TableCellEditing,
  TableCellNavigation,
  TableBodyPlaceholder,
  TableCellPinning,
  TableCellPlaceholder,
  TableColumnPinning,
  TableHeaderRow,
  TablePageStickyHeader,
  TableRowDetail,
  TableRowNavigation,
  TableRowWindow,
  TableStateSlice,
} from './headless/table-features';
import { filterRows } from './headless/table-filter';
import { TableFooterDirective } from './headless/table-footer.directive';
import { TableRowsSource } from './headless/table-rows-source';
import { injectTableLabels, TableLabels } from './headless/table-labels';
import { sortRows } from './headless/table-sort';
import { isRestorableTableState } from './headless/table-state-url';
import {
  TableCellContext,
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
  TableRowLink,
  TableSort,
  TableSortDirection,
  TableState,
  TableTemplateSlot,
} from './table.types';

/**
 * The rendered shape of the table, resolved from the signals **before** the template runs.
 *
 * The template binds fields, never calls methods: a method in a binding re-runs on every change
 * detection with nothing to memoize it, and in a table that means row-count × column-count calls per
 * pass. Each `…Vm` below is one `computed`, so the same work happens once per actual change and the
 * template is a plain projection of it. (Event bindings still call methods - that's the one place a
 * call belongs.)
 */
/** One leading utility cell (selection, expander) - identical chrome in every row kind. */
type TableLeadCellVm = {
  key: string;
  cellClass: string;
  sticky: boolean;
  offset: number | null;
  lead: TableLeadColumn;
};

type TableHeaderCellVm<T> = TableCellPinning & {
  key: string;
  column: TableColumnDef<T>;
  align: string;
  sortable: boolean;
  disabled: boolean;
  ariaSort: 'ascending' | 'descending' | 'none' | null;
  sortLabel: string | null;
  direction: TableSortDirection | null;
  template: TemplateRef<unknown> | null;
  /** Whether the column has scrolled behind a pinned one, which its adornments must not outlive. */
  obscured: boolean;
};

type TableBodyCellVm<T> = TableCellPinning & {
  key: string;
  align: string;
  /** Whether this is the cell that names the row's link - at most one per row, and only when it has one. */
  linkHost: boolean;
  /** Whether the column says it holds its own controls, which a row link's hit area then stays out of. */
  interactive: boolean;
  state: TableCellState | null;
  /** What went wrong, when the callback said - shown on the mark. */
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
  /** The row's absolute index in `rows()` - true even while a virtual window renders a slice. */
  index: number;
  /** `rowIdentity`'s result - what `@for` tracks by. */
  key: unknown;
  classes: string;
  stripe: boolean;
  /** Whether the table ends here, so this row's rule would close it with a line hanging under it. */
  last: boolean;
  /** Where this row links to (see `rowLink`), or `null` for a row that links nowhere. */
  link: TableRowLink | null;
  /** The `href` the row's anchor carries - the link itself, or a navigator's resolution of it. */
  href: string | null;
  /** Id of the cell naming the link, which names the (textless) anchor via `aria-labelledby`. */
  linkLabelId: string;
  /** The registered detail row to stamp under this row, while it is open. */
  detail: TableRowDetail | null;
  leads: TableLeadCellVm[];
  cells: TableBodyCellVm<T>[];
  trails: TableLeadCellVm[];
};

type TableFooterCellVm = TableCellPinning & {
  key: string;
  align: string;
  template: TemplateRef<unknown> | null;
};

/**
 * Default narrowest width (px) a column may end up at, whether dragged there or squeezed there by a
 * wider neighbour. Sized so the header still reads: a cell spends 24px on its own inline padding and
 * up to another 24px on a column-menu trigger, so anything much under this is all chrome and no
 * label. A column that genuinely needs less says so with `minWidth`.
 */
const MIN_COLUMN_WIDTH = 96;

/**
 * The default track for a column: it shares out the leftover room, but never shrinks past its floor -
 * which is what stops one wide (or resized) column from squeezing its neighbours down to their
 * padding and out of sight. Past that point the table scrolls instead, which the scroll fades
 * advertise.
 */
const defaultTrack = (minWidth: number) => `minmax(${minWidth}px, 1fr)`;

/**
 * Trailing track that soaks up the room left over by all-rigid columns - see
 * {@link TableComponent.hasFiller}. Slack, not a column, so unlike {@link DEFAULT_TRACK} it has no
 * floor: it must be free to collapse to nothing.
 */
const FILLER_TRACK = 'minmax(0, 1fr)';

/**
 * Whether a `grid-template-columns` track grows into leftover space: `auto` tracks are stretched by
 * the grid's default `justify-content: normal`, and `fr` tracks are flexible by definition.
 */
const isFlexibleTrack = (track: string) => /\bauto\b|[\d.]fr\b/.test(track);

/**
 * Cheap structural comparison for the small, plain state lists the table mirrors (sort entries, filter
 * values). Enough to stop an equal-but-new array from being written back - see the mirroring effect.
 */
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Sub-pixel slack (px) before a scroll offset counts as "there is content over there". */
const SCROLL_FADE_EPSILON = 1;

/** Sort indicator enter duration (must match the CSS animation) - see {@link TableComponent.sortIndicatorEnter}. */
const SORT_INDICATOR_ANIMATION_MS = 150;

/** What a cell renders as when nothing pins columns - see `registerColumnPinning`. */
const NO_PIN: TableCellPinning = { stickyStart: false, stickyEnd: false, offsetStart: null, offsetEnd: null };

/** The same for a leading utility cell, and for the scroll fades' inline offsets. */
const NO_LEAD_PIN = { sticky: false, offset: null };
const NO_INSET = { start: 0, end: 0 };
const EMPTY_COLUMN_KEYS: ReadonlySet<string> = /* @__PURE__ */ new Set();

/** Each `rowsSource` state signal with the setter it needs and the column flag whose UI writes it. */
const UNPAIRED_ROWS_SOURCE_CHECKS = [
  ['sort', 'setSort', 'sortable'],
  ['filters', 'setFilters', 'filterable'],
] as const;

// Per-table counter, so the ids a row link is named by are unique across every table on the page.
let uniqueTableId = 0;

/**
 * The default table. Renders typed rows and cells from a {@link TableColumns}
 * record on a CSS grid with a sticky header and an empty state. Light by
 * default - sort, filter, expansion, reordering, virtualization and state
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
  imports: [NgComponentOutlet, NgTemplateOutlet, IconDirective, ProvideColorDirective, TableCardSurfaceDirective],
  providers: [
    { provide: TABLE_FEATURE_HOST, useExisting: TableComponent },
    provideIcons(ARROW_UP_ICON, TRIANGLE_EXCLAMATION_ICON),
  ],
  host: {
    class: 'et-table-host',
    '[attr.data-appearance]': 'appearance()',
    '[attr.data-density]': 'density()',
    '[attr.aria-busy]': 'resolvedLoading() ? "true" : null',
    '[attr.role]': 'pageStickyHeader() ? "grid" : null',
    '[class.et-table-host--scrolled-block-start]': 'blockScrollShadows().blockStart',
    '[class.et-table-host--scrolled-block-end]': 'blockScrollShadows().blockEnd',
    '[class.et-table-host--scrolled-inline-start]': 'scrollFades().start',
    '[class.et-table-host--scrolled-inline-end]': 'scrollFades().end',
    '[class.et-table-host--header-adornments]': 'headerAdornments().length > 0',
    '[style.--_et-table-viewport-inline-size.px]': 'viewportInlineSize()',
    '(scroll)': 'syncScrollState()',
  },
})
export class TableComponent<T> {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  private injectedLabels = injectTableLabels();
  private renderer = injectRenderer();

  /** The rows to render. */
  public data = input<readonly T[]>([]);

  /**
   * A rows source to drive the table from - what `tableRowsFromQuery` / `tableRowsFromV2Query` return,
   * or any object of that shape. It supplies `data`, `loading` and `error`, and takes the table's sort
   * and filter changes back through its own setters, so one binding replaces six.
   *
   * Because such a source has already sorted and filtered on the server, `sortMode` and `filterMode`
   * default to `'server'` while one is bound - set them explicitly to override.
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
   * {@link provideTableLabels} for app-wide localization; use this for a one-off. Partial - omitted
   * keys keep the provided/default value.
   */
  public labels = input<Partial<TableLabels> | null>(null);

  /**
   * Whether the rows are being loaded. Over rows that are already on screen it keeps them readable and
   * runs a busy bar under the header, so a refetch doesn't blank the table the user is reading; with
   * nothing to show yet the body is left to whatever renders a loading state - `etTableSkeleton` draws
   * placeholder rows, and without it the body simply stays empty. The host carries `aria-busy` either
   * way. @default false
   */
  public loading = input(false, { transform: booleanAttribute });

  /**
   * The load's failure, if any - anything non-nullish counts (an `HttpErrorResponse`, a message, a
   * flag), so it takes a query's `error` signal as-is. Set, it replaces the body with the error
   * state: stale rows under an unreported failure are worse than an honest empty table. Say more than
   * the `error` label with {@link errorTemplate} (which gets the error) or a projected `[etTableError]`.
   */
  public error = input<unknown>(null);

  /**
   * Body content for the empty state, in place of the `empty` label. Context: `{ $implicit: rows }` -
   * the (empty) row list, so one template can serve "nothing here" and "nothing matches your filters".
   * Takes precedence over projected `[etTableEmpty]` content.
   */
  public emptyTemplate = input<TemplateRef<TableEmptyContext<T>>>();

  /**
   * Body content for the error state, in place of the `error` label. Context: `{ $implicit: error }` -
   * whatever was bound to {@link error} - so the template can render the message and a retry.
   * Takes precedence over projected `[etTableError]` content.
   */
  public errorTemplate = input<TemplateRef<TableErrorContext>>();

  /**
   * Per-cell async state, for a cell that loads or fails on its own (inline editing). Return
   * `'loading'` to replace that cell's content with a placeholder bar, `'error'` to mark it, or
   * `null`/nothing for a normal cell. Return `{ state: 'error', message }` and the message rides
   * along on the mark - as its `title` and accessible name, or as a tooltip with
   * `etTableCellErrorTooltip`. Resolved once per rendered cell (see `bodyRows`), but keep it cheap
   * anyway - a map lookup, not a search.
   */
  public cellState = input<(row: T, key: string) => TableCellStateValue | null | undefined>();

  /**
   * The table's visual frame. `'enclosed'` (default) is a bordered, rounded surface panel with a
   * tinted header band; `'divided'` is borderless with row dividers; `'zebra'` stripes rows; `'grid'`
   * draws full cell borders; `'bare'` has no chrome; `'cards'` gives every row a box of its own - a
   * rounded card on a surface one elevation above the table's, spaced by `--et-table-row-gap`.
   * @default 'enclosed'
   */
  public appearance = input<'enclosed' | 'divided' | 'zebra' | 'grid' | 'bare' | 'cards'>('enclosed');

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
   * The detail template rendered as a full-width row when a row is expanded. Context:
   * `{ $implicit: row }`. Nest another `<et-table>` here for sub-tables.
   *
   * It stays a table input rather than an option on {@link TableRowExpansionDirective} because only the
   * table knows the row type, which is what types the template's `let-row`. **Rendering it needs
   * `etTableRowExpansion`** - the expander column, the detail row and its animation ship with the
   * feature, so a table that never expands a row carries none of it.
   */
  public expandedRowTemplate = input<TemplateRef<TableExpandedRowContext<T>>>();

  /**
   * Make whole rows respond to clicks: adds a hover/pointer affordance and emits {@link rowClick}
   * (clicks landing on interactive cell content are ignored - see `rowClick`). For a row that
   * navigates, prefer {@link rowLink} - a real link, not a click handler. @default false
   */
  public rowInteractive = input(false, { transform: booleanAttribute });

  /**
   * Make every row a link, by saying where it goes: an `href` the browser follows, or the router
   * commands to navigate to - which need `etTableRowRouterLink` on the table, since the base table
   * depends on no router. Answer `null` for a row that links nowhere.
   *
   * The table renders **one** real `<a href>` per row and stretches it over the row, so middle click,
   * Ctrl/Cmd-click, "open in a new tab" and "copy link address" all work - none of which a
   * {@link rowInteractive} click handler can offer. The anchor sits in the first column that holds no
   * controls of its own and takes its accessible name from that cell, which keeps the row one link in
   * the accessibility tree and one stop in the tab order.
   *
   * A cell with a control in it keeps its clicks: the selection and expander cells always, and any
   * column that declares `interactive: true`.
   *
   * @example
   * <et-table [rowsSource]="source" [columns]="columns()" [rowLink]="orderLink" etTableRowRouterLink />
   *
   * protected orderLink = (order: Order) => ['/orders', order.id];
   */
  public rowLink = input<(row: T) => TableRowLink | null | undefined>();

  /**
   * Emitted when an interactive row (see {@link rowInteractive}) is clicked, with the row as payload.
   * Clicks originating from interactive descendants - buttons, links, inputs, selects, a menu trigger,
   * and the selection/expander cells - are ignored, so in-row controls keep working. The table bakes
   * in no navigation; call `router.navigate` (etc.) yourself. For crawlable per-row links, render a
   * real `<a>` in a cell instead.
   */
  public rowClick = output<T>();

  // Whether the consumer projected an `[etTableFooter]` slot, so its chrome (border, sticky bar)
  // renders only when there's actually footer content.
  protected footerSlot = contentChild(TableFooterDirective);

  private gridRef = viewChild<ElementRef<HTMLElement>>('grid');

  private headerGridRef = viewChild<ElementRef<HTMLElement>>('headerGrid');

  private scrollerRef = viewChild<ElementRef<HTMLElement>>('scroller');

  private headerCells = viewChildren<ElementRef<HTMLElement>>('headerCell');

  // Every rendered body cell (tagged with `data-col-key`); the first drives virtual-window
  // measurement, and they're grouped by column to animate a column shift on reorder drop.
  private bodyCells = viewChildren<ElementRef<HTMLElement>>('bodyCell');

  // The rendered lead-column header cells, in lead-column order - measured so each lead column and
  // the pinned data columns know how far in they start.
  private leadHeaderCells = viewChildren<ElementRef<HTMLElement>>('leadHeaderCell');

  // The same for the trailing utility columns, stacked from the trailing edge instead.
  private trailHeaderCells = viewChildren<ElementRef<HTMLElement>>('trailHeaderCell');

  // Base of the ids a row link is named by - one per table, so two tables on a page can't collide.
  private readonly LINK_ID_PREFIX = `et-table-${uniqueTableId++}-row-link`;

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

  // UI contributed by opt-in features (filter menus, resize grips), rendered in every header cell.
  // Features register themselves (see TABLE_FEATURE_HOST) rather than being queried, so the table
  // never references a feature's dependencies - that's what keeps them out of an unused bundle.
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

  // How a feature follows a row link given as router commands (etTableRowRouterLink). Null until one
  // registers, which is what keeps the router out of a table that links with plain hrefs - or not at all.
  private rowNavigationList = signal<TableRowNavigation[]>([]);

  private rowNavigation = computed(
    () => this.rowNavigationList().find((navigation) => navigation.enabled?.() ?? true) ?? null,
  );

  // Floating UI contributed by features (the reorder drag ghost). The table hosts it so a feature
  // never needs a view - and never an element - of its own.
  private layerList = signal<TableLayer[]>([]);

  protected layers = computed(() => this.layerList().filter((layer) => layer.enabled?.() ?? true));

  // Rows a feature renders above the column headers (the spanning group-header row).
  private headerRowList = signal<TableHeaderRow[]>([]);

  private pageStickyHeaderList = signal<TablePageStickyHeader[]>([]);

  protected pageStickyHeader = computed(
    () => this.pageStickyHeaderList().find((header) => header.enabled()) !== undefined,
  );

  protected headerRows = computed(() => this.headerRowList().filter((row) => row.enabled?.() ?? true));

  // How a feature pins columns (etTableStickyColumns). Null until one registers, which is what keeps
  // the measuring and the edge shadows out of a table that pins nothing.
  private columnPinningList = signal<TableColumnPinning[]>([]);

  private columnPinning = computed(
    () => this.columnPinningList().find((pinning) => pinning.enabled?.() ?? true) ?? null,
  );

  // What a feature renders in place of the body while loading with no rows yet (etTableSkeleton).
  private bodyPlaceholderList = signal<TableBodyPlaceholder[]>([]);

  protected bodyPlaceholder = computed(
    () => this.bodyPlaceholderList().find((placeholder) => placeholder.enabled?.() ?? true) ?? null,
  );

  // A feature's stand-in for the content of a cell that is loading on its own. Null until one registers,
  // which is what keeps the skeleton bone out of a table that never shows one.
  private cellPlaceholderList = signal<TableCellPlaceholder[]>([]);

  protected cellPlaceholder = computed(
    () => this.cellPlaceholderList().find((placeholder) => placeholder.enabled?.() ?? true) ?? null,
  );

  // A registered detail row (etTableRowExpansion). Null until one registers, which is what keeps the
  // expander cell, the detail row's chrome and its animation out of a table that never expands.
  private rowDetailList = signal<TableRowDetail[]>([]);

  private rowDetail = computed(() => this.rowDetailList().find((detail) => detail.enabled?.() ?? true) ?? null);

  // Leading utility columns from features (selection), plus the table's own expander column when a
  // detail template is set. One generic loop per row kind renders them all.
  private leadColumnList = signal<TableLeadColumn[]>([]);

  // A registered row window (virtual scrolling); `null` renders every row.
  private registeredRowWindow = signal<TableRowWindow | null>(null);

  // A feature that owns cell focus (etTableKeyboardNav). While one is live the body's cells become the
  // focus targets, which is the one thing the base has to know about: a focusable cell needs a
  // `tabindex`, and the row must stop being a tab stop of its own or the body would have two.
  private cellNavigationList = signal<TableCellNavigation[]>([]);

  /** Whether a feature has taken over cell focus - see {@link registerCellNavigation}. */
  public cellNavigation = computed(() =>
    this.cellNavigationList().some((navigation) => navigation.enabled?.() ?? true),
  );

  // A feature that edits cells in place (etTableInlineEdit). The base knows only which cell is open and
  // what to render in it - the session, the draft and the commit are all the feature's.
  private cellEditingList = signal<TableCellEditing[]>([]);

  private cellEditing = computed(() => this.cellEditingList().find((editing) => editing.enabled?.() ?? true) ?? null);

  private rowWindow = computed(() => {
    const window = this.registeredRowWindow();

    return window && (window.enabled?.() ?? true) ? window : null;
  });

  // Inline-start offset for the auto-pinned expander column (it sits after the select column).
  // Recompute sticky-column offsets when the host resizes (column widths change).
  private hostDimensions = signalHostElementDimensions();

  // Columns whose track is let out to `max-content` for one frame so it can be measured. Empty except
  // during an `autosizeColumns` pass.
  private autosizing = signal<ReadonlySet<string>>(new Set());

  /** Where content is currently scrolled out of view horizontally. */
  public scrollFades = signal<{ start: boolean; end: boolean }>({ start: false, end: false });

  /** The columns currently covered by a pinned one - see {@link syncObscuredColumns}. */
  private obscuredColumns = signal<ReadonlySet<string>>(EMPTY_COLUMN_KEYS);

  /**
   * Whether rows are currently passing under the sticky header, and whether more follow under the footer
   * bar. Both edges cut a row off mid-height - on `cards`, mid-card - and a cut with nothing to explain
   * it reads as a broken box, so each edge casts a shadow while there is something behind it.
   */
  protected blockScrollShadows = signal<{ blockStart: boolean; blockEnd: boolean }>({
    blockStart: false,
    blockEnd: false,
  });

  /** The inline offset (px) each edge gradient is pushed in by, so it clears any pinned columns. */
  protected fadeInset = computed(() => this.columnPinning()?.insets() ?? NO_INSET);

  /**
   * The scroll viewport's own inline size, published as a custom property for the rules that have to
   * span it rather than the tracks - the empty and the error message. A row spans every column, which
   * on a table wider than its viewport is not where the reader is looking.
   */
  protected viewportInlineSize = computed(() => this.hostDimensions().client?.width ?? null);

  /**
   * Which edge gradients actually show. A gradient marks the boundary rows slide out under - so an edge
   * that pins a column has one already: the pinned cells' own edge shadow, drawn per row. Two marks on
   * the same boundary read as a smear, and the gradient is the one that has to go: it spans the whole
   * grid, so on `cards` it paints across the gaps between them as well.
   */
  protected visibleScrollFades = computed(() => {
    const scrolled = this.scrollFades();
    const inset = this.fadeInset();

    return { start: scrolled.start && inset.start === 0, end: scrolled.end && inset.end === 0 };
  });

  // The declared columns paired with their keys, in declaration order - the form everything else
  // (rendering, features, state) works with. Keys are the record's, so they can't collide.
  private columnDefs = computed<TableColumnDef<T>[]>(() =>
    Object.entries(this.columns()).map(([key, column]) => ({ ...column, key })),
  );

  // Column order, visibility and user-resized widths (px). All three are reconciled rather than
  // reset when the `columns` input changes identity, so a reorder / resize / hidden column (or a
  // restoreState()) survives a consumer rebuilding its definitions - see `table-column-state.ts`.
  private columnOrder = linkedSignal<TableColumnDef<T>[], string[]>({
    source: () => this.columnDefs(),
    computation: (columns, previous) =>
      reconcileColumnOrder(
        columns.map((column) => column.key),
        previous?.value,
      ),
  });
  // A restore that lands before the `columns` input is populated - a consumer building its columns
  // from the same request that carries the stored state - has no previous source to reconcile against,
  // so every column would read as never-seen and take its declared `hidden`, discarding the restore.
  // What the restore spoke about stands in for the source in that one case.
  private restoredColumns: ReconcilableColumn[] = [];
  private hiddenColumns = linkedSignal<TableColumnDef<T>[], Set<string>>({
    source: () => this.columnDefs(),
    computation: (columns, previous) =>
      reconcileHiddenColumns(
        columns,
        previous && {
          columns: previous.source.length ? previous.source : this.restoredColumns,
          hidden: previous.value,
        },
      ),
  });
  /**
   * The user's width overrides (px) per column. Public because it is part of the feature contract -
   * `etTableStickyColumns` re-measures its offsets when a resize changes the tracks without changing the
   * host's size, which is the one thing no other signal reports.
   */
  public columnWidths = linkedSignal<TableColumnDef<T>[], Record<string, number>>({
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
            { element: this.elementRef.nativeElement },
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

  /** Whether any visible column has a registered footer cell (drives the sticky footer row). */
  public hasFooter = computed(() => {
    const footers = this.columnTemplates().footer;

    return this.visibleColumns().some((column) => footers.has(column.key));
  });

  // Every live utility column, in render order within its own side.
  private utilityColumns = computed<TableLeadColumn[]>(() =>
    this.leadColumnList()
      .filter((lead) => lead.enabled?.() ?? true)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  );

  /** The leading utility columns in render order - whatever features registered (selection, expansion). */
  public leadColumns = computed<TableLeadColumn[]>(() =>
    this.utilityColumns().filter((column) => (column.side?.() ?? 'start') === 'start'),
  );

  /** The trailing utility columns in render order - those a feature registered with `side: 'end'`. */
  public trailColumns = computed<TableLeadColumn[]>(() =>
    this.utilityColumns().filter((column) => column.side?.() === 'end'),
  );

  /**
   * The column tracks, plus whether they are all rigid.
   *
   * A track that is `auto` or flexible (`fr`) soaks up whatever room is left over, so such a grid
   * always fills its container. Once every column carries a fixed length - which is what resizing
   * every column does - that stops being true, and the table's chrome (header band, row dividers,
   * vertical rules) would stop at the last column instead of at the panel's edge. {@link hasFiller}
   * is the fix.
   */
  private columnTracks = computed(() => {
    const widths = this.columnWidths();
    const measuring = this.autosizing();
    const tracks = this.visibleColumns().map((column) => {
      // Mid-autosize this column is let out to its content so it can be measured - see `autosizeColumns`.
      if (measuring.has(column.key)) return 'max-content';

      const resized = widths[column.key];

      return resized !== undefined ? `${resized}px` : (column.width ?? defaultTrack(this.minWidthOf(column.key)));
    });

    // An end-pinned column already owns the trailing edge of the scroll viewport; a slack track
    // between it and that edge would only strand it away from the last real column. Nor during a
    // measurement pass: `max-content` isn't flexible, so it would otherwise add - and immediately
    // drop - a filler cell in every row for that one frame.
    const fixed =
      tracks.length > 0 &&
      !measuring.size &&
      !tracks.some(isFlexibleTrack) &&
      !(this.columnPinning()?.hasStickyEnd() ?? false);

    // Utility columns bracket the data columns, in registration order (see `leadColumns`). Their widths
    // are px, not rem: they must fit their control (a 24px button / 16px checkbox plus the cell's 4px
    // inline padding) regardless of the host app's root font size. A trailing one goes after the filler,
    // so the slack sits between the data and it rather than pushing it off the panel's edge.
    const leads = this.leadColumns().map((lead) => lead.width);
    const trails = this.trailColumns().map((trail) => trail.width);

    return {
      template: [...leads, ...tracks, ...(fixed ? [FILLER_TRACK] : []), ...trails].join(' '),
      fixed,
    };
  });

  /** The `grid-template-columns` value for the visible columns (plus a leading expander track when expandable). */
  public templateColumns = computed(() => this.columnTracks().template);

  private resolvedPageHeaderColumns = signal<string | null>(null);

  protected pageHeaderColumns = computed(() => this.resolvedPageHeaderColumns() ?? this.templateColumns());

  /**
   * Whether a trailing filler track is in play. It carries an empty cell in every row so the header
   * band, row dividers and vertical rules run to the panel's edge instead of stopping at the last
   * rigid column.
   */
  protected hasFiller = computed(() => this.columnTracks().fixed);

  // Set while the sort the user just asked for renders, cleared once its animation has run. A sort that
  // arrives from a URL, a restored state or a bound source mounts the arrow too, and that one has to
  // appear already there rather than fade in over a table the reader is still taking in.
  private sortGesture = signal(false);
  private sortGestureReset: Subscription | undefined;

  /** The arrow's enter animation, empty unless the sort was a gesture on this table. */
  protected sortIndicatorEnter = computed(() => (this.sortGesture() ? 'et-table-sort-indicator--enter' : ''));

  /** The same for the arrow of a column the gesture unsorted. */
  protected sortIndicatorLeave = computed(() => (this.sortGesture() ? 'et-table-sort-indicator--leave' : ''));

  /** The serializable, versioned table state - column order, visibility, sort, filters and feature slices. */
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

    // Whatever the imported features own (a selection, the expanded rows). Absent when no feature
    // contributed, so a plain table's state is exactly what it was before the bag existed.
    const slices = this.stateSliceList();
    const features: Record<string, unknown> = {};

    for (const slice of slices) {
      const value = slice.read();

      if (value !== undefined) features[slice.key] = value;
    }

    const hasFeatures = Object.keys(features).length > 0;

    return {
      v: 3,
      columns,
      ...(hasFeatures ? { features } : {}),
    };
  });

  /**
   * The rendered rows - client-filtered then client-sorted for whichever of
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

  /** The rows actually rendered - a registered row window's slice (virtual scrolling), or all of them. */
  public renderedRows = computed<readonly T[]>(() => {
    const window = this.rowWindow();
    const rows = this.rows();

    return window ? (window.slice(rows) as readonly T[]) : rows;
  });

  /** Absolute index of the first rendered row, so cell contexts keep true row indices while windowed. */
  public rowIndexOffset = computed(() => this.rowWindow()?.offset() ?? 0);

  /** The failure in effect: the `error` input, else whatever a bound {@link rowsSource} reports. */
  public resolvedError = computed(() => this.error() ?? this.rowsSource()?.error?.() ?? null);

  /** Whether there is a failure to show - the error state then stands in for the body. */
  public hasError = computed(() => this.resolvedError() !== null && this.resolvedError() !== undefined);

  /** Whether rows are loading: the `loading` input, or a bound {@link rowsSource} with a request out. */
  public resolvedLoading = computed(() => this.loading() || (this.rowsSource()?.loading?.() ?? false));

  /**
   * How many rows exist in total, when a bound {@link rowsSource} knows - `null` for a table given its
   * rows outright, which by definition holds all of them. Nothing renders it: it exists so a
   * [CSV export](/components/table#exporting-more-than-the-loaded-page) can tell that it would write
   * one page of many.
   */
  public totalRows = computed(() => this.rowsSource()?.total?.() ?? null);

  /** Loading with nothing to show yet: placeholder rows stand in for the rows that are coming. */
  protected showPlaceholderRows = computed(() => this.resolvedLoading() && !this.hasError() && !this.rows().length);

  private refetchingOverRows = computed(() => this.resolvedLoading() && !this.hasError() && this.rows().length > 0);

  /**
   * Loading over rows that are already on screen: they stay, and the busy bar carries the news. This
   * is the case a paged/refetching table is in most of the time, and blanking it there would cost the
   * user their place for no gain. Deferred, because a page that arrives quickly would otherwise leave
   * nothing behind but a flicker under the header.
   */
  protected showBusyBar = signalDeferredLoading(this.refetchingOverRows);

  /** Whether body rows are cards - a box painted on a surface of its own (see `.et-table-row--card`). */
  protected cardRows = computed(() => this.appearance() === 'cards');

  /**
   * Whether a body row gets a box of its own instead of being layout-transparent - a subgrid spanning
   * every track (see `.et-table-row--box`).
   *
   * Opt-in, because a box changes the containing block of everything positioned inside a row: a pinned
   * column, the row's own link. A card row needs one to paint, and a stretched row link needs one to
   * stretch over.
   */
  protected rowBox = computed(() => this.cardRows() || !!this.rowLink());

  /**
   * The column whose cell hosts a row's link: the first visible one that doesn't hold controls of its
   * own, else the first visible one. Its content is what names the link, so it should be the column a
   * reader identifies the row by - which is what the leftmost column usually is.
   */
  private linkColumnKey = computed(() => {
    if (!this.rowLink()) return null;

    const columns = this.visibleColumns();

    return (columns.find((column) => !column.interactive) ?? columns[0])?.key ?? null;
  });

  /** The leading utility cells, with the pinning every row kind applies to them. */
  protected leadCells = computed<TableLeadCellVm[]>(() => {
    const pinning = this.columnPinning();

    return this.leadColumns().map((lead) => ({
      key: lead.key,
      cellClass: lead.cellClass,
      ...(pinning?.leadPinning(lead.key) ?? NO_LEAD_PIN),
      lead,
    }));
  });

  /** The trailing utility cells - the same, pinned to the trailing edge instead. */
  protected trailCells = computed<TableLeadCellVm[]>(() => {
    const pinning = this.columnPinning();

    return this.trailColumns().map((trail) => ({
      key: trail.key,
      cellClass: trail.cellClass,
      ...(pinning?.trailPinning(trail.key) ?? NO_LEAD_PIN),
      lead: trail,
    }));
  });

  protected headerCellVms = computed<TableHeaderCellVm<T>[]>(() => {
    const pinning = this.columnPinning();
    const templates = this.columnTemplates().header;
    const labels = this.resolvedLabels();
    const obscured = this.obscuredColumns();

    return this.visibleColumns().map((column) => {
      const direction = this.sortDirection(column.key);
      // The header announces what the *next* activation does, and the cycle is asc → desc → clear.
      const next = direction === null ? 'asc' : direction === 'asc' ? 'desc' : null;

      return {
        ...(pinning?.cellPinning(column.key) ?? NO_PIN),
        key: column.key,
        column,
        align: column.align ?? 'start',
        sortable: !!column.sortable,
        disabled: !!column.disabled,
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
        obscured: obscured.has(column.key),
      };
    });
  });

  protected footerCells = computed<TableFooterCellVm[]>(() => {
    const pinning = this.columnPinning();
    const templates = this.columnTemplates().footer;

    return this.visibleColumns().map((column) => ({
      ...(pinning?.cellPinning(column.key) ?? NO_PIN),
      key: column.key,
      align: column.align ?? 'start',
      template: templates.get(column.key) ?? null,
    }));
  });

  /** Spacer sizes standing in for the rows a window leaves out, or `null` when every row renders. */
  protected spacers = computed(() => {
    const window = this.rowWindow();

    if (!window || !this.rows().length) return null;

    return { start: window.paddingStart(), end: window.paddingEnd() };
  });

  protected bodyRows = computed<TableBodyRowVm<T>[]>(() => {
    const pinning = this.columnPinning();
    const templates = this.columnTemplates().cell;
    const columns = this.visibleColumns();
    const leads = this.leadCells();
    const trails = this.trailCells();
    const cellState = this.cellState();
    const indexOffset = this.rowIndexOffset();
    const detail = this.rowDetail();
    // At most one cell is ever open, so the edit templates are only looked up once there is one.
    const editing = this.cellEditing()?.cell() ?? null;
    const editTemplates = editing ? this.columnTemplates().cellEdit : null;
    const rowLink = this.rowLink();
    const linkColumn = this.linkColumnKey();
    const navigation = this.rowNavigation();
    const rendered = this.renderedRows();
    // A footer row separates itself with this rule, and an end spacer stands in for rows still below.
    const endsWithRows = !this.hasFooter() && !this.spacers()?.end;

    return rendered.map((row, index) => {
      const key = this.rowIdentity(row);
      const link = rowLink?.(row) ?? null;
      // A string is an href as given; commands are a URL only a navigator can build, so a table without
      // one renders no link at all rather than a wrong one (see the dev-mode check in the constructor).
      const href = link === null ? null : typeof link === 'string' ? link : (navigation?.href(link) ?? null);

      return {
        row,
        key,
        index: indexOffset + index,
        link,
        href,
        linkLabelId: `${this.LINK_ID_PREFIX}-${indexOffset + index}`,
        classes: [...leads, ...trails]
          .map((utility) => utility.lead.rowClass?.(row))
          .filter((className): className is string => !!className)
          .join(' '),
        stripe: (indexOffset + index) % 2 === 1,
        last: endsWithRows && index === rendered.length - 1,
        detail: detail?.isOpen(row) ? detail : null,
        leads,
        trails,
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
            ...(pinning?.cellPinning(column.key) ?? NO_PIN),
            key: column.key,
            align: column.align ?? 'start',
            linkHost: href !== null && column.key === linkColumn,
            interactive: !!column.interactive,
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

  /**
   * The keys of the currently hidden columns, in declared order. Nothing in the table's own chrome
   * shows a hidden column - the column menu's "Hide column" takes one away and has no way back - so
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
   * Every declared column in the current order, hidden ones included - the counterpart to
   * {@link visibleColumns}, and the list a "columns" chooser iterates.
   */
  public allColumns = computed(() => this.orderedColumns());

  // Which feature owns the drag each live pointer started - see claimPointerGesture.
  private pointerGestureClaims = new Map<number, string>();

  constructor() {
    const styleManager = injectStyleManager();

    // The row box layout, the card row's surface/ring/corner chrome and the row-link anchor do nothing
    // for a table that renders neither cards nor a row link, so they arrive only once `rowBox` turns
    // true - see TableDetailStylesComponent for the same pattern. Mounted once and left mounted:
    // switching the feature off never needs to reclaim it.
    effect(() => {
      if (this.rowBox()) styleManager.mount(TableRowBoxStylesComponent);
    });

    // A detail template with nothing to render it looks like a broken template rather than a missing
    // import, so name the mistake. Deferred to an effect because a feature registers from its own
    // constructor, which runs after the table's - and it asks whether one registered at all rather
    // than whether it is enabled, so `[etTableRowExpansion]="{ enabled: false }"` stays legal.
    if (isDevMode()) {
      effect(() => {
        if (!this.expandedRowTemplate() || this.rowDetailList().length) return;

        throw new RuntimeError(
          TABLE_ERROR_CODES.MISSING_ROW_EXPANSION,
          '[et-table] [expandedRowTemplate] needs the row-expansion feature to render it. Add `etTableRowExpansion` to the table and import TABLE_ROW_EXPANSION_IMPORTS.',
          { element: this.elementRef.nativeElement },
        );
      });

      // Router commands are a URL only the router can build, so such a row would otherwise render as a
      // row that looks like a link and leads nowhere. Asked of the rendered rows rather than of the
      // callback, since only a returned value says which form a table uses.
      effect(() => {
        const rowLink = this.rowLink();

        if (!rowLink || this.rowNavigationList().length) return;
        if (!this.renderedRows().some((row) => Array.isArray(rowLink(row)))) return;

        throw new RuntimeError(
          TABLE_ERROR_CODES.MISSING_ROW_ROUTER_LINK,
          '[et-table] [rowLink] answered with router commands, which need the router feature to resolve them. Add `etTableRowRouterLink` to the table and import TABLE_ROW_ROUTER_LINK_IMPORTS, or answer with an href string instead.',
          { element: this.elementRef.nativeElement },
        );
      });

      // A source's `sort`/`filters` signal and its setter are one contract the optional members cannot
      // express: the table writes through the setter and reads the signal back. Published without the
      // setter, the signal wins every mirror pass and the control the user clicks does nothing at all.
      effect(() => {
        const source = this.rowsSource();

        if (!source) return;

        for (const [state, setter, columnFlag] of UNPAIRED_ROWS_SOURCE_CHECKS) {
          if (!source[state] || source[setter]) continue;
          if (!this.columnDefs().some((column) => column[columnFlag])) continue;

          throw new RuntimeError(
            TABLE_ERROR_CODES.UNPAIRED_ROWS_SOURCE_STATE,
            `[et-table] [rowsSource] publishes \`${state}\` but no \`${setter}\`, so the table can never hand a change back to it and the ${columnFlag} columns would do nothing. Add \`${setter}\`, or drop \`${state}\` and let the table own the state.`,
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }

    // A bound rows source owns the sort/filter state, but everything here - features, `state()`, the
    // header models - reads `sort()` / `filters()`. Mirror the source into them rather than teaching
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

    // The fades depend on the live scroll offset, which no signal tracks - recheck on scroll, and
    // whenever the host or the tracks resize (either can change what overflows).
    effect(() => {
      this.hostDimensions();
      this.templateColumns();
      this.pageStickyHeader();
      afterNextRender({ read: () => this.syncScrollState() }, { injector: this.injector });
    });
  }

  protected syncScrollState() {
    const element = this.scrollElement();
    // `scrollLeft` counts down from 0 in RTL, so compare distances rather than raw offsets.
    const offset = Math.abs(element.scrollLeft);
    const remaining = element.scrollWidth - element.clientWidth - offset;
    const next = { start: offset > SCROLL_FADE_EPSILON, end: remaining > SCROLL_FADE_EPSILON };
    const current = this.scrollFades();

    if (next.start !== current.start || next.end !== current.end) this.scrollFades.set(next);

    const below = element.scrollHeight - element.clientHeight - element.scrollTop;
    const shadows = {
      blockStart: element.scrollTop > SCROLL_FADE_EPSILON,
      blockEnd: below > SCROLL_FADE_EPSILON,
    };
    const currentShadows = this.blockScrollShadows();

    if (shadows.blockStart !== currentShadows.blockStart || shadows.blockEnd !== currentShadows.blockEnd) {
      this.blockScrollShadows.set(shadows);
    }

    this.syncPageHeaderScroll(element);
    this.syncObscuredColumns();
  }

  /**
   * A template registered for one of a column's slots, or `null`. Part of the feature contract - the
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
   * of the feature contract - see {@link TableFeatureHost}; consumers never call this.
   */
  public registerStateSlice(slice: TableStateSlice) {
    this.stateSliceList.update((slices) => [...slices, slice]);
  }

  /**
   * Called by `etTableCellErrorTooltip` to replace the mark drawn in failed cells. Part of the feature
   * contract - see {@link TableFeatureHost}; consumers never call this.
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
   * Part of the feature contract - see `TableFeatureHost`; consumers never call this.
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
        { element: this.elementRef.nativeElement },
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
   * Called by an opt-in feature to render a full-width row under expanded rows (`etTableRowExpansion`).
   * Part of the feature contract; consumers never call this.
   */
  public registerRowDetail(detail: TableRowDetail) {
    this.rowDetailList.update((list) => [...list, detail]);
  }

  /**
   * Called by an opt-in feature to render a row above the column headers (`etTableGroupHeaders`). Part
   * of the feature contract; consumers never call this.
   */
  public registerHeaderRow(row: TableHeaderRow) {
    this.headerRowList.update((rows) => [...rows, row]);
  }

  /** Use the split page-sticky header layout. Part of the feature contract; consumers never call this. */
  public registerPageStickyHeader(header: TablePageStickyHeader) {
    this.pageStickyHeaderList.update((headers) => [...headers, header]);
  }

  /**
   * Called by an opt-in feature to render the loading body (`etTableSkeleton`). Part of the feature
   * contract; consumers never call this.
   */
  public registerBodyPlaceholder(placeholder: TableBodyPlaceholder) {
    this.bodyPlaceholderList.update((list) => [...list, placeholder]);
  }

  /**
   * Called by an opt-in feature to fill a cell that is loading on its own (`etTableSkeleton`). Part of
   * the feature contract; consumers never call this.
   */
  public registerCellPlaceholder(placeholder: TableCellPlaceholder) {
    this.cellPlaceholderList.update((list) => [...list, placeholder]);
  }

  /**
   * Called by an opt-in feature to pin columns to the inline edges (`etTableStickyColumns`). Part of the
   * feature contract; consumers never call this.
   */
  public registerColumnPinning(pinning: TableColumnPinning) {
    this.columnPinningList.update((list) => [...list, pinning]);
  }

  /**
   * Called by an opt-in feature to resolve and follow row links given as router commands
   * (`etTableRowRouterLink`). Part of the feature contract; consumers never call this.
   */
  public registerRowNavigation(navigation: TableRowNavigation) {
    this.rowNavigationList.update((list) => [...list, navigation]);
  }

  /** The rendered header cells of the leading utility columns. Part of the feature contract. */
  public leadHeaderCellElements() {
    return this.leadHeaderCells().map((ref) => ref.nativeElement);
  }

  /** The leading utility columns, in render order. Part of the feature contract. */
  public leadColumnsMeta() {
    return this.leadColumns().map((lead) => ({ key: lead.key, cellClass: lead.cellClass }));
  }

  /** The rendered header cells of the trailing utility columns. Part of the feature contract. */
  public trailHeaderCellElements() {
    return this.trailHeaderCells().map((ref) => ref.nativeElement);
  }

  /** The trailing utility columns, in render order. Part of the feature contract. */
  public trailColumnsMeta() {
    return this.trailColumns().map((trail) => ({ key: trail.key, cellClass: trail.cellClass }));
  }

  /** Whether a trailing slack track is in play. Part of the feature contract. */
  public hasFillerTrack() {
    return this.hasFiller();
  }

  /** Whether rows have a box of their own (a card, a row link). Part of the feature contract. */
  public hasRowBox() {
    return this.rowBox();
  }

  /** Whether rows are cards. Part of the feature contract. */
  public hasCardRows() {
    return this.cardRows();
  }

  /** The `expandedRowTemplate` input, type-erased for the feature contract. */
  public detailTemplate() {
    return this.expandedRowTemplate() ?? null;
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
   * Offer a cell to a registered editing feature. Part of the feature contract - it is how
   * `etTableKeyboardNav` hands `Enter` over to `etTableInlineEdit` without either knowing about the
   * other. `false` when nothing took it.
   */
  public editCell(rowIndex: number, columnIndex: number) {
    return this.cellEditing()?.editCell(rowIndex, columnIndex) ?? false;
  }

  /** What a pinned block covers at each inline edge. Part of the feature contract. */
  public frozenInsets() {
    return this.fadeInset();
  }

  /**
   * Claim the drag a pointer started for one feature. Part of the feature contract - it is how
   * `etTableReorder` keeps a header drag away from `etTableDragScroll` without either knowing about
   * the other. Consumers never call this.
   */
  public claimPointerGesture(event: PointerEvent, feature: string) {
    const { pointerId } = event;

    this.pointerGestureClaims.set(pointerId, feature);

    // Released off the document, not off the table: a pointer let go outside the table sends its
    // `pointerup` nowhere near this element, and a claim left behind would block the next gesture
    // that reuses the id.
    merge(fromEvent<PointerEvent>(this.document, 'pointerup'), fromEvent<PointerEvent>(this.document, 'pointercancel'))
      .pipe(
        filter((ended) => ended.pointerId === pointerId),
        take(1),
        tap(() => this.pointerGestureClaims.delete(pointerId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Which feature claimed this pointer's drag, or `null`. Part of the feature contract. */
  public pointerGestureClaim(event: PointerEvent) {
    return this.pointerGestureClaims.get(event.pointerId) ?? null;
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
   * contract. `null` when the row is outside a window's rendered range - ask {@link scrollRowIntoView}
   * for it first.
   */
  public bodyCellElementAt(rowIndex: number, columnIndex: number) {
    const columns = this.visibleColumns().length;
    const rendered = rowIndex - this.rowIndexOffset();

    if (rendered < 0 || rendered >= this.renderedRows().length) return null;
    if (columnIndex < 0 || columnIndex >= columns) return null;

    // `bodyCells` is every rendered data cell in DOM order, rows major - lead cells carry no `#bodyCell`
    // ref, so the arithmetic doesn't have to know how many of them there are.
    return this.bodyCells()[rendered * columns + columnIndex]?.nativeElement ?? null;
  }

  /**
   * Bring an absolute row index into view. Part of the feature contract. Returns `true` when a
   * registered window did it - the row is then only rendered after the next change detection, which is
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

  /** How many rows fit the scroll viewport. Part of the feature contract - the PageUp/PageDown step. */
  public rowsPerPage() {
    const rowHeight = this.firstBodyCellElement()?.offsetHeight ?? 0;
    const viewport = this.scrollElement().clientHeight;

    if (!rowHeight || !viewport) return 1;

    return Math.max(1, Math.floor(viewport / rowHeight) - 1);
  }

  /**
   * Apply a previously captured {@link TableState} - column order, visibility, sort, filters and feature
   * slices. A bound {@link rowsSource} keeps the sort and the filters it publishes; only the layout and
   * the feature slices are restored onto such a table. A state this build cannot read (a hand-edited
   * stored setup or link) is ignored rather than partially applied - see `isRestorableTableState`.
   */
  public restoreState(next: TableState) {
    if (!isRestorableTableState(next)) return;

    this.restoredColumns = next.columns.map((column) => ({ key: column.key, hidden: column.hidden }));
    this.columnOrder.set(next.columns.map((column) => column.key));
    this.hiddenColumns.set(new Set(next.columns.filter((column) => column.hidden).map((column) => column.key)));

    const widths: Record<string, number> = {};

    for (const column of next.columns) {
      if (typeof column.width === 'number') widths[column.key] = column.width;
    }

    this.columnWidths.set(widths);

    // Whatever a bound source publishes, it owns (see the constructor). Writing it from a restored
    // state would leave the mirror holding a value the source never had: the source does not change,
    // so the effect does not re-run to correct it. A layout-only state would silently drop the sort
    // arrow off a header whose rows are still sorted.
    const source = this.rowsSource();

    if (!source?.sort) {
      const sort = next.columns
        .filter((column) => column.sort)
        .sort((a, b) => (a.sortPriority ?? 0) - (b.sortPriority ?? 0))
        .map((column) => ({ key: column.key, direction: column.sort as TableSortDirection }));

      this.sort.set(sort);
    }

    if (!source?.filters) {
      const filters = next.columns
        .filter((column) => column.filterValues?.length)
        .map((column) => ({ key: column.key, values: column.filterValues ?? [] }));

      this.filters.set(filters);
    }

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
   * Set a column's sort direction outright, or clear it with `null` - what a column menu's explicit
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

    source?.setFilters?.(next);

    // See `applySort`: without a `filters` signal on the source nothing writes the value back.
    if (!source?.filters) this.filters.set(next);
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

  /**
   * Emit {@link rowClick} for a row (click or keyboard), unless the activation came from interactive
   * content inside it. Takes a plain `Event`: Angular types `$event` for the `keydown.enter` /
   * `keydown.space` pseudo-events that way, and the keyboard case is narrowed below.
   */
  protected activateRow(row: T, event: Event) {
    if (!this.rowInteractive() || this.originatesFromInteractive(event)) return;
    if (event instanceof KeyboardEvent && event.key === 'Enter' && this.cellNavigation()) return;

    // Enter/Space on a focused row shouldn't also scroll the page.
    if (event instanceof KeyboardEvent) event.preventDefault();

    this.rowClick.emit(row);
  }

  /**
   * Emit `rowClick` for a `rowInteractive` table's row at an absolute index, the way Enter on a focused
   * row does. Part of the feature contract: while cell navigation is on, Enter belongs to the cell first
   * (an editor, a control to drill into) and the feature hands it here only when the cell has nothing of
   * its own to open.
   */
  public activateRowAt(rowIndex: number) {
    const row = this.rows()[rowIndex];

    if (row === undefined || !this.rowInteractive()) return;

    this.rowClick.emit(row);
  }

  /**
   * Follow a row link the browser would otherwise load as a whole page. Only a link given as router
   * commands is followed, and only on a plain left click - a middle or Ctrl/Cmd-click keeps the
   * browser's own behaviour, which is the reason the row carries a real `href` at all.
   */
  protected activateRowLink(link: TableRowLink | null, event: MouseEvent) {
    if (link === null || typeof link === 'string') return;

    if (this.rowNavigation()?.navigate(link, event)) event.preventDefault();
  }

  /**
   * Stable identity for row-keyed state (change tracking, expansion, selection): the string form of
   * `rowKey` (so it matches its serialized form regardless of string/number), or the row reference.
   */
  public rowIdentity(row: T): unknown {
    const rowKey = this.rowKey();

    return rowKey ? String(rowKey(row)) : row;
  }

  /**
   * Whether a `rowKey` is bound, i.e. whether {@link rowIdentity} is a stable string rather than the
   * row reference - which is what a feature needs before it can serialize row-keyed state.
   */
  public hasRowKey() {
    return this.rowKey() !== undefined;
  }

  /** The table's own element. Part of the feature contract (a feature is a directive on it). */
  public get element() {
    return this.elementRef.nativeElement;
  }

  /** The active scroll viewport. Part of the feature contract. */
  public scrollElement() {
    return this.scrollerRef()?.nativeElement ?? this.elementRef.nativeElement;
  }

  /** The visible columns, in render order. Part of the feature contract. */
  public visibleColumnsMeta() {
    return this.visibleColumns();
  }

  /** The grid itself, for a feature measuring the whole of it. Part of the feature contract. */
  public gridElement() {
    return this.gridRef()?.nativeElement ?? null;
  }

  /** The separate page-sticky header grid. Part of the feature contract. */
  public pageHeaderGridElement() {
    return this.headerGridRef()?.nativeElement ?? null;
  }

  /** Use the body grid's resolved column tracks for the page-sticky header. Part of the feature contract. */
  public setPageHeaderColumns(columns: string | null) {
    if (columns === this.resolvedPageHeaderColumns()) return;

    this.resolvedPageHeaderColumns.set(columns);
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
    const pinning = this.columnPinning()?.cellPinning(key);

    return pinning?.stickyStart ? 'start' : pinning?.stickyEnd ? 'end' : null;
  }

  /**
   * Insert a column next to another in the full column order, keeping hidden columns in place. Part of
   * the feature contract - `etTableReorder` commits a drop with it.
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
   * The column's current rendered header width in px. Part of the feature contract - `etTableResize`
   * uses it as the baseline for a drag.
   */
  public renderedColumnWidth(key: string) {
    const cell = this.headerCells().find((ref) => ref.nativeElement.getAttribute('data-col-key') === key);

    return cell?.nativeElement.getBoundingClientRect().width ?? 0;
  }

  /**
   * Override a column's width, clamped between a usable minimum and the table's own width - a column
   * wider than the visible table only scrolls uselessly and makes it easy to strand the layout in a
   * strange state. Stored in `state()` so it round-trips. Part of the feature contract.
   */
  public setColumnWidth(key: string, width: number) {
    const max = this.scrollElement().clientWidth || Number.MAX_SAFE_INTEGER;
    const clamped = Math.min(max, Math.max(this.minWidthOf(key), Math.round(width)));

    this.columnWidths.update((widths) => ({ ...widths, [key]: clamped }));
  }

  /**
   * The narrowest a column may be: its own `minWidth`, else {@link MIN_COLUMN_WIDTH}. One source for
   * both floors a column has - the flexible track's, and how far a resize drag may go - so the two
   * can't disagree.
   */
  public minWidthOf(key: string) {
    return this.columnsByKey().get(key)?.minWidth ?? MIN_COLUMN_WIDTH;
  }

  /**
   * Fit columns to their widest rendered content, then keep that as a width override.
   *
   * Measured by letting the tracks out to `max-content` for one frame and reading back what the
   * browser gave them, rather than by adding up text metrics - that way arbitrary cell content (a
   * badge, an avatar, a nested component) is measured as it actually lays out, and the cell's own
   * padding is included for free. Only *rendered* rows count, so on a virtualized table this fits the
   * current window, as it must: the rows outside it have no width to measure.
   */
  public autosizeColumns(keys: readonly string[]) {
    const measurable = keys.filter((key) => this.columnsByKey().has(key));

    if (!measurable.length) return;

    this.resolvedPageHeaderColumns.set(null);
    this.autosizing.set(new Set(measurable));

    afterNextRender(
      {
        read: () => {
          // Read every width before writing any, so committing the first doesn't reflow the rest.
          const measured = measurable.map(
            (key) =>
              [key, Math.ceil(Math.max(this.renderedColumnWidth(key), this.renderedBodyColumnWidth(key)))] as const,
          );

          this.autosizing.set(new Set());

          for (const [key, width] of measured) {
            if (width > 0) this.setColumnWidth(key, width);
          }
        },
      },
      { injector: this.injector },
    );
  }

  /** Fit one column to its widest rendered content - see {@link autosizeColumns}. */
  public autosizeColumn(key: string) {
    this.autosizeColumns([key]);
  }

  /** Fit every visible column to its widest rendered content - see {@link autosizeColumns}. */
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

  // Must stay a same-tick write on the header grid. A requestAnimationFrame hop defers it past the
  // paint the body already moved in, so the header trails a whole frame; and the property inherits,
  // so writing it on the host recalculates style for every row cell, which only the header reads.
  private syncPageHeaderScroll(scroller: HTMLElement) {
    const header = this.headerGridRef()?.nativeElement;

    if (!header) return;

    this.renderer?.setCssProperties(header, { '--_et-table-inline-scroll': `${scroller.scrollLeft}px` });
  }

  private renderedBodyColumnWidth(key: string) {
    const cell = this.bodyCells().find((ref) => ref.nativeElement.getAttribute('data-col-key') === key);

    return cell?.nativeElement.getBoundingClientRect().width ?? 0;
  }

  // Which columns have scrolled behind a pinned one. Their cells are hidden by the pinned cells' own
  // opaque fill, but anything a feature hangs off a header cell in a portal - a filter menu, a column
  // menu - is not: it floats over the pinned column, anchored to a cell nobody can see. floating-ui's
  // own `referenceHidden` can't catch this either, since the cell is clipped by nothing; it is covered.
  // So the table says when a column is covered, and the header drops its adornments.
  private syncObscuredColumns() {
    const inset = this.fadeInset();

    if (inset.start === 0 && inset.end === 0) {
      if (this.obscuredColumns().size) this.obscuredColumns.set(EMPTY_COLUMN_KEYS);

      return;
    }

    const cells = this.headerCells();
    const columns = this.visibleColumns();
    // One live read per scroll tick over the header row only, which is what this has to compare against
    // the pinned edges - `signalElementDimensions` observes a single element and never sees a scroll.

    const host = this.scrollElement().getBoundingClientRect();
    const startEdge = host.left + inset.start;
    const endEdge = host.right - inset.end;
    const next = new Set<string>();

    columns.forEach((column, index) => {
      if (column.sticky) return;

      const cell = cells[index]?.nativeElement;

      if (!cell) return;

      const rect = cell.getBoundingClientRect();

      if (rect.right <= startEdge || rect.left >= endEdge) next.add(column.key);
    });

    const current = this.obscuredColumns();
    const changed = next.size !== current.size || [...next].some((key) => !current.has(key));

    if (changed) this.obscuredColumns.set(next);
  }

  /**
   * The one place sort state is written. A bound {@link rowsSource} owns it - it resets the page and
   * refetches - and a source that publishes a `sort` signal syncs its own value back into `sort` (see
   * the constructor), so everything else can keep reading `sort()` whichever drives it.
   */
  private applySort(sort: TableSort[]) {
    this.sortGesture.set(true);
    this.sortGestureReset?.unsubscribe();
    this.sortGestureReset = timer(SORT_INDICATOR_ANIMATION_MS)
      .pipe(
        tap(() => this.sortGesture.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    const source = this.rowsSource();

    source?.setSort?.(sort);

    // Only a source that publishes `sort` mirrors the new value back; skipping the local write for one
    // that does not would leave the header on the direction it already had, forever.
    if (!source?.sort) this.sort.set(sort);
  }

  // ── Render models ───────────────────────────────────────────────────────
  // See the `…Vm` types above: everything the template binds is resolved here, so a binding is a field
  // read rather than a call the framework has to repeat on every change-detection pass.

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
