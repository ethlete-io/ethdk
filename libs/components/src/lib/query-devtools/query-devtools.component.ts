import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { headerEntries, isHeadersValue } from './query-devtools-exotic';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  NgZone,
  signal,
  viewChild,
  ViewEncapsulation,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  clamp,
  createObjectUrlHandle,
  injectBreakpointObserver,
  injectFileDownload,
  injectRenderer,
  injectStyleManager,
} from '@ethlete/core';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQuerySnapshot,
  AnyQueryStack,
  BearerAuthMultiTabSyncFeature,
  clearQueryDevtoolsFaults,
  createQueryErrorResponse,
  EMPTY_QUERY_DEVTOOLS_FAULT,
  isQueryDevtoolsFaultArmed,
  measureQueryDevtoolsPayload,
  QueryClient,
  queryDevtoolsEntries,
  QueryDevtoolsEntry,
  queryDevtoolsFaults,
  queryDevtoolsResponseHistory,
  QueryDevtoolsFeature,
  QueryDevtoolsFormHandle,
  QueryDevtoolsRun,
  QueryDevtoolsStatsHandle,
  sumQueryDevtoolsStats,
  QueryKeyLockState,
  QueryRefreshCause,
  QueryRepository,
  QueryRepositoryCacheEntry,
  QueryRepositoryEvent,
  QuerySequence,
  QuerySequenceStatus,
  WebSocketDevtoolsHandle,
  WebSocketDevtoolsMessage,
} from '@ethlete/query';
import {
  animationFrames,
  EMPTY,
  filter,
  finalize,
  fromEvent,
  interval,
  map,
  merge,
  NEVER,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { QueryDevtoolsAuthTabComponent } from './query-devtools-auth-tab.component';
import { QueryDevtoolsCacheTabComponent } from './query-devtools-cache-tab.component';
import { buildCurlCommand } from './query-devtools-curl';
import { QueryDevtoolsEventsTabComponent } from './query-devtools-events-tab.component';
import { QueryDevtoolsDetailComponent } from './query-devtools-detail.component';
import { diffQueryDevtoolsResponses } from './query-devtools-diff';
import { QueryDevtoolsDrawerComponent } from './query-devtools-drawer.component';
import { QueryDevtoolsFaultsTabComponent } from './query-devtools-faults-tab.component';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { QueryDevtoolsFormsTabComponent } from './query-devtools-forms-tab.component';
import { QUERY_DEVTOOLS_HOST } from './query-devtools-host';
import { buildInsomniaExport, InsomniaRequestInput, InsomniaTokenRefreshInput } from './query-devtools-insomnia';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { QueryDevtoolsJsonStylesComponent } from './query-devtools-json-styles.component';
import { QueryDevtoolsQueriesTabComponent } from './query-devtools-queries-tab.component';
import { QueryDevtoolsRouteComponent } from './query-devtools-route.component';
import { QueryDevtoolsSequencesTabComponent } from './query-devtools-sequences-tab.component';
import { QueryDevtoolsSocketsTabComponent } from './query-devtools-sockets-tab.component';
import { QueryDevtoolsStacksTabComponent } from './query-devtools-stacks-tab.component';
import { QueryDevtoolsTimelineTabComponent } from './query-devtools-timeline-tab.component';
import {
  buildQueryDevtoolsSessionExport,
  SessionExportClient,
  SessionExportEntry,
  SessionExportEvent,
  SessionExportFault,
  slimForReport,
} from './query-devtools-session';
import { queryDevtoolsShortcutLabel } from './query-devtools-shortcut';
import { QueryDevtoolsTimelineStylesComponent } from './query-devtools-timeline-styles.component';
import { QueryDevtoolsToggleComponent } from './query-devtools-toggle.component';
import {
  AnyQuery,
  CacheRow,
  DetailTab,
  DevtoolsTab,
  DroppedCacheEntry,
  EventLogItem,
  PaneAxis,
  PaneTarget,
  QueryActivity,
  QueryDevtoolsLeadership,
  QueryDevtoolsSelection,
  QueryLink,
  QueryListFacet,
  QueryStatus,
  RefreshedRequest,
  RequestProgress,
  RouteSegment,
  TabBadge,
} from './query-devtools-types';

/** Which edge the panel is attached to. A pop-out is not one of these - it is a window, not an edge. */
type DevtoolsDock = 'bottom' | 'right';

/** A drag in progress: either the panel's docked edge, or the divider between a two-pane tab's panes. */
type ResizeDrag = {
  /** The document the pointer moves in - a popped-out panel lives in a window of its own. */
  doc: Document;
} & ({ kind: 'panel' } | { kind: 'pane'; pane: PaneTarget; axis: PaneAxis; container: HTMLElement });

type PersistedState = {
  open?: boolean;
  height?: number;
  width?: number;
  listWidth?: number | null;
  drawerWidth?: number | null;
  listHeight?: number | null;
  drawerHeight?: number | null;
  dock?: DevtoolsDock;
  activeTab?: DevtoolsTab;
  detailTab?: DetailTab;
  selectedClientName?: string | null;
  selectedQueryId?: string | null;
  selectedFormId?: string | null;
  inspectFilterIds?: string[] | null;
  queryFilter?: string;
  queryFacets?: QueryListFacet[];
  eventClient?: string | null;
  eventErrorsOnly?: boolean;
  socketFilter?: string;
  jsonSearch?: string;
  expandedSteps?: string[];
  expandedQueryGroups?: string[];
  jsonExpanded?: string[];
  jsonCollapsed?: string[];
};

/** How long a copy button stays ticked after a successful write. */
const COPIED_RESET_MS = 1200;

/** How long the locate box stays up. Long enough to outlast a smooth scroll and still be read. */
const LOCATE_HOLD_MS = 2500;

const noop = () => undefined;

const STORAGE_KEY = 'ethlete:query:devtools:v4';

/**
 * Pinned queries, held apart from {@link STORAGE_KEY} and in `localStorage`: everything under that key
 * is view state that should die with the tab, while a pin says which query is being worked on and is
 * meant to outlive one. Folding it in would silently make pins per-tab.
 */
const PINS_STORAGE_KEY = 'ethlete:query:devtools:pins:v2';

const MAX_EVENTS = 100;

/** Per client, not in total - a client that drops a lot must not push another client's out of view. */
const MAX_DROPPED_CACHE_ENTRIES = 20;
const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 560;
const MIN_WIDTH = 360;

/** The floors a dragged pane divider leaves on both sides of itself, per axis. */
const MIN_PANE_WIDTH = 220;
const MIN_PANE_HEIGHT = 120;

/** The window a pop-out opens at. Wide enough for the master/detail split the bottom dock gets. */
const POPOUT_FEATURES = 'popup=yes,width=1200,height=800';

/**
 * The document a pop-out is opened on. The doctype and the title have to be part of it rather than set
 * afterwards - see {@link QueryDevtoolsComponent.popOut}. Everything the panel needs beyond this (the
 * app's stylesheets, its theme) is copied in once the window has loaded.
 */
const POPOUT_DOCUMENT = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Query devtools</title>
  </head>
  <body style="margin: 0"></body>
</html>`;

/**
 * Every stylesheet the panel injects after it is created rather than with itself. A pop-out copies the
 * host document's styles once, on load, so all of them have to be in the document by then - whatever the
 * user has opened so far.
 */
const DEFERRED_STYLES = [QueryDevtoolsJsonStylesComponent, QueryDevtoolsTimelineStylesComponent];

const readPersistedState = (): PersistedState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
};

const readPinnedQueryIds = (): string[] => {
  try {
    const raw = localStorage.getItem(PINS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
};

/** How long an exported Insomnia collection reuses a refresh response whose token lifetime is unknown. */
const DEFAULT_TOKEN_MAX_AGE_S = 300;

/** Upper bound for the same, so a token that claims a year of life still gets refreshed hourly. */
const MAX_TOKEN_MAX_AGE_S = 3600;

/**
 * A panel action must never reach the application's `ErrorHandler` - it reports its own failure inside
 * the panel instead, and this is the text it shows.
 */
const actionErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * What to seed the args editor with for a query that has never run and holds no args anywhere. A
 * function route cannot execute without its path params, so the editor offers them as blanks to fill.
 */
const emptyArgsSeed = (entry: QueryDevtoolsEntry) => {
  const params = entry.meta.routeParts?.flatMap((part) => (part.param ? [part.param] : [])) ?? [];

  if (!params.length) return {};

  return { pathParams: Object.fromEntries(params.map((name) => [name, ''])) };
};

type HeadersRecord = Record<string, string | string[]>;

/** Marks a value `editableArgs` left out of the draft, for {@link executableArgs} to put back. */
const DROPPED = /* @__PURE__ */ Symbol('dropped');

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
};

/**
 * Values `JSON.stringify` cannot represent - it writes `{}`, private fields, or omits them outright. A
 * `Date` is deliberately not one: it survives as an ISO string, which is what the query would send
 * anyway, so it stays editable.
 */
const isUneditable = (value: unknown) =>
  typeof value === 'function' ||
  value instanceof Map ||
  value instanceof Set ||
  (typeof FormData !== 'undefined' && value instanceof FormData) ||
  (typeof Blob !== 'undefined' && value instanceof Blob) ||
  isHeadersValue(value);

/**
 * Args in the shape the JSON editor can carry. `JSON.stringify` writes an `HttpHeaders` as its four
 * private fields, a `FormData` or a `Map` as `{}`, and a header provider not at all - so an unedited
 * draft used to replay values the query never had. Headers become a plain `name: value` record, since
 * one rebuilds them exactly; every other such value is left out of the draft and put back verbatim by
 * {@link executableArgs}, which beats letting the user edit an empty object over the top of it.
 */
const editableArgs = (args: Record<string, unknown>) => editableValue(args) as Record<string, unknown>;

const editableValue = (value: unknown): unknown => {
  if (isHeadersValue(value)) return Object.fromEntries(headerEntries(value).map(({ k, v }) => [k, v]));
  if (isUneditable(value)) return DROPPED;
  if (Array.isArray(value)) {
    // `null` rather than a hole, so the indices a user edits still line up with the ones being replayed.
    return value.map((item) => {
      const edited = editableValue(item);

      return edited === DROPPED ? null : edited;
    });
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
      const edited = editableValue(child);

      if (edited !== DROPPED) out[key] = edited;
    }

    return out;
  }

  return value;
};

/** The inverse of {@link editableArgs}: records become `HttpHeaders` again, dropped values come back. */
const executableArgs = (draft: Record<string, unknown> | null, source: Record<string, unknown> | null) =>
  draft ? (executableValue(draft, source) as Record<string, unknown>) : draft;

const executableValue = (draft: unknown, source: unknown): unknown => {
  // What the draft could not carry comes back verbatim. A key the user deleted themselves stays deleted,
  // because only a value `editableArgs` dropped is missing from the draft while present in the source.
  if (draft === undefined) return isUneditable(source) ? source : undefined;

  if (isHeadersValue(source) && isPlainObject(draft)) return new HttpHeaders(draft as HeadersRecord);

  if (isPlainObject(draft) && isPlainObject(source)) {
    const out: Record<string, unknown> = { ...draft };

    for (const [key, child] of Object.entries(source)) {
      const restored = executableValue(draft[key], child);

      if (restored !== undefined) out[key] = restored;
    }

    return out;
  }

  return draft;
};

/**
 * The JSONPath of a string value inside a response, or `null`. Used to locate the access token in an
 * auth response whose shape only the provider's `extractTokens` knows.
 */
const findValuePath = (value: string, node: { value: unknown; path: string; depth: number }): string | null => {
  if (node.value === value) return node.path;
  if (node.depth > 5 || !node.value || typeof node.value !== 'object') return null;

  for (const [key, entry] of Object.entries(node.value)) {
    const path = Array.isArray(node.value) ? `${node.path}[${key}]` : `${node.path}.${key}`;
    const found = findValuePath(value, { value: entry, path, depth: node.depth + 1 });

    if (found) return found;
  }

  return null;
};

/** Best-effort decode of a JWT payload for the auth tab. Returns `null` for anything non-decodable. */
const decodeJwtPayload = (token: string | null): Record<string, unknown> | null => {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    const json = decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );

    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * A floating, dockable panel that inspects the live state of the signals-first `@ethlete/query`
 * system: queries, stacks, sequences, bearer auth providers, the repository cache and a rolling
 * event log.
 *
 * Requires `provideQueryDevtools()` in the application providers - without it the registry stays
 * empty and the panel shows nothing.
 */
@Component({
  selector: 'et-query-devtools',
  templateUrl: './query-devtools.component.html',
  styleUrl: './query-devtools.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    QueryDevtoolsAuthTabComponent,
    QueryDevtoolsCacheTabComponent,
    QueryDevtoolsDetailComponent,
    QueryDevtoolsDrawerComponent,
    QueryDevtoolsEventsTabComponent,
    QueryDevtoolsFaultsTabComponent,
    QueryDevtoolsFeaturesComponent,
    QueryDevtoolsFormsTabComponent,
    QueryDevtoolsJsonComponent,
    QueryDevtoolsQueriesTabComponent,
    QueryDevtoolsRouteComponent,
    QueryDevtoolsSequencesTabComponent,
    QueryDevtoolsSocketsTabComponent,
    QueryDevtoolsStacksTabComponent,
    QueryDevtoolsTimelineTabComponent,
    QueryDevtoolsToggleComponent,
  ],
  providers: [{ provide: QUERY_DEVTOOLS_HOST, useExisting: QueryDevtoolsComponent }],
  host: {
    class: 'et-query-devtools-host',
    '[attr.data-dock]': 'dock()',
  },
})
export class QueryDevtoolsComponent {
  private hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = injectRenderer();
  private download = injectFileDownload();
  private styleManager = injectStyleManager();
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);

  /** The panel itself, so a pop-out can move it into another window's document. */
  private panelEl = viewChild<ElementRef<HTMLElement>>('panel');

  /** The overflow tab menu, to tell a click inside it from one that should dismiss it. */
  private tabMenuEl = viewChild<ElementRef<HTMLElement>>('tabMenu');

  private eventIdCounter = 0;
  private lastSelectionKey = '';

  public readonly persisted = readPersistedState();

  protected readonly tabs = [
    { id: 'queries', label: 'Queries' },
    { id: 'stacks', label: 'Stacks' },
    { id: 'sequences', label: 'Sequences' },
    { id: 'forms', label: 'Forms' },
    { id: 'auth', label: 'Auth' },
    { id: 'ws', label: 'Sockets' },
    { id: 'cache', label: 'Cache' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'events', label: 'Events' },
    { id: 'faults', label: 'Faults' },
  ] satisfies { id: DevtoolsTab; label: string }[];

  /**
   * Tabs the bar keeps whether they hold anything or not: the one the panel opens on, and the one that
   * arms faults - which has entries to arm rather than to count.
   */
  private readonly PINNED_TABS: readonly DevtoolsTab[] = ['queries', 'faults'];

  protected readonly shortcut = queryDevtoolsShortcutLabel();

  protected open = signal(this.persisted.open ?? false);
  private panelHeight = signal(this.persisted.height ?? DEFAULT_HEIGHT);
  private panelWidth = signal(this.persisted.width ?? DEFAULT_WIDTH);
  protected activeTab = signal<DevtoolsTab>(this.persisted.activeTab ?? 'queries');

  /**
   * The dragged sizes of the two-pane tabs, in px, one pair per axis - a side dock stacks the panes, so
   * the same divider sizes them along the block axis there and a dock switch has to keep both. `null`
   * keeps the stylesheet's proportional default, which is also what a double-click on a divider restores.
   */
  protected listWidth = signal<number | null>(this.persisted.listWidth ?? null);
  protected drawerWidth = signal<number | null>(this.persisted.drawerWidth ?? null);
  protected listHeight = signal<number | null>(this.persisted.listHeight ?? null);
  protected drawerHeight = signal<number | null>(this.persisted.drawerHeight ?? null);

  protected drag = signal<ResizeDrag | null>(null);
  protected resizing = computed(() => !!this.drag());

  /** Which edge the panel is docked to. */
  protected dock = signal<DevtoolsDock>(this.persisted.dock ?? 'bottom');

  /**
   * Whether the panel currently lives in a window of its own. Deliberately not persisted: a reload
   * cannot re-adopt a window the previous document opened, so it always starts docked.
   */
  protected poppedOut = signal(false);

  /**
   * Below `md` a side-by-side split cannot fit: the list alone asks for `22rem` and the drawer for
   * `26rem`, which is wider than a phone. Narrow gets the same stacked layout a right dock does.
   */
  private narrowViewport = injectBreakpointObserver().observeBreakpoint({ max: 'sm' });

  /** Which axis the two-pane tabs split along. The stylesheet keys the stacked layout off the same value. */
  protected paneAxis = computed<PaneAxis>(() =>
    !this.poppedOut() && (this.dock() === 'right' || this.narrowViewport()) ? 'block' : 'inline',
  );

  private popup: Window | null = null;

  // Only the axis the dock edge controls is bound; the other is the stylesheet's, and a pop-out fills
  // its window on both.
  protected panelBlockSize = computed(() =>
    !this.poppedOut() && this.dock() === 'bottom' ? this.panelHeight() : null,
  );

  protected panelInlineSize = computed(() => (!this.poppedOut() && this.dock() === 'right' ? this.panelWidth() : null));

  /** Which section of the query detail is showing. Shared by the Queries tab and both drawers. */
  public detailTab = signal<DetailTab>(this.persisted.detailTab ?? 'overview');
  public selectedClientName = signal<string | null>(this.persisted.selectedClientName ?? null);
  public selectedQueryId = signal<string | null>(this.persisted.selectedQueryId ?? null);

  /** The form whose detail the Forms tab has expanded. */
  public selectedFormId = signal<string | null>(this.persisted.selectedFormId ?? null);

  // Independent per-drawer selection so no drawer shares the Queries tab's selection - or another
  // drawer's: opening a query from the Timeline must not also change what the Forms drawer shows.
  public stackSelectedQueryId = signal<string | null>(null);
  public sequenceSelectedQueryId = signal<string | null>(null);
  public formSelectedQueryId = signal<string | null>(null);
  public timelineSelectedQueryId = signal<string | null>(null);

  /** Free-text narrowing of the Queries list. Every whitespace-separated term has to match. */
  public queryFilter = signal(this.persisted.queryFilter ?? '');

  /** The status facets the Queries list is narrowed to. Empty means no status narrowing. */
  public queryFacets = signal<ReadonlySet<QueryListFacet>>(new Set(this.persisted.queryFacets ?? []));

  /**
   * The entry ids sorted to the top of the Queries list. Ids are derived from a stable descriptor plus a
   * per-descriptor sequence number, so a pin survives a reload as long as queries are created in the same
   * order - the same property the restored selection already relies on.
   */
  public pinnedQueryIds = signal<ReadonlySet<string>>(new Set(readPinnedQueryIds()));

  public eventLog = signal<EventLogItem[]>([]);

  /**
   * The cache entries that are gone, newest first. Kept here rather than in the repository, which stays
   * lean in production - it emits the teardown and forgets it.
   */
  public droppedCacheEntries = signal<DroppedCacheEntry[]>([]);

  /** The client (by base URL) the event log is scoped to, or `null` for all of them. */
  public eventClient = signal<string | null>(this.persisted.eventClient ?? null);

  /** Whether the event log is narrowed to failures - the rows a bug report is about. */
  public eventErrorsOnly = signal(this.persisted.eventErrorsOnly ?? false);

  /** Free-text narrowing of every socket's message log. Matches the event, the room and the direction. */
  public socketFilter = signal(this.persisted.socketFilter ?? '');

  /** The cache entry whose response is expanded, as `<client>|<key>`, or `null` while none is. */
  private expandedCacheKey = signal<string | null>(null);

  /** The socket whose emit box last failed, so the message shows on that card and no other. */
  private socketEmitError = signal<{ entryId: string; message: string } | null>(null);

  /** Keys (`<entryId>:<stepIndex>`) of the sequence steps whose in/out detail is expanded. */
  private expandedSteps = signal<ReadonlySet<string>>(new Set(this.persisted.expandedSteps ?? []));

  /** Keys of the Queries-list groups the user opened - the tab is rebuilt on every switch back. */
  public expandedQueryGroups = signal<ReadonlySet<string>>(new Set(this.persisted.expandedQueryGroups ?? []));

  /** Shared value-explorer search term. */
  public jsonSearch = signal(this.persisted.jsonSearch ?? '');
  public jsonSearchTerm = computed(() => this.jsonSearch().trim().toLowerCase());

  /** Path-keyed value-explorer expansion overrides (persisted so open trees survive a reload). */
  public jsonExpandedPaths = signal<ReadonlySet<string>>(new Set(this.persisted.jsonExpanded ?? []));
  public jsonCollapsedPaths = signal<ReadonlySet<string>>(new Set(this.persisted.jsonCollapsed ?? []));

  /** Bound callback passed into the value explorer to persist per-path expansion. Assigned in the constructor. */
  public toggleJsonPath: (path: string, expand: boolean) => void;

  /** The run whose response the diff is comparing, by run index, or `null` while no diff is open. */
  public diffRunIndex = signal<number | null>(null);

  /**
   * The run the diff compares it *against*, or `null` to derive that side - the newest older run that
   * still holds a body, which is what one click on **Diff** gives you.
   */
  public diffBaseRunIndex = signal<number | null>(null);

  public errorRunIndex = signal<number | null>(null);

  /**
   * How many bodies a query retains, which is what bounds how far back a diff can reach. Read once:
   * `provideQueryDevtools()` sets it before anything can create this panel.
   */
  public readonly retainedResponseCount = queryDevtoolsResponseHistory();

  /** JIT editor state (response / args editing on the selected query). */
  public editorMode = signal<'none' | 'response' | 'args'>('none');
  public responseDraft = signal('');
  public argsDraft = signal('');

  /**
   * The text the currently open editor was seeded with. The textareas bind `value` to this and not to
   * the live draft: a `value` binding fed by the draft is written back on every keystroke, and writing
   * a textarea's `value` puts the caret at the end.
   */
  public editorSeed = '';
  public editError = signal<string | null>(null);

  /** The args the open editor was seeded from, so applying can put back what the draft cannot carry. */
  private editedArgsSource: Record<string, unknown> | null = null;

  /** Transient "Copied!" feedback for the copy-report, copy-as-Insomnia / cURL and copy-document actions. */
  public copiedReport = signal(false);
  public copiedInsomnia = signal(false);
  public copiedCurl = signal(false);
  public copiedGql = signal(false);
  public copiedRoute = signal(false);
  private copiedReset$ = new Subject<void>();

  /** 1-second tick driving the cache freshness countdowns. */
  private clock = toSignal(interval(1000), { initialValue: 0 });

  /** "Inspect" mode: hover the live UI to find the query that a component created. */
  protected inspectActive = signal(false);
  protected inspectHover = signal<{ rect: DOMRect; entries: QueryDevtoolsEntry[] } | null>(null);

  /** Inspect run backwards: the box drawn over the element the selected query was created in. */
  protected locatedRect = signal<DOMRect | null>(null);
  public locateState = signal<'idle' | 'located' | 'offscreen'>('idle');
  private locate$ = new Subject<HTMLElement | null>();

  /** When set (via inspect), the Queries list is filtered to exactly these entry ids. */
  public inspectFilterIds = signal<string[] | null>(this.persisted.inspectFilterIds ?? null);

  private queryEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query'));

  /**
   * The queries that still exist. Everything that measures what the application is doing right now -
   * the tab bar's error flags, the tamper dot, the timeline, the identity match behind an event row -
   * reads this rather than {@link queryEntries}, so a tombstone never inflates a live number.
   */
  private liveQueryEntries = computed(() => this.queryEntries().filter((e) => !e.destroyedAt));

  protected panelTampered = computed(() => this.liveQueryEntries().some((entry) => this.isTampered(entry)));

  public stackEntries = computed(() =>
    queryDevtoolsEntries().filter((e) => e.kind === 'query-stack' || e.kind === 'paged-query-stack'),
  );

  public sequenceEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query-sequence'));

  public formEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query-form'));

  public authEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'auth-provider'));

  public wsEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'ws-client'));

  /** Unique client names present across queries and auth providers, for the Queries-tab picker. */
  public clientNames = computed(() => {
    const names = new Set<string>();
    for (const entry of queryDevtoolsEntries()) {
      if (entry.meta.clientName) names.add(entry.meta.clientName);
    }
    return Array.from(names).sort();
  });

  /** Unique repositories (with their client name + base URL) used by the Cache and Events tabs. */
  private repositories = computed(() => {
    const map = new Map<QueryRepository, { name: string; baseUrl: string; client: QueryClient | null }>();
    for (const entry of queryDevtoolsEntries()) {
      const repo = entry.meta.repository;
      if (repo && !map.has(repo)) {
        map.set(repo, {
          name: entry.meta.clientName ?? 'unknown',
          baseUrl: entry.meta.clientBaseUrl ?? '',
          client: entry.meta.client ?? null,
        });
      }
    }
    return Array.from(map, ([repository, info]) => ({ repository, ...info }));
  });

  /**
   * Every client the Faults tab can arm, with the fault it currently carries. Clients with nothing armed
   * read as {@link EMPTY_QUERY_DEVTOOLS_FAULT} so the inputs always have a value to show.
   */
  public faultClients = computed(() => {
    const faults = queryDevtoolsFaults();

    return this.repositories()
      .map(({ name, baseUrl }) => {
        const fault = faults[name] ?? EMPTY_QUERY_DEVTOOLS_FAULT;

        return { name, baseUrl, fault, armed: isQueryDevtoolsFaultArmed(fault) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /**
   * The names of the clients currently carrying a fault, or `null` when none do - so a template can `@if`
   * on it. Armed faults are the one state where the panel is lying to the app on purpose, and a badge on a
   * tab that isn't open cannot say that: whichever tab you are reading, a red response has to be
   * attributable to the injection rather than to the API.
   */
  protected armedFaultClients = computed(() => {
    const armed = this.faultClients()
      .filter((client) => client.armed)
      .map((client) => client.name);

    return armed.length ? armed : null;
  });

  /**
   * The queries the list is scoped to before the search box and the status chips narrow them further:
   * either the picked client's, or exactly the inspected element's.
   */
  public scopedQueries = computed(() => {
    const entries = this.queryEntries();
    const inspectIds = this.inspectFilterIds();

    if (inspectIds) return entries.filter((e) => inspectIds.includes(e.id));

    const client = this.selectedClientName();

    return client ? entries.filter((e) => e.meta.clientName === client) : entries;
  });

  /** How many runs every query has recorded, for the Timeline tab's badge. */
  private runTotals = computed<TabBadge>(() => {
    let count = 0;
    let errors = 0;

    for (const entry of this.queryEntries()) {
      for (const run of entry.stats?.runs() ?? []) {
        count++;
        if (run.status === 'error') errors++;
      }
    }

    return { count, errors };
  });

  /** Cache entries across every client, for the Cache tab's badge. */
  private cacheEntryCount = computed(() =>
    this.repositories().reduce((total, { repository }) => {
      // Read the version signal so the badge recounts on every cache mutation.
      repository.subtle.cacheVersion();

      return total + repository.subtle.cacheEntries().length;
    }, 0),
  );

  /**
   * What each tab holds, so a failing query in a tab that is not open is still visible. Reading it
   * subscribes the tab bar to every entry's live state - which is the point of the badges.
   */
  protected tabBadges = computed<Record<DevtoolsTab, TabBadge>>(() => {
    const queries = this.liveQueryEntries();
    const stacks = this.stackEntries();
    const sequences = this.sequenceEntries();
    const events = this.eventLog();

    return {
      queries: {
        // Live queries only, so the badge and the list agree: the list leaves tombstones out until the
        // Gone chip asks for them. A frozen failure is history too, so it never sets the error flag.
        count: queries.length,
        errors: queries.filter((entry) => this.queryStatus(entry.handle as AnyQuery) === 'error').length,
      },
      stacks: {
        count: stacks.length,
        errors: stacks.filter((entry) =>
          entry.kind === 'paged-query-stack' ? !!this.asPagedStack(entry).error() : !!this.asStack(entry).anyError(),
        ).length,
      },
      sequences: {
        count: sequences.length,
        errors: sequences.filter((entry) => (this.asSequence(entry)?.failedAt() ?? null) !== null).length,
      },
      forms: { count: this.formEntries().length, errors: 0 },
      auth: { count: this.authEntries().length, errors: 0 },
      ws: { count: this.wsEntries().length, errors: 0 },
      cache: { count: this.cacheEntryCount(), errors: 0 },
      timeline: this.runTotals(),
      events: {
        count: events.length,
        errors: events.filter((event) => event.type === 'request-error').length,
      },
      // Armed faults are reported as errors rather than as a plain count: the badge is the one reminder
      // that the app is misbehaving on purpose, and it has to be impossible to read as "all good".
      faults: { count: 0, errors: Object.keys(queryDevtoolsFaults()).length, errorNoun: 'armed' },
    };
  });

  /**
   * The tabs the bar shows: the pinned ones, the one that is open, and every tab that currently holds
   * something.
   */
  protected visibleTabs = computed(() => this.tabs.filter((tab) => this.isTabPrimary(tab.id)));

  /** The empty tabs, which the bar offers behind "More" instead. */
  protected overflowTabs = computed(() => this.tabs.filter((tab) => !this.isTabPrimary(tab.id)));

  protected tabMenuOpen = signal(false);

  public selectedQuery = computed(() => this.findQuery(this.selectedQueryId()));
  public stackSelectedQuery = computed(() => this.findQuery(this.stackSelectedQueryId()));
  public sequenceSelectedQuery = computed(() => this.findQuery(this.sequenceSelectedQueryId()));
  public formSelectedQuery = computed(() => this.findQuery(this.formSelectedQueryId()));
  public timelineSelectedQuery = computed(() => this.findQuery(this.timelineSelectedQueryId()));

  /**
   * The cache per client, with every entry's size measured. Reading each response inside the computed is
   * what keeps the totals current: a cache mutation bumps `cacheVersion`, but a response landing in an
   * entry that is already there does not.
   */
  public cacheView = computed(() => {
    const dropped = this.droppedCacheEntries();

    return this.repositories().map(({ repository, name, baseUrl, client }) => {
      // Read the version signal so this recomputes on every cache mutation.
      repository.subtle.cacheVersion();

      const rows = repository.subtle.cacheEntries().map((entry): CacheRow => {
        const measured = measureQueryDevtoolsPayload({ body: entry.request.response() });

        return { entry, bytes: measured.bytes, isEstimatedBytes: !measured.isExact && measured.bytes > 0 };
      });

      return {
        name,
        baseUrl,
        repository,
        rows,
        bytes: rows.reduce((total, row) => total + row.bytes, 0),
        isEstimatedBytes: rows.some((row) => row.isEstimatedBytes),
        unused: rows.filter((row) => row.entry.isUnused).length,
        pollStates: client?.subtle.sync?.lockManager.keyStates() ?? {},
        client,
        // The event log labels a client by its base URL, falling back to its name - match the same way.
        dropped: dropped.filter((entry) => entry.client === (baseUrl || name)),
      };
    });
  });

  /** Map of a component's host element to the query entries it created (for the inspect tool). */
  private elementQueryMap = computed(() => {
    const map = new Map<HTMLElement, QueryDevtoolsEntry[]>();
    for (const entry of this.queryEntries()) {
      const el = entry.meta.element;
      if (!el) continue;
      const list = map.get(el);
      if (list) list.push(entry);
      else map.set(el, [entry]);
    }
    return map;
  });

  /** Disarms every client's fault - the shell's "Faults armed" banner offers this above every tab. */
  protected readonly CLEAR_FAULTS = clearQueryDevtoolsFaults;

  constructor() {
    // Assigned here (not as an arrow property) so `this` is bound for the value-explorer callback.
    this.toggleJsonPath = (path: string, expand: boolean) => {
      const expanded = new Set(this.jsonExpandedPaths());
      const collapsed = new Set(this.jsonCollapsedPaths());

      if (expand) {
        expanded.add(path);
        collapsed.delete(path);
      } else {
        collapsed.add(path);
        expanded.delete(path);
      }

      this.jsonExpandedPaths.set(expanded);
      this.jsonCollapsedPaths.set(collapsed);
    };

    // Each copy restarts the countdown; switchMap drops the pending reset of the previous one.
    this.copiedReset$
      .pipe(
        switchMap(() => timer(COPIED_RESET_MS)),
        tap(() => {
          this.copiedReport.set(false);
          this.copiedInsomnia.set(false);
          this.copiedCurl.set(false);
          this.copiedGql.set(false);
          this.copiedRoute.set(false);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // The box has to follow the element for as long as the smooth scroll is moving it, so it tracks per
    // frame rather than measuring once. Each locate cancels the previous run's frames and its timeout.
    this.locate$
      .pipe(
        switchMap((element) => {
          // `NEVER` for the not-on-screen case: there is no box to move, but the button's reason has to
          // stay up for the same beat before `finalize` clears it.
          const frames = element
            ? animationFrames().pipe(tap(() => this.locatedRect.set(element.getBoundingClientRect())))
            : NEVER;

          return frames.pipe(
            takeUntil(timer(LOCATE_HOLD_MS)),
            finalize(() => {
              this.locatedRect.set(null);
              this.locateState.set('idle');
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Merge every live repository's event stream into the rolling log, re-subscribing as the set of
    // repositories changes. Composed with RxJS (not a subscribe-in-effect) per the styleguide.
    toObservable(this.repositories)
      .pipe(
        switchMap((repos) =>
          merge(
            ...repos.map(({ repository, name, baseUrl }) =>
              repository.events$.pipe(map((event) => ({ event, client: baseUrl || name }))),
            ),
          ),
        ),
        tap(({ event, client }) => this.pushEvent(event, client)),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const state: PersistedState = {
        open: this.open(),
        height: this.panelHeight(),
        width: this.panelWidth(),
        listWidth: this.listWidth(),
        drawerWidth: this.drawerWidth(),
        listHeight: this.listHeight(),
        drawerHeight: this.drawerHeight(),
        dock: this.dock(),
        activeTab: this.activeTab(),
        detailTab: this.detailTab(),
        selectedClientName: this.selectedClientName(),
        selectedQueryId: this.selectedQueryId(),
        selectedFormId: this.selectedFormId(),
        inspectFilterIds: this.inspectFilterIds(),
        queryFilter: this.queryFilter(),
        queryFacets: [...this.queryFacets()],
        eventClient: this.eventClient(),
        eventErrorsOnly: this.eventErrorsOnly(),
        socketFilter: this.socketFilter(),
        jsonSearch: this.jsonSearch(),
        expandedSteps: [...this.expandedSteps()],
        expandedQueryGroups: [...this.expandedQueryGroups()],
        jsonExpanded: [...this.jsonExpandedPaths()],
        jsonCollapsed: [...this.jsonCollapsedPaths()],
      };

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore (private mode / disabled storage)
      }
    });

    effect(() => {
      const ids = [...this.pinnedQueryIds()];

      try {
        localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(ids));
      } catch {
        // ignore (private mode / disabled storage)
      }
    });

    // Close any open JIT editor on any selection / tab change, and reset the value-explorer search
    // when the *selected query* actually changes (but not on the initial restore, so a persisted
    // search survives a reload).
    this.lastSelectionKey = this.selectionKey();
    effect(() => {
      const key = this.selectionKey();
      this.activeTab();

      this.editorMode.set('none');
      this.editError.set(null);
      this.copiedReport.set(false);
      this.copiedInsomnia.set(false);
      this.copiedCurl.set(false);
      this.copiedRoute.set(false);
      this.diffRunIndex.set(null);
      this.diffBaseRunIndex.set(null);
      this.errorRunIndex.set(null);

      if (key !== this.lastSelectionKey) {
        this.lastSelectionKey = key;
        this.jsonSearch.set('');
      }
    });

    // A pop-out holds the panel element; leaving its window open would leave a dead panel on screen.
    this.destroyRef.onDestroy(() => this.closePopup());

    const doc = this.document;

    // Global toggle shortcut: Ctrl/Cmd + Alt + Q ("Q" for Query) - uncommon, no browser/OS conflict.
    // Matched on `code` (the physical key), not `key`: on macOS, Option rewrites `key` to the layout's
    // alternate glyph (Option+Q is "œ" on a US layout), so a `key === 'q'` test never fires there.
    fromEvent<KeyboardEvent>(doc, 'keydown')
      .pipe(
        filter((e) => (e.ctrlKey || e.metaKey) && e.altKey && (e.code === 'KeyQ' || e.key.toLowerCase() === 'q')),
        tap((e) => {
          e.preventDefault();
          this.toggleOpen();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Drag-to-resize: while a resize is in progress, track pointer movement on the document. A pointer
    // released outside the window never reports its `pointerup`, so a move that arrives with no button
    // held ends the drag instead of resizing - otherwise the panel would keep following the pointer.
    toObservable(this.drag)
      .pipe(
        switchMap((active) =>
          active
            ? merge(
                fromEvent<PointerEvent>(active.doc, 'pointermove').pipe(
                  tap((e) => (e.buttons === 0 ? this.drag.set(null) : this.applyResize(active, e))),
                ),
                merge(
                  fromEvent<PointerEvent>(active.doc, 'pointerup'),
                  fromEvent<PointerEvent>(active.doc, 'pointercancel'),
                ).pipe(tap(() => this.drag.set(null))),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

    // The overflow tab menu is a plain element rather than an overlay, so nothing dismisses it on its
    // own. Listened for on the panel's own document, which a pop-out replaces with the pop-up's.
    toObservable(this.tabMenuOpen)
      .pipe(
        switchMap((open) => {
          if (!open) return EMPTY;

          const menuDoc = this.panelEl()?.nativeElement.ownerDocument ?? doc;

          return merge(
            fromEvent<PointerEvent>(menuDoc, 'pointerdown', { capture: true }).pipe(
              filter((e) => !this.tabMenuEl()?.nativeElement.contains(e.target as Node)),
            ),
            fromEvent<KeyboardEvent>(menuDoc, 'keydown').pipe(filter((e) => e.key === 'Escape')),
          );
        }),
        tap(() => this.tabMenuOpen.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Inspect mode: while active, listen on the document to map the hovered element to a query.
    const capture = { capture: true };
    toObservable(this.inspectActive)
      .pipe(
        tap((active) => {
          if (!active) this.inspectHover.set(null);
        }),
        switchMap((active) =>
          active
            ? merge(
                fromEvent<MouseEvent>(doc, 'mousemove', capture).pipe(tap((e) => this.updateInspectHover(e))),
                fromEvent<MouseEvent>(doc, 'click', capture).pipe(tap((e) => this.selectInspectedQuery(e))),
                fromEvent<KeyboardEvent>(doc, 'keydown', capture).pipe(
                  tap((e) => {
                    if (e.key === 'Escape') this.inspectActive.set(false);
                  }),
                ),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Closing while popped out docks back instead: the panel a pop-out shows is the very element the
   * `@if` below would destroy, so it has to come home before it can be closed.
   */
  protected toggleOpen() {
    if (this.poppedOut()) {
      this.dockBack();

      return;
    }

    this.open.update((v) => !v);
  }

  protected toggleDock() {
    this.dock.update((current) => (current === 'bottom' ? 'right' : 'bottom'));
  }

  protected toggleTabMenu() {
    this.tabMenuOpen.update((v) => !v);
  }

  protected selectTab(tab: DevtoolsTab) {
    this.activeTab.set(tab);
    this.tabMenuOpen.set(false);
  }

  /**
   * Moves the panel into a window of its own - the same element, adopted by the pop-up's document, so
   * every signal binding in it keeps updating from the app it is inspecting.
   *
   * The panel's styles are global `<style>` tags in the host document, and the theming tokens it reads
   * hang off the root element, so both are copied over; without them the pop-out renders unstyled.
   */
  protected popOut() {
    const panel = this.panelEl()?.nativeElement;

    if (!panel || this.poppedOut()) return;

    // Navigated to rather than written into: a pop-up left on `about:blank` keeps its URL as the window
    // title whatever `document.title` says, and a document written into one is quirks-mode - where a
    // table ignores the font size it inherits, so the Cache and Events tables come out half again as
    // large as the panel around them. The blob carries the doctype and the title with it instead.
    const source = createObjectUrlHandle(new Blob([POPOUT_DOCUMENT], { type: 'text/html' }));
    const popup = source.url ? this.document.defaultView?.open(source.url, 'et-query-devtools', POPOUT_FEATURES) : null;

    if (!popup) {
      source.revoke();

      return;
    }

    // That navigation replaces the pop-up's document, so the panel may only be moved once the new one is
    // there - a panel appended to the initial empty document would be dropped on load.
    fromEvent(popup, 'load')
      .pipe(
        take(1),
        tap(() => {
          source.revoke();
          this.zone.run(() => this.mountPopOut(popup, panel));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  public selectClient(name: string | null) {
    this.selectedClientName.set(name);
    this.inspectFilterIds.set(null);
  }

  public clearInspectFilter() {
    this.inspectFilterIds.set(null);
  }

  public toggleFacet(facet: QueryListFacet) {
    const next = new Set(this.queryFacets());

    if (!next.delete(facet)) next.add(facet);

    this.queryFacets.set(next);
  }

  /** Drops the search term and the status chips, keeping the client / inspection scope. */
  public clearQueryFilters() {
    this.queryFilter.set('');
    this.queryFacets.set(new Set());
  }

  public isQueryPinned(entry: QueryDevtoolsEntry) {
    return this.pinnedQueryIds().has(entry.id);
  }

  public toggleQueryPin(entry: QueryDevtoolsEntry) {
    const next = new Set(this.pinnedQueryIds());

    if (!next.delete(entry.id)) next.add(entry.id);

    this.pinnedQueryIds.set(next);
  }

  protected toggleInspect() {
    this.inspectActive.update((v) => !v);
  }

  protected startResize(event: PointerEvent) {
    event.preventDefault();
    this.drag.set({ kind: 'panel', doc: this.document });
  }

  public startPaneResize(event: PointerEvent, target: { pane: PaneTarget; container: HTMLElement }) {
    event.preventDefault();
    this.drag.set({ kind: 'pane', ...target, axis: this.paneAxis(), doc: target.container.ownerDocument });
  }

  /** Hands a pane back to the stylesheet's proportional default, on the axis it is being sized along. */
  public resetPaneSize(pane: PaneTarget) {
    this.paneSize(pane, this.paneAxis()).set(null);
  }

  protected inspectLabel(entries: QueryDevtoolsEntry[]) {
    const first = entries[0];
    if (entries.length === 1 && first) {
      return `${first.meta.method ?? ''} ${this.queryRoute(first, first.handle as AnyQuery)}`.trim();
    }
    return `${entries.length} queries`;
  }

  /**
   * A query's route, split so the template can tell its static path from its path params (each carrying
   * the value the query used, or `:<name>` while it has none yet) and from the query string of the
   * request that ran - which is what tells two requests to the same endpoint apart.
   */
  public routeSegments(entry: QueryDevtoolsEntry | undefined, query: AnyQuery): RouteSegment[] {
    const parts = entry?.meta.routeParts;
    const search = query.subtle.request()?.url.split('?')[1];
    const querySegment: RouteSegment[] = search ? [{ text: `?${search}`, kind: 'query' }] : [];

    if (!parts?.length) {
      return entry?.meta.route ? [{ text: entry.meta.route, kind: 'static' }, ...querySegment] : [];
    }

    const pathParams = this.queryArgs(query)?.['pathParams'] as Record<string, unknown> | undefined;

    const pathSegments = parts.map(({ text, param }): RouteSegment => {
      if (!param) return { text, kind: 'static' };

      const value = pathParams?.[param];

      return { text: value === undefined || value === null ? `:${param}` : String(value), kind: 'param', name: param };
    });

    return [...pathSegments, ...querySegment];
  }

  /** The full URL of the request a query last made, or `null` while it has not executed. */
  public requestUrl(query: AnyQuery) {
    return query.subtle.request()?.url ?? null;
  }

  /**
   * The args of a query. A query executed imperatively (`execute({ args })`, a sequence step, an auth
   * query) never writes them to its own `args` signal - only the `withArgs` feature does - so the args
   * its current request was built from stand in.
   */
  public queryArgs(query: AnyQuery) {
    return query.args() ?? query.subtle.request()?.args ?? null;
  }

  public queryStatus(query: AnyQuery): QueryStatus {
    const state = query.executionState();
    if (!state) return 'idle';
    if (state.type === 'loading') return 'loading';
    if (state.type === 'failure') return 'error';
    return 'success';
  }

  /**
   * A request in flight is already refreshing, so reporting it as stale on top of `loading` is noise -
   * the same precedence the cache tab's freshness column applies.
   */
  public isStale(query: AnyQuery) {
    try {
      const request = query.subtle.request();

      if (!request || request.loading()) return false;

      return request.isStale();
    } catch {
      return false;
    }
  }

  /**
   * Whether an entry is showing something other than what the server actually sent - an armed response
   * override, or a devtools fault that decided its last completed run. Deliberately not "a fault is
   * armed nearby": an armed-but-idle fault (a `failRate` under 100, say) mostly lets requests through
   * untouched, so that would over-claim for the vast majority of queries on that client.
   */
  public isTampered(entry: QueryDevtoolsEntry) {
    return (entry.overrides?.list().length ?? 0) > 0 || (entry.stats?.current().lastResponseWasFaulted ?? false);
  }

  /**
   * What a query's current request is doing beyond being loading, or `null` when there is nothing beyond
   * the status dot to say - so the readout only takes up room while it carries something.
   */
  public requestProgress(query: AnyQuery): RequestProgress | null {
    const request = query.subtle.request();

    if (!request) return null;

    const retry = request.subtle.retryState();
    const attempts = request.subtle.attempts();
    // The request's own loading state, not the query's: a forced loading state carries no progress, and
    // reading the query's would report the forced one as a transfer that never started.
    const progress = request.loading()?.progress ?? null;

    if (!retry && !progress && attempts < 2) return null;

    // The countdown is a `Date.now()` comparison, so the clock is what makes it tick down - the same trap
    // `isStale` documents.
    this.clock();

    return { attempts, retry, retryInMs: retry ? Math.max(0, retry.startsAt - Date.now()) : null, progress };
  }

  /** Why a retry was scheduled, as the panel spells it out. A status of 0 never reached the server. */
  public retryCause(status: number) {
    return status ? `after ${status}` : 'after a connection failure';
  }

  public formatPercent(percentage: number) {
    return `${Math.round(percentage)}%`;
  }

  /** A countdown in whole seconds, spelled out the way the cache freshness column does. */
  public formatCountdown(ms: number | null) {
    return ms === null ? '—' : `${Math.ceil(ms / 1000)}s`;
  }

  public queryActivity(entry: QueryDevtoolsEntry): QueryActivity {
    return this.activityOf([entry.stats]);
  }

  public linkActivity(link: QueryLink): QueryActivity {
    return this.activityOf([link.stats]);
  }

  public stackActivity(stack: AnyQueryStack | AnyPagedQueryStack): QueryActivity {
    return this.activityOf(this.queriesForStack(stack).map((link) => link.stats));
  }

  public sequenceActivity(sequence: QuerySequence<unknown[]>): QueryActivity {
    return this.activityOf(this.queriesForSequence(sequence).map((link) => link.stats));
  }

  /** Clears an entry's counters and run history, so the next interaction can be measured on its own. */
  public resetStats(entry: QueryDevtoolsEntry) {
    entry.stats?.reset();
    this.diffRunIndex.set(null);
    this.diffBaseRunIndex.set(null);
    this.errorRunIndex.set(null);
  }

  /** A query's runs, newest first - the order a history is read in. */
  public queryRuns(entry: QueryDevtoolsEntry): QueryDevtoolsRun[] {
    return [...(entry.stats?.runs() ?? [])].reverse();
  }

  /**
   * What a run's status dot and timeline bar colour by. `pending` reuses the panel's loading colour;
   * `aborted` matches no rule and so falls back to the neutral one.
   */
  public runStatus(run: QueryDevtoolsRun) {
    return run.status === 'pending' ? 'loading' : run.status;
  }

  /**
   * Whether a run can be an end of the diff: it still holds its body, and so does some other run of the
   * same query. Deliberately not "an *older* run" - a free pair means the oldest body held is pickable
   * too, as the base of a comparison against something newer.
   */
  public canDiffRun(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun) {
    if (!run.hasResponse) return false;

    return (entry.stats?.runs() ?? []).some((other) => other.hasResponse && other.index !== run.index);
  }

  /**
   * Arms a run as one end of the diff, or - with one end already armed - as the other. Clicking either
   * end clears both.
   */
  public toggleRunDiff(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun) {
    const ends = this.diffEnds(entry);

    // Nothing armed to extend, so the click starts over - which is also how the slots recover after a
    // body was trimmed out from under one of them.
    if (!ends) {
      this.diffRunIndex.set(run.index);
      this.diffBaseRunIndex.set(null);

      return;
    }

    if (run.index === ends.before.index || run.index === ends.after?.index) {
      this.diffRunIndex.set(null);
      this.diffBaseRunIndex.set(null);

      return;
    }

    this.diffBaseRunIndex.set(run.index);
  }

  /** Which end of the comparison a run is, so a row says so and the two ends read differently. */
  public diffRunRole(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun): 'base' | 'compare' | null {
    const ends = this.diffEnds(entry);

    if (!ends) return null;
    if (run.index === ends.before.index) return 'base';

    return run.index === ends.after?.index ? 'compare' : null;
  }

  public responseDiff(entry: QueryDevtoolsEntry) {
    const ends = this.diffEnds(entry);

    if (!ends?.after) return null;

    return {
      before: ends.before,
      after: ends.after,
      diff: diffQueryDevtoolsResponses(ends.before.response, ends.after.response),
    };
  }

  public toggleRunError(run: QueryDevtoolsRun) {
    this.errorRunIndex.update((current) => (current === run.index ? null : run.index));
  }

  /**
   * The error body of the picked run. Read off the run rather than off `query.error()`, which is the
   * only other place a failure is legible and is blanked by anything that resets the query - a logout
   * resets every secure query, so a 401 is gone from there by the time it is looked for.
   */
  public pickedRunError(entry: QueryDevtoolsEntry) {
    const picked = this.errorRunIndex();

    if (picked === null) return null;

    const run = (entry.stats?.runs() ?? []).find((candidate) => candidate.index === picked);

    if (!run?.error?.hasBody) return null;

    return { run, error: run.error };
  }

  /** Opens a query in the Queries tab - the Events tab is a way in, not a dead end. */
  public selectQuery(id: string) {
    this.activeTab.set('queries');
    this.selectedQueryId.set(id);
  }

  /** A value on one line, for a diff row or a form field. The full tree would bury the row it sits in. */
  public inlineValue(value: unknown) {
    if (typeof value === 'string') return value.length > 80 ? `"${value.slice(0, 80)}…"` : `"${value}"`;
    if (value === undefined) return 'undefined';

    try {
      const json = JSON.stringify(value) ?? 'undefined';

      return json.length > 80 ? `${json.slice(0, 80)}…` : json;
    } catch {
      return '[unserializable]';
    }
  }

  public formatBytes(bytes: number) {
    if (bytes < 1000) return `${bytes} B`;
    if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;

    return `${(bytes / 1_000_000).toFixed(2)} MB`;
  }

  /**
   * A transferred size, marked `≈` when any part of it was measured from a decoded body instead of read
   * from a `content-length` header - such a size ignores transport compression.
   */
  public formatTransferred(bytes: number, isEstimated: boolean) {
    return `${isEstimated ? '≈' : ''}${this.formatBytes(bytes)}`;
  }

  /** A transfer rate, given in bytes per second the way `HttpRequestLoadingProgressState.speed` reports it. */
  public formatSpeed(bytesPerSecond: number) {
    return `${this.formatBytes(Math.round(bytesPerSecond))}/s`;
  }

  public formatDuration(ms: number | null) {
    if (ms === null) return '—';

    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Replays a query with the args the panel is already showing. `execute()` would otherwise default to
   * `state.args()`, which only `withArgs` ever writes - so a query executed imperatively, by a sequence
   * step or as an auth query would replay with no args at all and a function route would throw.
   */
  public executeQuery(selection: QueryDevtoolsSelection, allowCache: boolean) {
    const { query } = selection;

    try {
      query.execute({ args: this.queryArgs(query), options: allowCache ? { allowCache: true } : undefined });
    } catch (error) {
      this.openArgsEditor(selection);
      this.editError.set(actionErrorMessage(error));
    }
  }

  public resetQuery(query: AnyQuery) {
    query.reset();
  }

  /**
   * Copies a shareable report (path, args, status, slimmed response) for handing to an API dev.
   * Writes both rich `text/html` (Slack applies formatting on paste - it does not parse markdown) and
   * a plain-text fallback.
   */
  public copyReport(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const error = query.error();
    const httpStatus = error ? error.raw.status : this.responseStatus(query);
    const method = entry.meta.method ?? '';

    // The URL actually requested already contains the base URL and the resolved params, so the client
    // is only spelled out separately when the query has not run and only its `:param` template is known.
    const requestUrl = this.requestUrl(query);
    const route = requestUrl ?? entry.meta.route ?? '-';
    const client = requestUrl ? '' : (entry.meta.clientBaseUrl ?? entry.meta.clientName ?? '');
    const statusLine = `status: ${this.queryStatus(query)}${httpStatus !== null ? ` (${httpStatus})` : ''} · ${this.formatTime(query.lastTimeExecutedAt())}`;
    const features = entry.meta.features?.length
      ? `features: ${entry.meta.features.map((feature) => this.featureSummary(feature)).join(' | ')}`
      : null;
    const activity = this.activitySummary(this.queryActivity(entry));
    const gqlDoc = entry.meta.gqlQuery ? this.gqlDocument(entry.meta.gqlQuery) : null;
    const args = this.queryArgs(query);
    const argsLabel = gqlDoc ? 'Variables' : 'Args';
    const argsJson = args !== null && args !== undefined ? JSON.stringify(args, null, 2) : null;
    const bodyLabel = error ? `Error (${error.raw.status})` : 'Response';
    const bodyContent = error
      ? error.isList
        ? error.errors.map((e) => e.message).join('\n')
        : error.error.message
      : JSON.stringify(slimForReport(query.response()), null, 2);

    const textParts = [`${method} ${route}${client ? ` - ${client}` : ''}`, statusLine];
    if (activity) textParts.push(activity);
    if (features) textParts.push(features);
    if (gqlDoc) textParts.push('', 'GraphQL document', gqlDoc);
    if (argsJson) textParts.push('', argsLabel, argsJson);
    textParts.push('', bodyLabel, bodyContent);
    const text = textParts.join('\n');

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const htmlParts = [
      `<b>${esc(method)}</b> <code>${esc(route)}</code>${client ? ` - <code>${esc(client)}</code>` : ''}`,
      esc(statusLine),
    ];
    if (activity) htmlParts.push(esc(activity));
    if (features) htmlParts.push(esc(features));
    if (gqlDoc) htmlParts.push('<b>GraphQL document</b>', `<pre><code>${esc(gqlDoc)}</code></pre>`);
    if (argsJson) htmlParts.push(`<b>${argsLabel}</b>`, `<pre><code>${esc(argsJson)}</code></pre>`);
    htmlParts.push(`<b>${esc(bodyLabel)}</b>`, `<pre><code>${esc(bodyContent)}</code></pre>`);
    const html = htmlParts.join('<br>');

    this.writeToClipboard({ html, text }, this.copiedReport);
  }

  // --- Insomnia export ---

  /** Copies one query as an Insomnia collection, for `Import > From Clipboard`. */
  public copyInsomniaRequest(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const requests = [this.exportedRequest(entry, query)];
    const json = JSON.stringify(
      buildInsomniaExport({
        name: `${entry.meta.clientName ?? 'query'} · ${this.queryRoute(entry, query) || 'request'}`,
        requests,
        tokenRefreshes: this.insomniaTokenRefreshes(requests),
        now: Date.now(),
      }),
      null,
      2,
    );

    this.writeToClipboard({ text: json }, this.copiedInsomnia);
  }

  /**
   * Copies one query as a `curl` command - what goes into a terminal, a ticket or a chat message, where
   * an Insomnia collection is too heavy to be read at all.
   */
  public copyCurlRequest(entry: QueryDevtoolsEntry, query: AnyQuery) {
    this.writeToClipboard({ text: buildCurlCommand(this.exportedRequest(entry, query)) }, this.copiedCurl);
  }

  /** Copies the GraphQL document as displayed — dedented, so it pastes straight into a playground. */
  public copyGqlDocument(doc: string) {
    this.writeToClipboard({ text: this.gqlDocument(doc) }, this.copiedGql);
  }

  /**
   * The endpoint of a query as one string: the absolute URL its last request used, or - for a query
   * that has not run - the rendered route on screen.
   */
  public copyableRoute(entry: QueryDevtoolsEntry, query: AnyQuery) {
    return this.requestUrl(query) ?? this.queryRoute(entry, query);
  }

  /** Names which of the two strings {@link copyableRoute} is offering, so the button says what it copies. */
  public copyableRouteTitle(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const route = this.copyableRoute(entry, query);
    const kind = this.requestUrl(query) ? 'the absolute URL of the last request' : 'the rendered route';

    return `Copy ${kind}: ${route}`;
  }

  /** Copies {@link copyableRoute} - the endpoint on its own, where the exports are a whole document. */
  public copyRoute(entry: QueryDevtoolsEntry, query: AnyQuery) {
    this.writeToClipboard({ text: this.copyableRoute(entry, query) }, this.copiedRoute);
  }

  /**
   * Downloads the given queries (already scoped/filtered by the caller) as one Insomnia collection,
   * filed into a folder per query client.
   */
  public downloadInsomniaCollection(
    items: { entry: QueryDevtoolsEntry; query: AnyQuery }[],
    clientLabel: string | null,
  ) {
    if (!items.length) return;

    const requests = items.map(({ entry, query }) => this.exportedRequest(entry, query));
    const json = JSON.stringify(
      buildInsomniaExport({
        name: `${clientLabel ?? 'ethlete'} queries`,
        requests,
        tokenRefreshes: this.insomniaTokenRefreshes(requests),
        now: Date.now(),
      }),
      null,
      2,
    );

    this.downloadFile(`insomnia-${clientLabel ?? 'ethlete'}-queries.json`, json);
  }

  // --- Session export ---

  /**
   * Downloads the whole panel as one JSON file: every registered entry with what it ran and what it
   * holds, the event log, the cache totals and anything armed in the Faults tab. Unlike **Copy report**
   * this is not scoped to one query - it is the attachment for a bug report about a screen.
   *
   * Deliberately unfiltered: a report is read by someone who was not there, and a dump that silently
   * left out the client you were not looking at is worse than no dump.
   */
  protected downloadSession() {
    const now = Date.now();
    const json = JSON.stringify(
      buildQueryDevtoolsSessionExport({
        now,
        location: this.document.location?.href ?? '',
        clients: this.sessionClients(),
        entries: this.sessionEntries(),
        events: this.sessionEvents(),
        faults: this.sessionFaults(),
      }),
      null,
      2,
    );

    this.downloadFile(`query-devtools-session-${now}.json`, json);
  }

  // --- JIT editing ---

  public openResponseEditor(query: AnyQuery) {
    const draft = JSON.stringify(query.response() ?? null, null, 2);

    this.editorSeed = draft;
    this.responseDraft.set(draft);
    this.editError.set(null);
    this.editorMode.set('response');
  }

  public openArgsEditor({ entry, query }: QueryDevtoolsSelection) {
    const args = this.queryArgs(query) ?? emptyArgsSeed(entry);
    const draft = JSON.stringify(editableArgs(args), null, 2);

    this.editedArgsSource = args;
    this.editorSeed = draft;
    this.argsDraft.set(draft);
    this.editError.set(null);
    this.editorMode.set('args');
  }

  public applyResponse(query: AnyQuery) {
    let response: unknown;

    try {
      response = JSON.parse(this.responseDraft());
    } catch {
      this.editError.set('Invalid JSON');

      return;
    }

    try {
      query.subtle.setResponse(response);
      this.editorMode.set('none');
      this.editError.set(null);
    } catch (error) {
      this.editError.set(actionErrorMessage(error));
    }
  }

  public applyArgs(query: AnyQuery) {
    let args: ReturnType<typeof this.queryArgs>;

    try {
      args = JSON.parse(this.argsDraft());
    } catch {
      this.editError.set('Invalid JSON');

      return;
    }

    try {
      query.execute({ args: executableArgs(args, this.editedArgsSource) });
      this.editorMode.set('none');
      this.editError.set(null);
    } catch (error) {
      this.editError.set(actionErrorMessage(error));
    }
  }

  public cancelEditor() {
    this.editorMode.set('none');
    this.editError.set(null);
  }

  // --- Force states ---

  public forceLoading(query: AnyQuery) {
    // `executionState` prioritises loading > error > response, so clear the others to switch cleanly.
    query.subtle.setError(null);
    query.subtle.setLoading({ executeTime: Date.now(), progress: null });
  }

  public forceError(query: AnyQuery) {
    query.subtle.setLoading(null);
    // A real failed execution also drops the response, so mirror that for consumers bound to it.
    query.subtle.setResponse(null);
    query.subtle.setError(
      createQueryErrorResponse(
        new HttpErrorResponse({
          status: 500,
          statusText: 'Forced',
          error: { message: 'Forced error (devtools)' },
        }),
      ),
    );
  }

  public forceEmpty(query: AnyQuery) {
    query.subtle.setLoading(null);
    query.subtle.setError(null);
    query.subtle.setResponse(null);
  }

  public clearForced(query: AnyQuery) {
    query.subtle.setLoading(null);
    query.subtle.setError(null);
  }

  // --- Cache actions ---

  public refetchCacheEntry(entry: QueryRepositoryCacheEntry) {
    entry.request.execute();
  }

  public evictCacheEntry(repository: QueryRepository, key: string) {
    repository.subtle.evict(key);
  }

  /**
   * Drops every entry of one client, consumers included - the cold-start check that does not need a
   * reload. A query still bound to an evicted entry requests again on its next execution.
   */
  public evictAllCacheEntries(repository: QueryRepository) {
    for (const entry of repository.subtle.cacheEntries()) repository.subtle.evict(entry.key);
  }

  /**
   * Expands the response held under a cache key, which is the only way to read an entry no live query is
   * bound to any more - the Queries tab has nothing to select for it.
   */
  public toggleCacheValue(clientName: string, key: string) {
    const id = `${clientName}|${key}`;

    this.expandedCacheKey.update((current) => (current === id ? null : id));
  }

  public isCacheValueExpanded(clientName: string, key: string) {
    return this.expandedCacheKey() === `${clientName}|${key}`;
  }

  public cacheFreshness(entry: QueryRepositoryCacheEntry) {
    this.clock();
    if (entry.request.loading()) return 'refreshing…';
    const expiresAt = entry.request.expiresAt();
    if (expiresAt === null) return 'uncacheable';
    const ms = expiresAt - Date.now();
    return ms <= 0 ? 'stale' : `${Math.ceil(ms / 1000)}s`;
  }

  /**
   * What multi-tab sync is doing for a cache entry: whether this tab is the one polling the key, and
   * how long ago it last took a response from another tab. Empty when the client has no sync.
   */
  public cacheSync(entry: QueryRepositoryCacheEntry, pollStates: Record<string, QueryKeyLockState>) {
    this.clock();

    const parts: string[] = [];
    const pollState = pollStates[entry.key];

    if (pollState) parts.push(pollState === 'holder' ? 'polling' : 'standby');

    const lastSyncedAt = entry.request.subtle.lastExternalResponseAt();

    if (lastSyncedAt !== null) parts.push(`synced ${Math.max(0, Math.round((Date.now() - lastSyncedAt) / 1000))}s ago`);

    return parts.join(' · ') || '-';
  }

  /**
   * Whether a cache entry is showing data that came off the disk rather than the network - the answer
   * to "why is this here already?" on a cold start. Empty when the client does not persist responses.
   */
  public cachePersistence(entry: QueryRepositoryCacheEntry) {
    this.clock();

    const hydratedAt = entry.request.subtle.lastPersistedResponseAt();

    if (hydratedAt === null) return '-';

    return `from disk ${Math.max(0, Math.round((Date.now() - hydratedAt) / 1000))}s ago`;
  }

  /** How many responses this client has on disk, which is usually more than it has in memory. */
  public persistedCount(client: QueryClient) {
    this.clock();

    return client.subtle.persistence?.indexEntries().length ?? 0;
  }

  public clearPersistedQueries(client: QueryClient) {
    void client.clearPersistedQueries();
  }

  /** The path + query of a request URL (origin stripped), for readable cache/event identifiers. */
  public requestPath(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  // --- Typed template accessors (entry.handle is `unknown`) ---

  public asStack(entry: QueryDevtoolsEntry): AnyQueryStack {
    return entry.handle as AnyQueryStack;
  }

  public asPagedStack(entry: QueryDevtoolsEntry): AnyPagedQueryStack {
    return entry.handle as AnyPagedQueryStack;
  }

  public asSequence(entry: QueryDevtoolsEntry): QuerySequence<unknown[]> {
    return (entry.handle as { current: QuerySequence<unknown[]> }).current;
  }

  public asAuth(entry: QueryDevtoolsEntry): AnyBearerAuthProvider {
    return entry.handle as AnyBearerAuthProvider;
  }

  public asWs(entry: QueryDevtoolsEntry): WebSocketDevtoolsHandle {
    return entry.handle as WebSocketDevtoolsHandle;
  }

  /**
   * A socket's messages, narrowed by the filter box. Every whitespace-separated term has to match the
   * event, the room or the direction, so `out join` finds the room joins the client sent.
   */
  public socketMessages(ws: WebSocketDevtoolsHandle) {
    const messages = ws.messages();
    const terms = this.socketFilter().trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (!terms.length) return messages;

    return messages.filter((message) => {
      const haystack = `${message.direction} ${message.event} ${message.room}`.toLowerCase();

      return terms.every((term) => haystack.includes(term));
    });
  }

  /** How the message log labels a direction: what the client sent, versus what the server pushed. */
  public socketDirectionLabel(message: WebSocketDevtoolsMessage) {
    return message.direction === 'out' ? '↑ sent' : '↓ received';
  }

  /**
   * Sends a message as the app would, so a server that only answers a client that asked can be provoked
   * from the panel. An empty payload sends nothing rather than `""` - a plain event is a valid message.
   */
  public emitSocketMessage(options: { entry: QueryDevtoolsEntry; event: string; data: string }) {
    const { entry, event, data } = options;
    const name = event.trim();

    if (!name) {
      this.socketEmitError.set({ entryId: entry.id, message: 'An event name is required.' });

      return;
    }

    const payload = data.trim();

    try {
      this.asWs(entry).emit({ event: name, data: payload ? JSON.parse(payload) : undefined });
      this.socketEmitError.set(null);
    } catch {
      this.socketEmitError.set({ entryId: entry.id, message: 'Invalid JSON' });
    }
  }

  public socketEmitErrorFor(entryId: string) {
    const error = this.socketEmitError();

    return error?.entryId === entryId ? error.message : null;
  }

  public asForm(entry: QueryDevtoolsEntry): QueryDevtoolsFormHandle {
    return entry.handle as QueryDevtoolsFormHandle;
  }

  /**
   * The queries a form feeds, discovered from the reads its `value()` recorded while their args were
   * built - so a form that nothing consumes yet reads as exactly that.
   */
  public queriesDrivenByForm(entry: QueryDevtoolsEntry): QueryLink[] {
    return this.queryEntries()
      .filter((candidate) => candidate.formLinks?.ids().includes(entry.id))
      .map((candidate) => this.queryLinkFor(candidate));
  }

  /** The reverse: the forms whose value a query's args read. */
  public formsDrivingQuery(entry: QueryDevtoolsEntry): QueryDevtoolsEntry[] {
    const ids = entry.formLinks?.ids() ?? [];

    return this.formEntries().filter((form) => ids.includes(form.id));
  }

  public selectForm(id: string) {
    this.activeTab.set('forms');
    this.selectedFormId.set(id);
  }

  /**
   * The refreshes that re-executed a query, newest first - the answer to "why did this refetch?". Read
   * off the event log, so it goes back exactly as far as the log does.
   */
  public refreshesFor(entryId: string) {
    return this.eventLog()
      .filter((item) => item.cause && item.refreshed?.some((refreshed) => refreshed.queryIds.includes(entryId)))
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        label: this.causeLabel(item.cause as QueryRefreshCause),
      }));
  }

  /** What asked for a refresh, on one line. */
  public causeLabel(cause: QueryRefreshCause) {
    const scope = cause.url ? this.requestPath(cause.url) : 'everything in use';
    const what =
      cause.type === 'invalidation'
        ? `invalidated ${scope}`
        : cause.type === 'mutation'
          ? `mutation on ${scope}`
          : `refreshed ${scope}`;

    return cause.otherTab ? `${what} · another tab` : what;
  }

  /** Derives the per-step status of a sequence step from its live progress signals. */
  public sequenceStepStatus(sequence: QuerySequence<unknown[]>, index: number): QuerySequenceStatus {
    const failedAt = sequence.failedAt();
    if (failedAt !== null && index === failedAt) return 'error';

    const current = sequence.currentStep();
    const running = sequence.running();

    if (index < current - 1) return 'success';
    if (index === current - 1 && running) return 'running';
    if (sequence.status() === 'success') return 'success';

    return 'idle';
  }

  public authTokenPayload(auth: AnyBearerAuthProvider): Record<string, unknown> | null {
    return decodeJwtPayload(auth.accessToken());
  }

  public queriesForStack(stack: AnyQueryStack | AnyPagedQueryStack): QueryLink[] {
    const inner = stack.queries();
    const queryEntries = this.queryEntries();

    return inner.map((query) =>
      this.queryLinkFor(
        queryEntries.find((e) => e.handle === query),
        query as AnyQuery,
      ),
    );
  }

  public authQueryKeys(auth: AnyBearerAuthProvider): string[] {
    return Object.keys(auth.queries ?? {});
  }

  /**
   * Which tab refreshes this provider's tokens, as a chip: whether it is this one, how many tabs are
   * in the election, and - when there is no election - why every tab reads as the leader.
   */
  public authLeadership(auth: AnyBearerAuthProvider): QueryDevtoolsLeadership | null {
    const sync = (auth.features as { multiTabSync?: BearerAuthMultiTabSyncFeature } | undefined)?.multiTabSync;
    if (!sync) return null;

    if (sync.leadership !== 'election') {
      const reason =
        sync.leadership === 'off'
          ? 'Leader election is off, so every tab refreshes its own tokens - this one included.'
          : 'This browser has no Web Locks API, so the election cannot run and every tab refreshes its own tokens.';

      return { label: 'every tab refreshes', tone: 'muted', title: reason };
    }

    const tabs = sync.instanceCount();
    const isLeader = sync.isLeader();
    // The count is recounted on announce, goodbye and takeover rather than on a timer, so a tab that
    // crashed as a follower is still in it. Presenting it as exact would turn that into a bug report.
    const title = `${isLeader ? 'This tab performs the automatic token refresh.' : 'Another tab performs the automatic token refresh.'} ${tabs} tab${tabs === 1 ? '' : 's'} in the election, counted on the last announce - a tab that crashed as a follower is still counted.`;

    return {
      label: `${isLeader ? 'leader' : 'follower'} · ~${tabs} tab${tabs === 1 ? '' : 's'}`,
      tone: isLeader ? 'success' : 'muted',
      title,
    };
  }

  /** Countdown to the access-token's `exp` (the point a refresh becomes due), or `null` if unknown. */
  public authTokenExpiry(auth: AnyBearerAuthProvider): string | null {
    this.clock();
    const payload = decodeJwtPayload(auth.accessToken());
    const exp = typeof payload?.['exp'] === 'number' ? payload['exp'] : null;
    if (exp === null) return null;

    const seconds = Math.round((exp * 1000 - Date.now()) / 1000);
    if (seconds <= 0) return 'expired';
    if (seconds < 120) return `${seconds}s`;
    if (seconds > 86400) return `${Math.floor(seconds / 86400)}d`;

    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }

  public queriesForSequence(sequence: QuerySequence<unknown[]>): QueryLink[] {
    const queryEntries = this.queryEntries();

    return sequence.queries.map((query) =>
      this.queryLinkFor(
        queryEntries.find((e) => e.handle === query),
        query as AnyQuery,
      ),
    );
  }

  /** The snapshot of a sequence step, once it has run (holds the args in and the response/error out). */
  public stepSnapshot(sequence: QuerySequence<unknown[]>, index: number): AnyQuerySnapshot | null {
    return sequence.snapshots()[index] ?? null;
  }

  public toggleQueryGroup(key: string) {
    const next = new Set(this.expandedQueryGroups());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedQueryGroups.set(next);
  }

  public isStepExpanded(entryId: string, index: number) {
    return this.expandedSteps().has(this.stepKey(entryId, index));
  }

  public toggleStep(entryId: string, index: number) {
    const key = this.stepKey(entryId, index);
    const next = new Set(this.expandedSteps());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedSteps.set(next);
  }

  /** Dedents a GraphQL document (template-literal indentation) for readable display. */
  public gqlDocument(doc: string) {
    const lines = doc.replace(/\t/g, '  ').split('\n');
    while (lines.length && !lines[0]?.trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1]?.trim()) lines.pop();
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)?.[0].length ?? 0);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(min)).join('\n');
  }

  public featureLabel(type: string) {
    return type
      .replace(/^WITH_/, '')
      .replace(/_/g, ' ')
      .toLowerCase();
  }

  /** A feature and its options on one line, for a report or a chip's tooltip. */
  public featureSummary(feature: QueryDevtoolsFeature) {
    const details = feature.details.map((detail) => `${detail.label} ${detail.value}`);

    return [this.featureLabel(feature.type), ...details].join(' · ');
  }

  /** The features of the client behind a cache tab card, or `null` for a client without any. */
  public clientFeatures(client: QueryClient | null | undefined) {
    const features = client?.subtle.devtoolsFeatures ?? [];

    return features.length ? features : null;
  }

  public formatTime(timestamp: number | null) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false });
  }

  /**
   * The element a query was created in, which is what {@link locateQuery} can point at. `null` for a
   * query created outside a component or directive injector - a root service, a resolver, a guard.
   */
  public locatableElement(entry: QueryDevtoolsEntry) {
    return entry.meta.element ?? null;
  }

  /**
   * Scrolls the element the selected query was created in into view and draws the inspect box over it -
   * inspect run backwards. Where a query was *created* is not necessarily where its data is rendered,
   * which is what the button's "created here" wording is for.
   */
  public locateQuery(entry: QueryDevtoolsEntry) {
    const element = this.locatableElement(entry);
    if (!element) return;

    // Detached, `display: none`, or inside a collapsed panel: scrolling to it lands nowhere and the box
    // would be drawn over an unrelated strip of the page.
    const isVisible = typeof element.checkVisibility === 'function' ? element.checkVisibility() : element.isConnected;

    if (!isVisible) {
      this.locatedRect.set(null);
      this.locateState.set('offscreen');
      this.locate$.next(null);

      return;
    }

    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    this.locateState.set('located');
    this.locate$.next(element);
  }

  /**
   * The two runs the diff compares, oldest first - normalised by run index, so picking a pair in either
   * order reads the same way round as the `#before → #after` header prints it.
   *
   * `null` unless a run is picked, so a closed diff costs nothing to walk.
   */
  /**
   * The two runs the comparison spans, oldest first - normalised by run index, so picking a pair in
   * either order reads the same way round as the `#before → #after` header prints it. With only one end
   * armed, `after` is absent unless an older body-holding run can stand in for the base.
   *
   * `null` unless a run is armed, so a closed diff costs nothing to walk.
   */
  private diffEnds(entry: QueryDevtoolsEntry) {
    const runs = entry.stats?.runs() ?? [];
    const held = (index: number | null) =>
      index === null ? undefined : runs.find((run) => run.index === index && run.hasResponse);

    // An armed run whose body has since been trimmed counts as unarmed. Quietly re-deriving the other end
    // instead would show a different comparison under a header still naming the one that was picked.
    const picked = held(this.diffRunIndex());

    if (!picked) return null;

    const other = held(this.diffBaseRunIndex());

    if (other && other.index !== picked.index) {
      const [before, after] = other.index < picked.index ? [other, picked] : [picked, other];

      return { before, after };
    }

    for (let index = runs.indexOf(picked) - 1; index >= 0; index--) {
      const before = runs[index];

      if (before?.hasResponse) return { before, after: picked };
    }

    // Armed with nothing older holding a body, so this is one end of a pair still to be completed rather
    // than a comparison. Reporting it as an end anyway is what keeps the pick from being thrown away.
    return { before: picked, after: undefined };
  }

  private isTabPrimary(tab: DevtoolsTab) {
    const badge = this.tabBadges()[tab];

    return this.PINNED_TABS.includes(tab) || this.activeTab() === tab || !!badge.count || !!badge.errors;
  }

  /** Moves the panel into a pop-up whose document has finished loading. @see popOut */
  private mountPopOut(popup: Window, panel: HTMLElement) {
    const doc = popup.document;
    const renderer = this.renderer;

    renderer.setAttribute(doc.documentElement, 'class', this.document.documentElement.className);
    renderer.setAttribute(doc.documentElement, 'style', this.document.documentElement.getAttribute('style') ?? '');
    renderer.setAttribute(doc.body, 'class', this.document.body.className);

    // Inserted before the stylesheets it applies to: a blob document's own base URL is the blob, so a
    // copied `<link href="styles.css">` - and every relative `url()` inside a copied `<style>` - would
    // resolve against nothing and silently fail to load.
    const base = renderer.createElement('base');

    renderer.setAttribute(base, 'href', this.document.baseURI);
    renderer.appendChild(doc.head, base);

    for (const styles of DEFERRED_STYLES) this.styleManager.mount(styles);

    for (const node of Array.from(this.document.head.children)) {
      if (!this.isStyleNode(node)) continue;

      renderer.appendChild(doc.head, doc.importNode(node, true));
    }

    // The panel's chrome tokens (`--_et-qdt-*`) are declared on the host element and inherited from it,
    // so a panel appended straight to the pop-up's body would lose every background, border and chip
    // fill that resolves one. It gets a host of its own instead.
    const shell = renderer.createElement('div');

    renderer.setAttribute(shell, 'class', 'et-query-devtools-host');
    renderer.setAttribute(shell, 'data-dock', 'popout');

    renderer.setCssProperties(shell, this.chromeTokens());
    renderer.appendChild(doc.body, shell);
    renderer.appendChild(shell, panel);

    // The pop-up is a realm of its own, so zone.js never patched its listeners - without the explicit
    // `run` the dock-back would write its signals outside Angular and nothing would re-render.
    fromEvent(popup, 'pagehide')
      .pipe(
        tap(() => this.zone.run(() => this.dockBack())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.popup = popup;
    this.poppedOut.set(true);
  }

  /**
   * The panel's chrome tokens as the app currently resolves them, so a pop-out keeps the surface it was
   * docked in. Its own CSS resolves them from the host app's theme, and that theme is set on an ancestor
   * the pop-out does not have - inherited afresh over there, the panel would take the document's theme
   * (usually the light one) rather than the one it was just being read against.
   *
   * Empty on a browser that does not enumerate custom properties, which leaves the tokens to be
   * inherited as before.
   */
  private chromeTokens() {
    const styles = this.document.defaultView?.getComputedStyle(this.hostEl.nativeElement);
    const tokens: Record<string, string> = {};

    for (const property of Array.from(styles ?? [])) {
      if (property.startsWith('--_et-qdt-')) tokens[property] = styles?.getPropertyValue(property) ?? '';
    }

    return tokens;
  }

  /** Whether a `<head>` child carries CSS the pop-out needs a copy of. */
  private isStyleNode(node: Element) {
    if (node.tagName === 'STYLE') return true;

    return node.tagName === 'LINK' && (node.getAttribute('rel') ?? '').includes('stylesheet');
  }

  /** Brings the panel back into the host element and closes the window it was living in. */
  private dockBack() {
    const panel = this.panelEl()?.nativeElement;

    if (panel) this.renderer.appendChild(this.hostEl.nativeElement, panel);

    this.poppedOut.set(false);
    this.closePopup();
  }

  /** A registered query as a row that opens the detail drawer. */
  private queryLinkFor(entry: QueryDevtoolsEntry | undefined, query = entry?.handle as AnyQuery): QueryLink {
    return {
      id: entry?.id ?? '',
      query,
      method: entry?.meta.method ?? '',
      segments: this.routeSegments(entry, query),
      clientBaseUrl: entry?.meta.clientBaseUrl ?? '',
      stats: entry?.stats,
    };
  }

  /** The activity of one entry, or the total of a group of them (a stack's queries, a whole tab). */
  private activityOf(handles: readonly (QueryDevtoolsStatsHandle | undefined)[]): QueryActivity {
    const stats = sumQueryDevtoolsStats(handles);

    return {
      stats,
      cacheServed: Math.max(0, stats.executions - stats.requests),
      avgDurationMs: stats.responses ? Math.round(stats.totalDurationMs / stats.responses) : null,
      avgResponseBytes: stats.responses ? Math.round(stats.receivedBytes / stats.responses) : null,
      hasActivity: stats.executions > 0,
    };
  }

  /** An activity summary on one line, for a report. `null` for a query that has not run. */
  private activitySummary(activity: QueryActivity) {
    if (!activity.hasActivity) return null;

    const { stats } = activity;
    const parts = [
      `${stats.executions} execution${stats.executions === 1 ? '' : 's'}`,
      `${stats.requests} request${stats.requests === 1 ? '' : 's'}`,
      `↓ ${this.formatTransferred(stats.receivedBytes, stats.hasEstimatedBytes)}`,
    ];

    if (stats.sentBytes) parts.push(`↑ ${this.formatTransferred(stats.sentBytes, stats.hasEstimatedBytes)}`);
    if (stats.errors) parts.push(`${stats.errors} failed`);
    if (stats.retries) parts.push(`${stats.retries} retr${stats.retries === 1 ? 'y' : 'ies'}`);
    if (activity.avgDurationMs !== null) parts.push(`avg ${this.formatDuration(activity.avgDurationMs)}`);

    return `activity: ${parts.join(' · ')}`;
  }

  /** {@link routeSegments} as a plain string, for the places that cannot render markup. */
  private queryRoute(entry: QueryDevtoolsEntry | undefined, query: AnyQuery) {
    return this.routeSegments(entry, query)
      .map((segment) => segment.text)
      .join('');
  }

  /**
   * Describes a query the way a replay outside the app needs it: the URL, headers and body of the
   * request it last made, or - for a query that has not run - what its current args would send.
   */
  private exportedRequest(entry: QueryDevtoolsEntry, query: AnyQuery): InsomniaRequestInput {
    const request = query.subtle.request();
    const args = this.queryArgs(query) as { body?: unknown; headers?: unknown } | null;
    const route = this.queryRoute(entry, query);

    return {
      // A GraphQL query has no HTTP method of its own until it runs; its transport is POST unless the
      // creator says otherwise, which is only knowable from the request.
      method: request?.method ?? (entry.meta.gqlQuery ? 'POST' : (entry.meta.method ?? 'GET')),
      url: request?.url ?? `${entry.meta.clientBaseUrl ?? ''}${route}`,
      // Query params are part of the name so that several requests to the same endpoint (the pages of a
      // stack, a search) stay tellable apart in Insomnia's sidebar.
      name: `${entry.meta.method ?? ''} ${request ? this.requestPath(request.url) : route || query.id() || 'request'}`.trim(),
      headers: this.insomniaHeaders(request, args),
      body: args?.body ?? null,
      gqlQuery: entry.meta.gqlQuery ? this.gqlDocument(entry.meta.gqlQuery) : null,
      group: entry.meta.clientName ?? null,
      secureBy: entry.meta.isSecure ? (entry.meta.authProviderName ?? null) : null,
    };
  }

  /**
   * The token refreshes the given requests authenticate with - one per auth provider they name, and
   * only for a provider that is logged in, since a refresh request without a refresh token has
   * nothing to send.
   */
  private insomniaTokenRefreshes(requests: InsomniaRequestInput[]) {
    const names = new Set(
      requests.map((request) => request.secureBy).filter((name): name is string => typeof name === 'string'),
    );

    return Array.from(names)
      .map((name) => this.insomniaTokenRefresh(name))
      .filter((refresh): refresh is InsomniaTokenRefreshInput => refresh !== null);
  }

  private insomniaTokenRefresh(providerName: string): InsomniaTokenRefreshInput | null {
    const entry = this.authEntries().find((candidate) => candidate.meta.name === providerName);
    const refresh = entry?.meta.authQueries?.find((authQuery) => authQuery.kind === 'token-refresh');

    if (!entry || !refresh) return null;

    const provider = entry.handle as AnyBearerAuthProvider;
    const refreshToken = provider.refreshToken();

    if (!refreshToken) return null;

    return {
      id: providerName,
      name: `${refresh.method} ${refresh.route} (token refresh)`,
      method: refresh.method,
      url: `${entry.meta.clientBaseUrl ?? ''}${refresh.route}`,
      headers: [],
      body: refresh.buildArgs?.(refreshToken).body ?? null,
      group: entry.meta.clientName ?? null,
      accessTokenPath: this.accessTokenPath(provider),
      maxAgeSeconds: this.accessTokenMaxAge(provider),
    };
  }

  /**
   * Where the access token sits in the refresh response. A provider's `extractTokens` can pull it out
   * of any shape, so the path is recovered by finding the live token in the last auth response - with
   * the default extractor's `$.accessToken` as the fallback.
   */
  private accessTokenPath(provider: AnyBearerAuthProvider) {
    const token = provider.accessToken();
    const response = provider.latestExecutedQuery()?.snapshot.response();

    const path = token && response ? findValuePath(token, { value: response, path: '$', depth: 0 }) : null;

    return path ?? '$.accessToken';
  }

  /**
   * How long Insomnia may reuse a stored refresh response: the access token's own lifetime with a
   * margin, so the chain refreshes shortly before the token it hands out would expire. Capped at an
   * hour - a long-lived (or bogus) `exp` should still hand out a token minted this session.
   */
  private accessTokenMaxAge(provider: AnyBearerAuthProvider) {
    const payload = decodeJwtPayload(provider.accessToken());
    const exp = payload?.['exp'];
    const iat = payload?.['iat'];

    if (typeof exp !== 'number') return DEFAULT_TOKEN_MAX_AGE_S;

    const lifetime = exp - (typeof iat === 'number' ? iat : Math.floor(Date.now() / 1000));

    if (lifetime <= 0) return DEFAULT_TOKEN_MAX_AGE_S;

    return Math.min(MAX_TOKEN_MAX_AGE_S, Math.max(60, Math.round(lifetime * 0.9)));
  }

  /**
   * The headers a replay needs, including the ones the query client adds. Header providers can throw
   * (a secure query's needs an access token), in which case the request is exported without them.
   */
  private insomniaHeaders(
    request: { subtle: { resolveHeaders: () => HttpHeaders | undefined } } | null | undefined,
    args: { headers?: unknown } | null,
  ) {
    try {
      const headers = request
        ? request.subtle.resolveHeaders()
        : typeof args?.headers === 'function'
          ? (args.headers as () => HttpHeaders)()
          : (args?.headers as HttpHeaders | undefined);

      return (headers?.keys() ?? []).map((name) => ({ name, value: headers?.getAll(name)?.join(', ') ?? '' }));
    } catch {
      return [];
    }
  }

  private sessionClients(): SessionExportClient[] {
    return this.cacheView().map((client) => ({
      name: client.name,
      baseUrl: client.baseUrl,
      cacheEntries: client.rows.length,
      unusedCacheEntries: client.unused,
      cacheBytes: client.bytes,
      persistedEntries: client.client?.subtle.persistence ? this.persistedCount(client.client) : null,
      features: (client.client?.subtle.devtoolsFeatures ?? []).map((feature) => this.featureSummary(feature)),
    }));
  }

  /** Every registered entry, described by whatever its kind carries. */
  private sessionEntries(): SessionExportEntry[] {
    return queryDevtoolsEntries().map((entry) => {
      const base: SessionExportEntry = {
        id: entry.id,
        kind: entry.kind,
        name: entry.meta.name ?? null,
        client: entry.meta.clientBaseUrl ?? entry.meta.clientName ?? null,
        features: entry.meta.features?.map((feature) => this.featureSummary(feature)) ?? [],
      };

      if (entry.kind === 'query') return { ...base, ...this.sessionQuery(entry) };
      if (entry.kind === 'query-stack' || entry.kind === 'paged-query-stack') {
        const stack = entry.kind === 'paged-query-stack' ? this.asPagedStack(entry) : this.asStack(entry);

        return { ...base, activity: this.sessionActivity(this.stackActivity(stack)) };
      }
      if (entry.kind === 'query-sequence') return { ...base, detail: this.sessionSequence(entry) };
      if (entry.kind === 'query-form') return { ...base, detail: this.sessionForm(entry) };
      if (entry.kind === 'auth-provider') return { ...base, detail: this.sessionAuth(entry) };
      if (entry.kind === 'ws-client') return { ...base, detail: this.sessionSocket(entry) };

      return base;
    });
  }

  private sessionQuery(entry: QueryDevtoolsEntry): Partial<SessionExportEntry> {
    const query = entry.handle as AnyQuery;
    const error = query.error();

    return {
      method: entry.meta.method ?? null,
      route: entry.meta.route ?? null,
      url: this.requestUrl(query),
      status: this.queryStatus(query),
      activity: this.sessionActivity(this.queryActivity(entry)),
      runs: (entry.stats?.runs() ?? []).map((run) => ({
        index: run.index,
        startedAt: new Date(run.startedAt).toISOString(),
        durationMs: run.endedAt === null ? null : run.endedAt - run.startedAt,
        status: run.status,
        attempts: run.attempts,
        didRequest: run.didRequest,
        receivedBytes: run.receivedBytes,
        url: run.url,
      })),
      args: this.queryArgs(query),
      response: query.response() ?? null,
      error: error ? { status: error.raw.status, body: error.isList ? error.errors : error.error } : null,
      overrides: (entry.overrides?.list() ?? []).map((override) => ({ id: override.id, op: override.op })),
    };
  }

  private sessionActivity(activity: QueryActivity): Record<string, unknown> {
    return { ...activity.stats, cacheServed: activity.cacheServed, avgDurationMs: activity.avgDurationMs };
  }

  private sessionSequence(entry: QueryDevtoolsEntry): Record<string, unknown> {
    const sequence = this.asSequence(entry);

    return {
      status: sequence.status(),
      currentStep: sequence.currentStep(),
      total: sequence.total,
      failedAt: sequence.failedAt(),
      steps: this.queriesForSequence(sequence).map((link, index) => ({
        method: link.method,
        route: link.segments.map((segment) => segment.text).join(''),
        status: this.sequenceStepStatus(sequence, index),
        args: sequence.stepArgs()[index] ?? null,
        response: this.stepSnapshot(sequence, index)?.response() ?? null,
      })),
    };
  }

  private sessionForm(entry: QueryDevtoolsEntry): Record<string, unknown> {
    const form = this.asForm(entry);

    return {
      activeFilterCount: form.activeFilterCount(),
      isAtDefaults: form.isAtDefaults(),
      isObserving: form.isObserving(),
      isCommitPending: form.isCommitPending(),
      value: form.value(),
      fields: form.fields().map((field) => ({
        key: field.key,
        value: field.value,
        defaultValue: field.defaultValue,
        paramKey: field.paramKey,
        queryParam: field.queryParam ?? null,
        isDefault: field.isDefault,
      })),
      drives: this.queriesDrivenByForm(entry).map((link) => link.id),
    };
  }

  /**
   * An auth provider without its tokens. A session report is a file that gets attached to a ticket, and
   * the access token is the one thing in the panel that must never travel with it - which is why only
   * its presence and its remaining lifetime are exported.
   */
  private sessionAuth(entry: QueryDevtoolsEntry): Record<string, unknown> {
    const auth = this.asAuth(entry);

    return {
      isAuthenticated: auth.isAuthenticated(),
      hasAccessToken: !!auth.accessToken(),
      hasRefreshToken: !!auth.refreshToken(),
      expiresIn: this.authTokenExpiry(auth),
      queries: this.authQueryKeys(auth),
    };
  }

  private sessionSocket(entry: QueryDevtoolsEntry): Record<string, unknown> {
    const ws = this.asWs(entry);

    return {
      url: entry.meta.url ?? null,
      connected: ws.connected(),
      rooms: ws.rooms(),
      messages: ws.messages().map((message) => ({
        timestamp: new Date(message.timestamp).toISOString(),
        direction: message.direction,
        room: message.room,
        event: message.event,
        data: message.data,
      })),
    };
  }

  private sessionEvents(): SessionExportEvent[] {
    return this.eventLog().map((event) => ({
      timestamp: new Date(event.timestamp).toISOString(),
      client: event.client,
      type: event.type,
      method: event.method,
      url: event.url,
      status: event.status,
      durationMs: event.durationMs,
      bytes: event.bytes,
      cause: event.cause ? this.causeLabel(event.cause) : null,
      refreshed: event.refreshed?.map((refreshed) => `${refreshed.method} ${refreshed.path}`) ?? null,
    }));
  }

  private sessionFaults(): SessionExportFault[] {
    return this.faultClients()
      .filter((client) => client.armed)
      .map((client) => ({ client: client.name, ...client.fault }));
  }

  private downloadFile(fileName: string, content: string) {
    this.download({ content, filename: fileName, type: 'application/json' });
  }

  private stepKey(entryId: string, index: number) {
    return `${entryId}:${index}`;
  }

  private paneSize(pane: PaneTarget, axis: PaneAxis) {
    if (axis === 'block') return pane === 'list' ? this.listHeight : this.drawerHeight;

    return pane === 'list' ? this.listWidth : this.drawerWidth;
  }

  /** The panel's size is the distance from the pointer to the edge it is docked to. */
  private applyResize(drag: ResizeDrag, event: PointerEvent) {
    if (drag.kind === 'pane') {
      this.applyPaneResize(drag, event);

      return;
    }

    const root = this.document.documentElement;

    if (this.dock() === 'right') {
      const viewport = root.clientWidth;

      this.panelWidth.set(clamp(viewport - event.clientX, MIN_WIDTH, Math.round(viewport * 0.9)));

      return;
    }

    const viewport = root.clientHeight;

    this.panelHeight.set(clamp(viewport - event.clientY, MIN_HEIGHT, Math.round(viewport * 0.9)));
  }

  /** A pane's size is the distance from the pointer to the container edge that pane sits against. */
  private applyPaneResize(drag: Extract<ResizeDrag, { kind: 'pane' }>, event: PointerEvent) {
    const rect = drag.container.getBoundingClientRect();
    const leading = drag.pane === 'list';

    if (drag.axis === 'block') {
      const height = leading ? event.clientY - rect.top : rect.bottom - event.clientY;
      const max = Math.max(MIN_PANE_HEIGHT, Math.round(rect.height) - MIN_PANE_HEIGHT);

      this.paneSize(drag.pane, 'block').set(clamp(Math.round(height), MIN_PANE_HEIGHT, max));

      return;
    }

    const width = leading ? event.clientX - rect.left : rect.right - event.clientX;
    const max = Math.max(MIN_PANE_WIDTH, Math.round(rect.width) - MIN_PANE_WIDTH);

    this.paneSize(drag.pane, 'inline').set(clamp(Math.round(width), MIN_PANE_WIDTH, max));
  }

  private closePopup() {
    const popup = this.popup;

    this.popup = null;
    popup?.close();
  }

  private updateInspectHover(event: MouseEvent) {
    const host = this.hostEl.nativeElement;
    const map = this.elementQueryMap();
    let node = event.target as HTMLElement | null;

    // Ignore the devtools UI itself.
    if (node && host.contains(node)) {
      this.inspectHover.set(null);

      return;
    }

    while (node) {
      const entries = map.get(node);

      if (entries) {
        this.inspectHover.set({ rect: node.getBoundingClientRect(), entries });

        return;
      }

      node = node.parentElement;
    }

    this.inspectHover.set(null);
  }

  private selectInspectedQuery(event: MouseEvent) {
    const hover = this.inspectHover();
    const first = hover?.entries[0];

    if (!hover || !first) return;

    event.preventDefault();
    event.stopPropagation();

    const ids = hover.entries.map((e) => e.id);

    this.open.set(true);
    this.activeTab.set('queries');
    this.selectedClientName.set(null);
    this.inspectFilterIds.set(ids);
    // Auto-select when the element owns a single query, otherwise let the user pick from the filtered list.
    this.selectedQueryId.set(ids.length === 1 ? first.id : null);
    this.inspectActive.set(false);
  }

  private selectionKey() {
    return [
      this.selectedQueryId(),
      this.stackSelectedQueryId(),
      this.sequenceSelectedQueryId(),
      this.formSelectedQueryId(),
      this.timelineSelectedQueryId(),
    ].join('|');
  }

  /** Writes to the clipboard and ticks `copied` on success. `html` is omitted for plain-text payloads. */
  private writeToClipboard(payload: { text: string; html?: string }, copied: WritableSignal<boolean>) {
    const clipboard = navigator.clipboard;
    const { text, html } = payload;
    if (!clipboard) return;

    const flag = () => {
      copied.set(true);
      this.copiedReset$.next();
    };

    // Prefer rich HTML (Slack keeps the formatting on paste); fall back to plain text.
    if (html !== undefined && 'write' in clipboard && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      clipboard
        .write([item])
        .then(flag)
        .catch(() => clipboard.writeText(text).then(flag).catch(noop));

      return;
    }

    clipboard.writeText(text).then(flag).catch(noop);
  }

  private responseStatus(query: AnyQuery): number | null {
    const event = query.latestHttpEvent() as { status?: number } | null;
    return typeof event?.status === 'number' ? event.status : null;
  }

  private findQuery(id: string | null) {
    if (!id) return null;
    const entry = this.queryEntries().find((e) => e.id === id);
    return entry ? { entry, query: entry.handle as AnyQuery } : null;
  }

  private pushEvent(event: QueryRepositoryEvent, client: string) {
    // The log is about traffic. A cache entry being created is always followed by the request it made,
    // so a row for it would only ever duplicate the next one.
    if (event.type === 'entry-created') return;

    const base = {
      id: this.eventIdCounter++,
      timestamp: Date.now(),
      client,
      type: event.type,
      cause: null,
      destroyCause: null,
      refreshed: null,
      durationMs: null,
      bytes: null,
      isEstimatedBytes: false,
    };

    // Why an entry went away is otherwise unanswerable: it is gone from the cache view with nothing to
    // say whether a logout, its freshness window, the unused-entry cap or a manual evict took it.
    if (event.type === 'entry-destroyed') {
      this.droppedCacheEntries.update((list) => {
        const next: DroppedCacheEntry[] = [
          { client, method: event.method, url: event.url, cause: event.cause, at: base.timestamp },
          ...list,
        ];
        let kept = 0;

        return next.filter((entry) => entry.client !== client || ++kept <= MAX_DROPPED_CACHE_ENTRIES);
      });

      this.pushEventItem({
        ...base,
        method: event.method,
        url: event.url,
        isSecure: event.isSecure,
        status: null,
        destroyCause: event.cause,
        queryId: this.resolveEventQueryId(event),
      });

      return;
    }

    // A logout drops every secure entry at once - worth a row of its own, since the requests that
    // disappear from the cache view are otherwise unexplained.
    if (event.type === 'unbind-all-secure') {
      this.pushEventItem({ ...base, method: null, url: null, isSecure: true, status: null, queryId: null });

      return;
    }

    // An invalidation is one row for the whole fan-out: the six queries it re-executed are listed on it
    // rather than blurring into the six request rows that follow.
    if (event.type === 'queries-refreshed') {
      this.pushEventItem({
        ...base,
        method: null,
        url: null,
        isSecure: false,
        status: null,
        queryId: null,
        cause: event.cause,
        refreshed: event.requests.map((request) => this.refreshedRequestOf(request)),
      });

      return;
    }

    // Both are read off the request as the event fires, which is the only moment they describe this
    // event: the next execution of the same request overwrites them.
    const measured = event.type === 'request-success' ? this.measureResponse(event.request) : null;

    this.pushEventItem({
      ...base,
      method: event.request.method,
      url: event.request.url,
      isSecure: event.isSecure,
      status: event.type === 'request-error' ? event.error.status : null,
      durationMs: event.request.subtle.lastDurationMs(),
      bytes: measured?.bytes ?? null,
      isEstimatedBytes: !!measured && !measured.isExact,
      queryId: this.resolveEventQueryId(event.request),
    });
  }

  /**
   * The registered query an event's request belongs to. A request is shared by every query on the same
   * cache key, so the first owner is as good as any - they all show the same response.
   *
   * The url fallback is what makes a row clickable when the query is already gone: an error that fires
   * as the component holding it is being destroyed (a `401` that redirects to login) has no live owner
   * left to match on identity, and its tombstone holds a copy of the request rather than the request.
   */
  private resolveEventQueryId(source: { url: string }) {
    const live = this.liveQueryEntries();
    const owner =
      live.find((e) => (e.handle as AnyQuery).subtle.request() === source) ??
      live.find((e) => this.requestUrl(e.handle as AnyQuery) === source.url);

    if (owner) return owner.id;

    // Youngest first: the same route destroyed twice leaves two tombstones, and the newer one is the
    // one this event belongs to.
    return (
      this.queryEntries()
        .filter((e) => e.destroyedAt && this.requestUrl(e.handle as AnyQuery) === source.url)
        .sort((a, b) => (b.destroyedAt ?? 0) - (a.destroyedAt ?? 0))[0]?.id ?? null
    );
  }

  /**
   * The size of a settled request's response, taken from its `content-length` when the response carried
   * one and measured from the decoded body otherwise.
   */
  private measureResponse(request: { currentEvent: () => unknown; response: () => unknown }) {
    const event = request.currentEvent();
    const headers = event && typeof event === 'object' && 'headers' in event ? (event.headers as HttpHeaders) : null;

    return measureQueryDevtoolsPayload({ headers, body: request.response() });
  }

  private refreshedRequestOf(request: { method: string; url: string }): RefreshedRequest {
    return {
      queryIds: this.liveQueryEntries()
        .filter((e) => (e.handle as AnyQuery).subtle.request() === request)
        .map((owner) => owner.id),
      method: request.method,
      path: this.requestPath(request.url),
    };
  }

  private pushEventItem(item: EventLogItem) {
    this.eventLog.update((log) => [item, ...log].slice(0, MAX_EVENTS));
  }
}
