import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { headerEntries, inlineExoticOf, isHeadersValue } from './query-devtools-exotic';
import { DOCUMENT } from '@angular/common';
import {
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  OnInit,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  clamp,
  createObjectUrlHandle,
  DragHandleDirective,
  DragMoveEvent,
  injectBreakpointObserver,
  injectViewportSize,
  ResizeEdge,
  ResizeHandlesComponent,
  ResizeMoveEvent,
  injectFileDownload,
  injectIsDocumentVisible,
  injectRenderer,
  injectStyleManager,
  OverlayViewportReservation,
  randomId,
  reserveOverlayViewportSpace,
  signalElementDimensions,
} from '@ethlete/core';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQueryBatch,
  AnyQuerySnapshot,
  AnyQueryStack,
  applyQueryDevtoolsTokenTtl,
  BearerAuthMultiTabSyncFeature,
  canOverrideQueryDevtoolsTokenTtl,
  clearQueryDevtoolsArmedMocks,
  clearQueryDevtoolsFaults,
  clearQueryDevtoolsMockStore,
  clearQueryDevtoolsOverrideStore,
  clearQueryDevtoolsStore,
  clearRestoredQueryDevtoolsOverrides,
  createQueryErrorResponse,
  createQueryKeyLockManager,
  EMPTY_QUERY_DEVTOOLS_FAULT,
  isQueryDevtoolsFaultArmed,
  isQueryDevtoolsRepositoryLive,
  measureQueryDevtoolsPayload,
  QueryClient,
  queryDevtoolsAbout,
  queryDevtoolsEntries,
  QueryDevtoolsEntry,
  queryDevtoolsArmedMocks,
  queryDevtoolsArmedMocksRestored,
  queryDevtoolsFaults,
  queryDevtoolsFaultsRestored,
  queryDevtoolsMockId,
  queryDevtoolsMocks,
  queryDevtoolsOverridePersistence,
  queryDevtoolsRestoredOverridesScope,
  queryDevtoolsSettings,
  QueryDevtoolsStorageScope,
  queryDevtoolsTokenTtls,
  readQueryDevtoolsStore,
  registerEthleteVersion,
  writeQueryDevtoolsStore,
  queryDevtoolsResponseHistory,
  QueryDevtoolsFeature,
  QueryDevtoolsFormHandle,
  QueryDevtoolsRun,
  QueryDevtoolsStatsHandle,
  sumQueryDevtoolsStats,
  QueryKeyLockHold,
  QueryKeyLockState,
  QueryRefreshCause,
  QueryRepository,
  QueryRepositoryCacheEntry,
  QueryRepositoryEvent,
  QuerySequence,
  QuerySequenceStatus,
  QueryHeadersInput,
  resolveQueryHeaders,
  restoredQueryDevtoolsOverrides,
  setQueryDevtoolsOverridePersistence,
  setQueryDevtoolsUiMounted,
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
  scan,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import {
  COMPONENTS_VERSION,
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuDirective,
  MenuItemComponent,
  MenuRadioGroupComponent,
  MenuRadioItemComponent,
  MenuSeparatorComponent,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from '@ethlete/components';
import { QueryDevtoolsAuthTabComponent } from './query-devtools-auth-tab.component';
import { QueryDevtoolsCacheTabComponent } from './query-devtools-cache-tab.component';
import { buildCurlCommand } from './query-devtools-curl';
import { QueryDevtoolsEventsTabComponent } from './query-devtools-events-tab.component';
import { diffQueryDevtoolsResponses } from './query-devtools-diff';
import { QueryDevtoolsAboutComponent } from './query-devtools-about.component';
import { QueryDevtoolsMocksTabComponent } from './query-devtools-mocks-tab.component';
import { QueryDevtoolsSettingsComponent } from './query-devtools-settings.component';
import { QueryDevtoolsFaultsTabComponent } from './query-devtools-faults-tab.component';
import { QueryDevtoolsFormsTabComponent } from './query-devtools-forms-tab.component';
import { writeQueryDevtoolsClipboard } from './query-devtools-clipboard';
import { createQueryDevtoolsCopiedTick, QueryDevtoolsCopiedTick } from './query-devtools-copied-tick';
import { resolveQueryDevtoolsEventOwner } from './query-devtools-event-owner';
import { QUERY_DEVTOOLS_HOST } from './query-devtools-host';
import { QueryDevtoolsLocksTabComponent } from './query-devtools-locks-tab.component';
import {
  DEVTOOLS_PROBE_NAMESPACE,
  DevtoolsLockRow,
  devtoolsProbeLockKey,
  devtoolsProbeLockName,
  probeClientId,
  summarizeLocks,
} from './query-devtools-locks';
import { QUERY_DEVTOOLS_VERSION } from './version';
import {
  buildInsomniaExport,
  findInsomniaValuePath,
  InsomniaRequestInput,
  InsomniaTokenRefreshInput,
} from './query-devtools-insomnia';
import { QueryDevtoolsCopyMenuStylesComponent } from './query-devtools-copy-menu-styles.component';
import { QueryDevtoolsJsonStylesComponent } from './query-devtools-json-styles.component';
import { QueryDevtoolsOverrideMenuStylesComponent } from './query-devtools-override-menu-styles.component';
import { QueryDevtoolsQueriesTabComponent } from './query-devtools-queries-tab.component';
import { QueryDevtoolsBatchesTabComponent } from './query-devtools-batches-tab.component';
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
  SessionExportMock,
  sessionAuthQueryKey,
  slimForReport,
} from './query-devtools-session';
import { QueryDevtoolsTimelineStylesComponent } from './query-devtools-timeline-styles.component';
import {
  AnyQuery,
  BatchItemView,
  CacheRow,
  DetailTab,
  DevtoolsTab,
  DroppedCacheEntry,
  EventLogItem,
  PaneAxis,
  PaneTarget,
  QueryActivity,
  QueryDevtoolsChip,
  QueryDevtoolsSelection,
  QueryDevtoolsTokenLifetime,
  QueryLink,
  QueryListFacet,
  QueryStatus,
  RefreshedRequest,
  RequestProgress,
  RouteSegment,
  TabBadge,
} from './query-devtools-types';
import {
  QUERY_DEVTOOLS_VIEW_STATE_KEY,
  QueryDevtoolsToggleComponent,
  isQueryDevtoolsShortcut,
  queryDevtoolsShortcutLabel,
} from '@ethlete/query-devtools/toggle';

type DevtoolsDock = 'bottom' | 'top' | 'left' | 'right' | 'float';

type DevtoolsLayout = DevtoolsDock | 'popout';

type FloatRect = { x: number; y: number; width: number; height: number };

type ResizeDrag = {
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
  reservesSpace?: boolean;
  floatRect?: FloatRect;
  floatParked?: boolean;
  activeTab?: DevtoolsTab;
  detailTab?: DetailTab;
  selectedClientName?: string | null;
  selectedQueryId?: string | null;
  stackSelectedQueryId?: string | null;
  sequenceSelectedQueryId?: string | null;
  batchSelectedQueryId?: string | null;
  eventSelectedQueryId?: string | null;
  formSelectedQueryId?: string | null;
  timelineSelectedQueryId?: string | null;
  selectedFormId?: string | null;
  inspectFilterIds?: string[] | null;
  queryFilter?: string;
  queryFacets?: QueryListFacet[];
  queryRecentFirst?: boolean;
  queryTreeView?: boolean;
  collapsedQueryPaths?: string[];
  eventClient?: string | null;
  eventErrorsOnly?: boolean;
  socketFilter?: string;
  jsonSearch?: string;
  expandedSteps?: string[];
  expandedBatchItems?: string[];
  expandedQueryGroups?: string[];
  jsonExpanded?: string[];
  jsonCollapsed?: string[];
};

const MAX_BATCH_ITEM_ROWS = 100;

const LOCATE_HOLD_MS = 2500;

const LOCATE_MAX_DEPTH = 4;

/**
 * The element to scroll to and outline for a query: the one it was created in, or the shallowest
 * descendant that renders a box when that one renders none of its own. `null` when nothing in there
 * is rendered at all - `display: none`, or an ancestor that is.
 *
 * A host carrying `display: contents` - common on Angular components - generates no box, so both
 * `checkVisibility()` and its own rect report it as absent while its content is plainly on screen.
 */
const renderedTarget = (element: Element, depth = 0): Element | null => {
  const rect = element.getBoundingClientRect();

  if (rect.width || rect.height) return element;
  if (depth >= LOCATE_MAX_DEPTH) return null;

  for (const child of element.children) {
    const found = renderedTarget(child, depth + 1);

    if (found) return found;
  }

  return null;
};

const DEVTOOLS_LAYOUTS = [
  { id: 'bottom', glyph: '\u2b13', label: 'Bottom', hint: 'Dock to the bottom edge' },
  { id: 'top', glyph: '\u2b12', label: 'Top', hint: 'Dock to the top edge' },
  { id: 'left', glyph: '\u25e7', label: 'Left', hint: 'Dock to the left edge' },
  { id: 'right', glyph: '\u25e8', label: 'Right', hint: 'Dock to the right edge' },
  {
    id: 'float',
    glyph: '\u2750',
    label: 'Float',
    hint: 'A window inside the page - move it, resize it, shove it off an edge to park it',
  },
  {
    id: 'popout',
    glyph: '\u29c9',
    label: 'Pop out',
    hint: 'Move the panel into a window of its own - the same live panel, on your other screen',
  },
] as const satisfies readonly { id: DevtoolsLayout; glyph: string; label: string; hint: string }[];

const layoutFor = (dock: DevtoolsDock) => DEVTOOLS_LAYOUTS.find((layout) => layout.id === dock) ?? DEVTOOLS_LAYOUTS[0];

const DOCK_PADDING = {
  bottom: 'paddingBlockEnd',
  top: 'paddingBlockStart',
  left: 'paddingInlineStart',
  right: 'paddingInlineEnd',
} as const satisfies Record<Exclude<DevtoolsDock, 'float'>, keyof CSSStyleDeclaration>;

/**
 * The panel's own z-index, mirrored from `query-devtools.component.css`. An overlay below it keeps out
 * of the space a docked panel covers; the panel's own overlays paint a level above it and may use it.
 */
const PANEL_LAYER = 2147483010;

const describeEntryId = (id: string) => {
  const [descriptor = '', seq] = id.split('#');
  const [kind, client, method, route] = descriptor.split('|');

  if (kind !== 'query' || !route) return id;

  return `${method} ${route}${client ? ` · ${client}` : ''}${seq && seq !== '0' ? ` #${seq}` : ''}`;
};

const STORAGE_KEY = QUERY_DEVTOOLS_VIEW_STATE_KEY;

/**
 * Pinned queries, held apart from {@link STORAGE_KEY} and defaulting to `localStorage`: everything under
 * that key is view state that should die with the tab, while a pin says which query is being worked on
 * and is meant to outlive one. Folding it in would silently make pins per-tab. Both scopes are
 * `queryDevtoolsSettings()`.
 */
const PINS_STORAGE_KEY = 'ethlete:query:devtools:pins:v2';

const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 560;
const MIN_WIDTH = 360;

const MIN_PANE_WIDTH = 220;
const MIN_PANE_HEIGHT = 120;

const DEFAULT_FLOAT_RECT: FloatRect = { x: 48, y: 48, width: 900, height: 520 };

const FLOAT_STACK_WIDTH = 620;

type ViewportSize = { width: number; height: number };

const FLOAT_PEEK = 44;

const clampFloatRect = (rect: FloatRect, viewport: ViewportSize): FloatRect => {
  const width = clamp(rect.width, MIN_WIDTH, Math.max(MIN_WIDTH, viewport.width));
  const height = clamp(rect.height, MIN_HEIGHT, Math.max(MIN_HEIGHT, viewport.height));

  return {
    width,
    height,
    x: clamp(rect.x, 0, Math.max(0, viewport.width - width)),
    y: clamp(rect.y, 0, Math.max(0, viewport.height - height)),
  };
};

/**
 * The loosest a float may sit: shoved off an edge with only {@link FLOAT_PEEK} left, which is what a
 * drag and a parked panel are held to. **North is never a parking edge** - the title bar is the only
 * thing that drags the panel back, so it may never be the part that leaves.
 */
export const clampFloatToPeek = (rect: FloatRect, viewport: ViewportSize): FloatRect => {
  const width = clamp(rect.width, MIN_WIDTH, Math.max(MIN_WIDTH, viewport.width));
  const height = clamp(rect.height, MIN_HEIGHT, Math.max(MIN_HEIGHT, viewport.height));
  const peekX = Math.min(FLOAT_PEEK, width);
  const peekY = Math.min(FLOAT_PEEK, height);

  return {
    width,
    height,
    x: clamp(rect.x, peekX - width, Math.max(peekX - width, viewport.width - peekX)),
    y: clamp(rect.y, 0, Math.max(0, viewport.height - peekY)),
  };
};

export const settledFloatRect = (rect: FloatRect, viewport: ViewportSize): { rect: FloatRect; collapsed: boolean } => {
  const offLeft = Math.max(0, -rect.x);
  const offRight = Math.max(0, rect.x + rect.width - viewport.width);
  const offBottom = Math.max(0, rect.y + rect.height - viewport.height);

  const parkedX = Math.max(offLeft, offRight) > rect.width / 2;
  const parkedY = offBottom > rect.height / 2;

  if (!parkedX && !parkedY) return { rect: clampFloatRect(rect, viewport), collapsed: false };

  const peekX = Math.min(FLOAT_PEEK, rect.width);
  const peekY = Math.min(FLOAT_PEEK, rect.height);
  const inside = clampFloatRect(rect, viewport);

  return {
    rect: {
      ...rect,
      x: parkedX ? (offLeft > offRight ? peekX - rect.width : viewport.width - peekX) : inside.x,
      y: parkedY ? viewport.height - peekY : inside.y,
    },
    collapsed: true,
  };
};

export const resizedFloatRect = (
  base: FloatRect,
  { move, viewport }: { move: ResizeMoveEvent; viewport: ViewportSize },
): FloatRect => {
  const { edge, dx, dy } = move;

  const maxWidth = edge.includes('w') ? base.x + base.width : viewport.width - base.x;
  const maxHeight = edge.includes('n') ? base.y + base.height : viewport.height - base.y;

  const requestedWidth = edge.includes('e') ? base.width + dx : edge.includes('w') ? base.width - dx : base.width;
  const requestedHeight = edge.includes('s') ? base.height + dy : edge.includes('n') ? base.height - dy : base.height;

  const width = clamp(requestedWidth, MIN_WIDTH, Math.max(MIN_WIDTH, maxWidth));
  const height = clamp(requestedHeight, MIN_HEIGHT, Math.max(MIN_HEIGHT, maxHeight));

  return clampFloatRect(
    {
      width,
      height,
      x: edge.includes('w') ? base.x + base.width - width : base.x,
      y: edge.includes('n') ? base.y + base.height - height : base.y,
    },
    viewport,
  );
};

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
  <body></body>
</html>`;

/**
 * Every stylesheet the panel injects after it is created rather than with itself. A pop-out copies the
 * host document's styles once, on load, so all of them have to be in the document by then - whatever the
 * user has opened so far.
 */
const DEFERRED_STYLES = [
  QueryDevtoolsJsonStylesComponent,
  QueryDevtoolsCopyMenuStylesComponent,
  QueryDevtoolsOverrideMenuStylesComponent,
  QueryDevtoolsTimelineStylesComponent,
];

const readPersistedState = (): PersistedState =>
  readQueryDevtoolsStore<PersistedState>(queryDevtoolsSettings().viewState, STORAGE_KEY) ?? {};

const readPinnedQueryIds = (): string[] => {
  const parsed = readQueryDevtoolsStore<string[]>(queryDevtoolsSettings().pins, PINS_STORAGE_KEY);

  return Array.isArray(parsed) ? parsed : [];
};

const DEFAULT_TOKEN_MAX_AGE_S = 300;

const MAX_TOKEN_MAX_AGE_S = 3600;

/**
 * A panel action must never reach the application's `ErrorHandler` - it reports its own failure inside
 * the panel instead, and this is the text it shows.
 */
const actionErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const emptyArgsSeed = (entry: QueryDevtoolsEntry) => {
  const params = entry.meta.routeParts?.flatMap((part) => (part.param ? [part.param] : [])) ?? [];

  if (!params.length) return {};

  return { pathParams: Object.fromEntries(params.map((name) => [name, ''])) };
};

type HeadersRecord = Record<string, string | string[]>;

const DROPPED = /* @__PURE__ */ Symbol('dropped');

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
};

const isUneditable = (value: unknown) =>
  typeof value === 'function' ||
  value instanceof Map ||
  value instanceof Set ||
  (typeof FormData !== 'undefined' && value instanceof FormData) ||
  (typeof Blob !== 'undefined' && value instanceof Blob) ||
  isHeadersValue(value);

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

const expiryCountdown = (exp: number | null): string | null => {
  if (exp === null) return null;

  const seconds = Math.round((exp * 1000 - Date.now()) / 1000);

  if (seconds <= 0) return 'expired';
  if (seconds < 120) return `${seconds}s`;
  if (seconds > 86400) return `${Math.floor(seconds / 86400)}d`;

  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

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
    QueryDevtoolsBatchesTabComponent,
    QueryDevtoolsCacheTabComponent,
    QueryDevtoolsEventsTabComponent,
    QueryDevtoolsAboutComponent,
    QueryDevtoolsSettingsComponent,
    QueryDevtoolsFaultsTabComponent,
    QueryDevtoolsFormsTabComponent,
    QueryDevtoolsLocksTabComponent,
    QueryDevtoolsMocksTabComponent,
    QueryDevtoolsQueriesTabComponent,
    QueryDevtoolsSequencesTabComponent,
    QueryDevtoolsSocketsTabComponent,
    QueryDevtoolsStacksTabComponent,
    QueryDevtoolsTimelineTabComponent,
    QueryDevtoolsToggleComponent,
    DragHandleDirective,
    MenuCheckboxItemComponent,
    MenuComponent,
    MenuDirective,
    MenuItemComponent,
    MenuRadioGroupComponent,
    MenuRadioItemComponent,
    MenuSeparatorComponent,
    MenuSurfaceDirective,
    MenuTriggerDirective,
    ResizeHandlesComponent,
  ],
  providers: [{ provide: QUERY_DEVTOOLS_HOST, useExisting: QueryDevtoolsComponent }],
  host: {
    class: 'et-query-devtools-host',
    '[attr.data-dock]': 'dock()',
    // Every overlay opened from inside the panel - its menus, its tooltips - mounts one level above
    // the panel's own z-index, which is itself above the default overlay layer. Both numbers live in
    // query-devtools.component.css; keep them in step.
    'data-et-overlay-layer': '2147483020',
  },
})
export class QueryDevtoolsComponent implements OnInit {
  private hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = injectRenderer();
  private download = injectFileDownload();
  private styleManager = injectStyleManager();
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);

  private viewport = injectViewportSize();

  private isDocumentVisible = injectIsDocumentVisible();

  /**
   * Opens the panel as soon as it is created, whatever the stored view state says. Set by
   * `<et-query-devtools-lazy>`, which downloads the panel on the click that was meant to open it.
   */
  public startOpen = input(false, { transform: booleanAttribute });

  private panelEl = viewChild<ElementRef<HTMLElement>>('panel');

  private eventIdCounter = 0;
  private lastSelectionKey = '';

  private tabBeforeSettings: DevtoolsTab = 'queries';

  public readonly persisted = readPersistedState();

  protected readonly tabs = [
    { id: 'queries', label: 'Queries' },
    { id: 'stacks', label: 'Stacks' },
    { id: 'sequences', label: 'Sequences' },
    { id: 'batches', label: 'Batches' },
    { id: 'forms', label: 'Forms' },
    { id: 'auth', label: 'Auth' },
    { id: 'ws', label: 'Sockets' },
    { id: 'cache', label: 'Cache' },
    { id: 'locks', label: 'Locks' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'events', label: 'Events' },
    { id: 'faults', label: 'Faults' },
    { id: 'mocks', label: 'Mocks' },
    { id: 'about', label: 'About' },
  ] satisfies { id: DevtoolsTab; label: string }[];

  private readonly PINNED_TABS: readonly DevtoolsTab[] = ['queries', 'faults'];

  protected readonly shortcut = queryDevtoolsShortcutLabel();

  protected readonly LAYOUTS = DEVTOOLS_LAYOUTS;

  protected open = signal(this.persisted.open ?? false);
  private panelHeight = signal(this.persisted.height ?? DEFAULT_HEIGHT);
  private panelWidth = signal(this.persisted.width ?? DEFAULT_WIDTH);
  protected activeTab = signal<DevtoolsTab>(this.persisted.activeTab ?? 'queries');

  protected listWidth = signal<number | null>(this.persisted.listWidth ?? null);
  protected drawerWidth = signal<number | null>(this.persisted.drawerWidth ?? null);
  protected listHeight = signal<number | null>(this.persisted.listHeight ?? null);
  protected drawerHeight = signal<number | null>(this.persisted.drawerHeight ?? null);

  private drag = signal<ResizeDrag | null>(null);
  private floatGesture = signal(false);
  protected resizing = computed(() => !!this.drag());

  protected dock = signal<DevtoolsDock>(this.persisted.dock ?? 'bottom');

  protected currentLayout = computed(() => layoutFor(this.dock()));

  protected reservesSpace = signal(this.persisted.reservesSpace ?? true);

  private floatRect = signal<FloatRect>(this.persisted.floatRect ?? DEFAULT_FLOAT_RECT);

  private floatResizeBase: FloatRect | null = null;

  /**
   * Whether the float is shoved off an edge with only its peek showing. Persisted with the rect, since
   * restoring the rect without it would either strand the panel off screen or silently un-park it.
   */
  protected floatParked = signal(this.persisted.floatParked ?? false);

  protected popOutBlocked = signal(false);

  /**
   * Whether the panel currently lives in a window of its own. Deliberately not persisted: a reload
   * cannot re-adopt a window the previous document opened, so it always starts docked.
   */
  protected poppedOut = signal(false);

  protected floating = computed(() => !this.poppedOut() && this.dock() === 'float');

  private narrowViewport = injectBreakpointObserver().observeBreakpoint({ max: 'sm' });

  private sideDocked = computed(() => this.dock() === 'left' || this.dock() === 'right');

  protected paneAxis = computed<PaneAxis>(() => {
    if (this.poppedOut()) return 'inline';
    if (this.floating()) return this.floatRect().width < FLOAT_STACK_WIDTH ? 'block' : 'inline';

    return this.sideDocked() || this.narrowViewport() ? 'block' : 'inline';
  });

  private popup: Window | null = null;

  /** Ends everything tied to one pop-out window: a pending `load`, its `pagehide`, shortcut and visibility. */
  private popOutEnded$ = new Subject<void>();

  private popupVisible = signal(true);

  private isPanelVisible = computed(() => (this.poppedOut() ? this.popupVisible() : this.isDocumentVisible()));

  private popOutStyleSync: (() => void) | null = null;

  protected panelBlockSize = computed(() => {
    if (this.poppedOut()) return null;
    if (this.floating()) return this.floatRect().height;

    return this.sideDocked() ? null : this.panelHeight();
  });

  protected panelInlineSize = computed(() => {
    if (this.poppedOut()) return null;
    if (this.floating()) return this.floatRect().width;

    return this.sideDocked() ? this.panelWidth() : null;
  });

  protected panelInsetBlock = computed(() => (this.floating() ? this.floatRect().y : null));
  protected panelInsetInline = computed(() => (this.floating() ? this.floatRect().x : null));

  /**
   * The panel's rendered size, not its dragged one - the stylesheet clamps a dock (`min-block-size`,
   * `max-block-size: 90vh`) and it is the clamped size the page has to give up.
   */
  private panelSize = signalElementDimensions(this.panelEl);

  private pageReservation = computed(() => {
    const dock = this.dock();

    if (dock === 'float' || this.poppedOut() || !this.open() || !this.reservesSpace()) return null;

    const size = this.panelSize().offset;

    if (!size) return null;

    return { padding: DOCK_PADDING[dock], px: this.sideDocked() ? size.width : size.height };
  });

  /**
   * The viewport edge a docked panel covers, reserved for overlays whatever {@link reservesSpace} says:
   * page content can be scrolled out from under the panel, a dialog or a menu cannot. A dock edge is
   * logical, so which physical edge a side dock covers flips in RTL - read from the panel, since the
   * writing direction cannot change under a dock switch.
   */
  private overlayReservation = computed<OverlayViewportReservation | null>(() => {
    const dock = this.dock();

    if (dock === 'float' || this.poppedOut() || !this.open()) return null;

    const panel = this.panelEl()?.nativeElement;
    const size = this.panelSize().offset;

    if (!panel || !size) return null;

    if (dock === 'top') return { top: size.height, layer: PANEL_LAYER };
    if (dock === 'bottom') return { bottom: size.height, layer: PANEL_LAYER };

    const coversLeft = (dock === 'left') !== (getComputedStyle(panel).direction === 'rtl');

    return coversLeft ? { left: size.width, layer: PANEL_LAYER } : { right: size.width, layer: PANEL_LAYER };
  });

  public detailTab = signal<DetailTab>(this.persisted.detailTab ?? 'overview');
  public selectedClientName = signal<string | null>(this.persisted.selectedClientName ?? null);
  public selectedQueryId = signal<string | null>(this.persisted.selectedQueryId ?? null);

  public selectedFormId = signal<string | null>(this.persisted.selectedFormId ?? null);

  /**
   * The type annotations of each seeded mock body, by mock id. It lives here rather than on the Mocks
   * tab because a tab is destroyed the moment another one is selected, and a body seeded from an inline
   * schema has no `schemaName` to recover its labels from.
   */
  public seededTypes = signal<Record<string, ReadonlyMap<string, string>>>({});

  // Independent per-drawer selection so no drawer shares the Queries tab's selection - or another
  // drawer's: opening a query from the Timeline must not also change what the Forms drawer shows. Each
  // is persisted the way the Queries tab's is, so a reload puts every drawer back on what it was showing.
  public stackSelectedQueryId = signal<string | null>(this.persisted.stackSelectedQueryId ?? null);
  public sequenceSelectedQueryId = signal<string | null>(this.persisted.sequenceSelectedQueryId ?? null);
  public batchSelectedQueryId = signal<string | null>(this.persisted.batchSelectedQueryId ?? null);
  public eventSelectedQueryId = signal<string | null>(this.persisted.eventSelectedQueryId ?? null);
  public formSelectedQueryId = signal<string | null>(this.persisted.formSelectedQueryId ?? null);
  public timelineSelectedQueryId = signal<string | null>(this.persisted.timelineSelectedQueryId ?? null);

  public queryFilter = signal(this.persisted.queryFilter ?? '');

  public queryFacets = signal<ReadonlySet<QueryListFacet>>(new Set(this.persisted.queryFacets ?? []));

  public queryRecentFirst = signal(this.persisted.queryRecentFirst ?? true);

  public queryTreeView = signal(this.persisted.queryTreeView ?? false);

  public collapsedQueryPaths = signal<ReadonlySet<string>>(new Set(this.persisted.collapsedQueryPaths ?? []));

  public pinnedQueryIds = signal<ReadonlySet<string>>(new Set(readPinnedQueryIds()));

  public eventLog = signal<EventLogItem[]>([]);
  private eventOwners = new WeakMap<EventLogItem, string | null>();

  public droppedCacheEntries = signal<DroppedCacheEntry[]>([]);

  public eventClient = signal<string | null>(this.persisted.eventClient ?? null);

  public eventErrorsOnly = signal(this.persisted.eventErrorsOnly ?? false);

  public socketFilter = signal(this.persisted.socketFilter ?? '');

  private expandedCacheKey = signal<string | null>(null);

  private socketEmitError = signal<{ entryId: string; message: string } | null>(null);

  private expandedSteps = signal<ReadonlySet<string>>(new Set(this.persisted.expandedSteps ?? []));

  private expandedBatchItems = signal<ReadonlySet<string>>(new Set(this.persisted.expandedBatchItems ?? []));

  public expandedQueryGroups = signal<ReadonlySet<string>>(new Set(this.persisted.expandedQueryGroups ?? []));

  public jsonSearch = signal(this.persisted.jsonSearch ?? '');
  public jsonSearchTerm = computed(() => this.jsonSearch().trim().toLowerCase());

  public jsonExpandedPaths = signal<ReadonlySet<string>>(new Set(this.persisted.jsonExpanded ?? []));
  public jsonCollapsedPaths = signal<ReadonlySet<string>>(new Set(this.persisted.jsonCollapsed ?? []));

  public toggleJsonPath: (path: string, expand: boolean) => void;

  public diffRunIndex = signal<number | null>(null);

  public diffBaseRunIndex = signal<number | null>(null);

  public errorRunIndex = signal<number | null>(null);

  public retainedResponseCount = computed(queryDevtoolsResponseHistory);

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

  private editedArgsSource: Record<string, unknown> | null = null;

  public copiedReport = createQueryDevtoolsCopiedTick(false);
  public copiedInsomnia = createQueryDevtoolsCopiedTick(false);
  public copiedCurl = createQueryDevtoolsCopiedTick(false);
  public copiedGql = createQueryDevtoolsCopiedTick(false);
  public copiedRoute = createQueryDevtoolsCopiedTick(false);

  /**
   * 1-second tick driving the cache freshness countdowns. Gated the way the locks poll is: an ungated
   * `interval` is a periodic macrotask zone.js counts forever, so a mounted panel would tick the host
   * application once a second and keep `ApplicationRef.whenStable()` from ever resolving. Every reader
   * sits inside `@if (open())`, so there is nothing to drive while the panel is shut or the tab hidden.
   */
  private clock = toSignal(
    toObservable(computed(() => this.open() && this.isPanelVisible())).pipe(
      switchMap((ticking) => (ticking ? interval(1000) : EMPTY)),
      scan((tick) => tick + 1, 0),
    ),
    { initialValue: 0 },
  );

  private probeLocks = createQueryKeyLockManager(DEVTOOLS_PROBE_NAMESPACE);
  private probeId = randomId();
  private probeHold: QueryKeyLockHold | null = null;
  private lockSnapshot = signal<LockManagerSnapshot | null>(null);

  public lockRows = computed<DevtoolsLockRow[] | null>(() => {
    if (!this.probeLocks.isSupported) return null;

    const snapshot = this.lockSnapshot();

    if (!snapshot) return [];

    return summarizeLocks({ snapshot, clientId: probeClientId(snapshot, devtoolsProbeLockName(this.probeId)) });
  });

  protected inspectActive = signal(false);
  /** @internal */
  public inspectHover = signal<{ rect: DOMRect; entries: QueryDevtoolsEntry[] } | null>(null);

  protected locatedRect = signal<DOMRect | null>(null);
  public locateState = signal<'idle' | 'located' | 'offscreen'>('idle');
  private locate$ = new Subject<Element | null>();

  public inspectFilterIds = signal<string[] | null>(this.persisted.inspectFilterIds ?? null);

  private queryEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query'));

  /**
   * The queries that still exist. Everything that measures what the application is doing right now -
   * the tab bar's error flags, the tamper dot, the timeline -
   * reads this rather than {@link queryEntries}, so a tombstone never inflates a live number.
   */
  private liveQueryEntries = computed(() => this.queryEntries().filter((e) => !e.destroyedAt));

  protected panelTampered = computed(
    () =>
      this.liveQueryEntries().some((entry) => this.isTampered(entry)) ||
      Object.keys(queryDevtoolsTokenTtls()).length > 0,
  );

  public stackEntries = computed(() =>
    queryDevtoolsEntries().filter((e) => e.kind === 'query-stack' || e.kind === 'paged-query-stack'),
  );

  public sequenceEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query-sequence'));

  public batchEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query-batch'));

  public formEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query-form'));

  public authEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'auth-provider'));

  public wsEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'ws-client'));

  public clientNames = computed(() => {
    const names = new Set<string>();
    for (const entry of queryDevtoolsEntries()) {
      if (entry.meta.clientName) names.add(entry.meta.clientName);
    }
    return Array.from(names).sort();
  });

  /**
   * Unique repositories (with their client name + base URL) used by the Cache and Events tabs. A
   * tombstone keeps its `meta.repository`, so a destroyed client would otherwise keep its Cache card
   * and its **Evict all** long after its injector died.
   */
  private repositories = computed(() => {
    const map = new Map<QueryRepository, { name: string; baseUrl: string; client: QueryClient | null }>();
    for (const entry of queryDevtoolsEntries()) {
      const repo = entry.meta.repository;
      if (repo && !map.has(repo) && isQueryDevtoolsRepositoryLive(repo)) {
        map.set(repo, {
          name: entry.meta.clientName ?? 'unknown',
          baseUrl: entry.meta.clientBaseUrl ?? '',
          client: entry.meta.client ?? null,
        });
      }
    }
    return Array.from(map, ([repository, info]) => ({ repository, ...info }));
  });

  public faultClients = computed(() => {
    const faults = queryDevtoolsFaults();

    return this.repositories()
      .map(({ name, baseUrl }) => {
        const fault = faults[name] ?? EMPTY_QUERY_DEVTOOLS_FAULT;

        return { name, baseUrl, fault, armed: isQueryDevtoolsFaultArmed(fault) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected armedFaultClients = computed(() => {
    const armed = this.faultClients()
      .filter((client) => client.armed)
      .map((client) => client.name);

    return armed.length ? armed : null;
  });

  protected armedMockRoutes = computed(() => {
    const armed = queryDevtoolsArmedMocks();
    const routes = queryDevtoolsMocks()
      .filter((mock) => armed.has(mock.id))
      .map((mock) => `${mock.method} ${mock.pattern}`);

    return routes.length ? routes : null;
  });

  public scopedQueries = computed(() => {
    const entries = this.queryEntries();
    const inspectIds = this.inspectFilterIds();

    if (inspectIds) return entries.filter((e) => inspectIds.includes(e.id));

    const client = this.selectedClientName();

    return client ? entries.filter((e) => e.meta.clientName === client) : entries;
  });

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

  private cacheEntryCount = computed(() =>
    this.repositories().reduce((total, { repository }) => {
      // Read the version signal so the badge recounts on every cache mutation.
      repository.subtle.cacheVersion();

      return total + repository.subtle.cacheEntries().length;
    }, 0),
  );

  protected tabBadges = computed<Record<DevtoolsTab, TabBadge>>(() => {
    const queries = this.liveQueryEntries();
    const stacks = this.stackEntries();
    const sequences = this.sequenceEntries();
    const batches = this.batchEntries();
    const events = this.eventLog();

    return {
      queries: {
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
      batches: {
        count: batches.length,
        errors: batches.filter((entry) => this.asBatch(entry)?.failed() > 0).length,
        errorNoun: 'partial',
      },
      forms: { count: this.formEntries().length, errors: 0 },
      auth: { count: this.authEntries().length, errors: 0 },
      ws: { count: this.wsEntries().length, errors: 0 },
      cache: { count: this.cacheEntryCount(), errors: 0 },
      locks: { count: 0, errors: 0 },
      timeline: this.runTotals(),
      events: {
        count: events.length,
        errors: events.filter((event) => event.type === 'request-error').length,
      },
      faults: { count: 0, errors: Object.keys(queryDevtoolsFaults()).length, errorNoun: 'armed' },
      mocks: { count: queryDevtoolsMocks().length, errors: queryDevtoolsArmedMocks().size, errorNoun: 'armed' },
      about: { count: 0, errors: 0 },
      settings: { count: 0, errors: 0 },
    };
  });

  protected visibleTabs = computed(() => this.tabs.filter((tab) => this.isTabPrimary(tab.id)));

  protected overflowTabs = computed(() => this.tabs.filter((tab) => !this.isTabPrimary(tab.id)));

  public selectedQuery = computed(() => this.findQuery(this.selectedQueryId()));
  public stackSelectedQuery = computed(() => this.findQuery(this.stackSelectedQueryId()));
  public sequenceSelectedQuery = computed(() => this.findQuery(this.sequenceSelectedQueryId()));
  public batchSelectedQuery = computed(() => this.findQuery(this.batchSelectedQueryId()));
  public eventSelectedQuery = computed(() => this.findQuery(this.eventSelectedQueryId()));
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
        dropped: dropped.filter((entry) => entry.client === (baseUrl || name)),
      };
    });
  });

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

  protected readonly CLEAR_FAULTS = clearQueryDevtoolsFaults;

  protected faultsRestored = computed(queryDevtoolsFaultsRestored);
  protected mocksRestored = computed(queryDevtoolsArmedMocksRestored);

  protected readonly DISARM_MOCKS = clearQueryDevtoolsArmedMocks;

  protected restoredOverrides = computed(() => {
    const groups = restoredQueryDevtoolsOverrides();

    if (!groups.length) return null;

    const armed = groups.filter((group) => group.armed);
    const orphaned = groups.filter((group) => !group.armed);

    return {
      queries: armed.length,
      ops: armed.reduce((sum, group) => sum + group.count, 0),
      firstId: armed[0]?.id ?? null,
      orphaned: orphaned.map((group) => describeEntryId(group.id)),
      fromLocalStorage: queryDevtoolsRestoredOverridesScope() === 'local',
    };
  });

  protected readonly DROP_RESTORED_OVERRIDES = clearRestoredQueryDevtoolsOverrides;

  protected readonly FLOAT_RESIZE_EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  constructor() {
    setQueryDevtoolsUiMounted(true);
    this.destroyRef.onDestroy(() => setQueryDevtoolsUiMounted(false));

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

    this.locate$
      .pipe(
        switchMap((element) => {
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

    toObservable(
      computed(
        () => this.probeLocks.isSupported && this.open() && this.activeTab() === 'locks' && this.isPanelVisible(),
      ),
    )
      .pipe(
        tap((inspecting) => this.holdProbeLock(inspecting)),
        switchMap((inspecting) => (inspecting ? interval(1000).pipe(startWith(0)) : EMPTY)),
        switchMap(() => navigator.locks.query()),
        tap((snapshot) => this.lockSnapshot.set(snapshot)),
        takeUntilDestroyed(),
      )
      .subscribe();

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

    // Both persistence effects below clear the key from *both* browser stores whenever their scope
    // changes, before writing it into the store that scope now names - otherwise the copy the old scope
    // left behind would be what the next page load reads.
    let viewStateScope: QueryDevtoolsStorageScope | null = null;

    effect(() => {
      if (this.drag() || this.floatGesture()) return;

      const scope = queryDevtoolsSettings().viewState;

      const state: PersistedState = {
        open: this.open(),
        height: this.panelHeight(),
        width: this.panelWidth(),
        listWidth: this.listWidth(),
        drawerWidth: this.drawerWidth(),
        listHeight: this.listHeight(),
        drawerHeight: this.drawerHeight(),
        dock: this.dock(),
        reservesSpace: this.reservesSpace(),
        floatRect: this.floatRect(),
        floatParked: this.floatParked(),
        activeTab: this.activeTab(),
        detailTab: this.detailTab(),
        selectedClientName: this.selectedClientName(),
        selectedQueryId: this.selectedQueryId(),
        stackSelectedQueryId: this.stackSelectedQueryId(),
        sequenceSelectedQueryId: this.sequenceSelectedQueryId(),
        batchSelectedQueryId: this.batchSelectedQueryId(),
        eventSelectedQueryId: this.eventSelectedQueryId(),
        formSelectedQueryId: this.formSelectedQueryId(),
        timelineSelectedQueryId: this.timelineSelectedQueryId(),
        selectedFormId: this.selectedFormId(),
        inspectFilterIds: this.inspectFilterIds(),
        queryFilter: this.queryFilter(),
        queryFacets: [...this.queryFacets()],
        queryRecentFirst: this.queryRecentFirst(),
        queryTreeView: this.queryTreeView(),
        collapsedQueryPaths: [...this.collapsedQueryPaths()],
        eventClient: this.eventClient(),
        eventErrorsOnly: this.eventErrorsOnly(),
        socketFilter: this.socketFilter(),
        jsonSearch: this.jsonSearch(),
        expandedSteps: [...this.expandedSteps()],
        expandedBatchItems: [...this.expandedBatchItems()],
        expandedQueryGroups: [...this.expandedQueryGroups()],
        jsonExpanded: [...this.jsonExpandedPaths()],
        jsonCollapsed: [...this.jsonCollapsedPaths()],
      };

      if (scope !== viewStateScope) {
        clearQueryDevtoolsStore(STORAGE_KEY);
        viewStateScope = scope;
      }

      writeQueryDevtoolsStore(scope, STORAGE_KEY, state);
    });

    effect((onCleanup) => {
      const reservation = this.pageReservation();

      if (!reservation) return;

      const root = this.document.documentElement;

      this.renderer.setStyle(root, { boxSizing: 'border-box', [reservation.padding]: `${reservation.px}px` });

      onCleanup(() => this.renderer.removeStyles(root, 'boxSizing', reservation.padding));
    });

    effect((onCleanup) => {
      const reservation = this.overlayReservation();

      if (!reservation) return;

      onCleanup(reserveOverlayViewportSpace(reservation));
    });

    // A window that shrinks below the floating panel would otherwise leave it half (or wholly) off
    // screen, with no edge left to grab. Untracked on the way in so clamping cannot re-trigger itself.
    effect(() => {
      const viewport = this.viewport();

      if (!this.floating()) return;

      untracked(() =>
        this.floatRect.set(
          this.floatParked()
            ? clampFloatToPeek(this.floatRect(), viewport)
            : clampFloatRect(this.floatRect(), viewport),
        ),
      );
    });

    let pinsScope: QueryDevtoolsStorageScope | null = null;

    effect(() => {
      const scope = queryDevtoolsSettings().pins;
      const ids = [...this.pinnedQueryIds()];

      if (scope !== pinsScope) {
        clearQueryDevtoolsStore(PINS_STORAGE_KEY);
        pinsScope = scope;
      }

      writeQueryDevtoolsStore(scope, PINS_STORAGE_KEY, ids);
    });

    effect(() => {
      const cap = queryDevtoolsSettings().maxEvents;

      untracked(() => this.eventLog.update((log) => (log.length > cap ? log.slice(0, cap) : log)));
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
      this.copiedReport.clear();
      this.copiedInsomnia.clear();
      this.copiedCurl.clear();
      this.copiedRoute.clear();
      this.diffRunIndex.set(null);
      this.diffBaseRunIndex.set(null);
      this.errorRunIndex.set(null);

      if (key !== this.lastSelectionKey) {
        this.lastSelectionKey = key;
        this.jsonSearch.set('');
      }
    });

    registerEthleteVersion('components', COMPONENTS_VERSION);
    registerEthleteVersion('query-devtools', QUERY_DEVTOOLS_VERSION);

    this.destroyRef.onDestroy(() => this.closePopup());
    // The poll above ends on `takeUntilDestroyed`, which unsubscribes without a final `false`, so
    // without this the probe lock stays held for the life of the page.
    this.destroyRef.onDestroy(() => this.holdProbeLock(false));

    const doc = this.document;

    // Angular does not destroy the application when the host page unloads, so the clean-up above never
    // runs on a reload - the pop-up would outlive the document whose panel it holds and keep showing a
    // panel no signal can ever update again. `pagehide` rather than `beforeunload`: the latter is
    // unreliable and keeps the page out of the back/forward cache.
    const view = doc.defaultView;

    if (view) {
      fromEvent(view, 'pagehide')
        .pipe(
          tap(() => this.closePopup()),
          takeUntilDestroyed(),
        )
        .subscribe();
    }

    // Global toggle shortcut: Ctrl/Cmd + Alt + Q ("Q" for Query) - uncommon, no browser/OS conflict.
    // Matched on `code` (the physical key), not `key`: on macOS, Option rewrites `key` to the layout's
    // alternate glyph (Option+Q is "œ" on a US layout), so a `key === 'q'` test never fires there.
    fromEvent<KeyboardEvent>(doc, 'keydown')
      .pipe(
        filter(isQueryDevtoolsShortcut),
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
                  filter((e) => e.key === 'Escape'),
                  tap((e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.inspectActive.set(false);
                  }),
                ),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  public ngOnInit() {
    if (this.startOpen()) this.open.set(true);
  }

  public overridesPersist() {
    return queryDevtoolsOverridePersistence();
  }

  public toggleOverridesPersist() {
    setQueryDevtoolsOverridePersistence(!this.overridesPersist());
  }

  public overridesScopeLabel() {
    const scope = queryDevtoolsSettings().overrides;

    return scope === 'none' ? 'not kept' : `${scope}Storage`;
  }

  /**
   * Puts layout, filters, selections, pins and stored overrides back the way they ship; the settings stay.
   * Resets the live state too, or the persistence effects write it straight back.
   */
  public resetDevtools() {
    clearQueryDevtoolsStore(STORAGE_KEY);
    clearQueryDevtoolsStore(PINS_STORAGE_KEY);
    clearQueryDevtoolsOverrideStore();
    clearQueryDevtoolsMockStore();

    this.dock.set('bottom');
    this.reservesSpace.set(true);
    this.panelHeight.set(DEFAULT_HEIGHT);
    this.panelWidth.set(DEFAULT_WIDTH);
    this.floatRect.set(DEFAULT_FLOAT_RECT);
    this.floatParked.set(false);
    this.listWidth.set(null);
    this.drawerWidth.set(null);
    this.listHeight.set(null);
    this.drawerHeight.set(null);

    this.activeTab.set('queries');
    this.detailTab.set('overview');
    this.pinnedQueryIds.set(new Set());
    this.inspectFilterIds.set(null);

    this.selectedClientName.set(null);
    this.selectedQueryId.set(null);
    this.selectedFormId.set(null);
    this.stackSelectedQueryId.set(null);
    this.sequenceSelectedQueryId.set(null);
    this.batchSelectedQueryId.set(null);
    this.eventSelectedQueryId.set(null);
    this.formSelectedQueryId.set(null);
    this.timelineSelectedQueryId.set(null);

    this.queryFilter.set('');
    this.queryFacets.set(new Set());
    this.queryRecentFirst.set(true);
    this.queryTreeView.set(false);
    this.collapsedQueryPaths.set(new Set());
    this.expandedQueryGroups.set(new Set());
    this.expandedSteps.set(new Set());
    this.expandedBatchItems.set(new Set());
    this.eventClient.set(null);
    this.eventErrorsOnly.set(false);
    this.socketFilter.set('');
    this.jsonSearch.set('');
    this.jsonExpandedPaths.set(new Set());
    this.jsonCollapsedPaths.set(new Set());
  }

  protected toggleSettings() {
    if (this.activeTab() === 'settings') {
      this.activeTab.set(this.tabBeforeSettings);

      return;
    }

    this.tabBeforeSettings = this.activeTab();
    this.activeTab.set('settings');
  }

  protected reviewRestoredOverrides(id: string) {
    this.activeTab.set('queries');
    this.selectedQueryId.set(id);
    this.detailTab.set('overview');
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

  protected floatPanel() {
    this.popOutBlocked.set(false);
    this.dock.set('float');
  }

  protected selectLayout(layout: DevtoolsLayout) {
    if (layout === 'popout') {
      this.popOut();

      return;
    }

    this.popOutBlocked.set(false);
    this.dock.set(layout);
  }

  /**
   * Moves the panel element into a pop-up window. The host document's `<style>` tags and root theming
   * tokens must be copied over with it, or the pop-out renders unstyled.
   */
  public popOut() {
    const panel = this.panelEl()?.nativeElement;

    if (!panel || this.poppedOut()) return;

    // Navigated to rather than written into: a pop-up left on `about:blank` keeps its URL as the window
    // title whatever `document.title` says, and a document written into one is quirks-mode - where a
    // table ignores the font size it inherits, so the Cache and Events tables come out half again as
    // large as the panel around them. The blob carries the doctype and the title with it instead.
    this.popOutEnded$.next();

    const source = createObjectUrlHandle(new Blob([POPOUT_DOCUMENT], { type: 'text/html' }));
    const popup = source.url ? this.document.defaultView?.open(source.url, 'et-query-devtools', POPOUT_FEATURES) : null;

    if (!popup) {
      source.revoke();
      this.popOutBlocked.set(true);

      return;
    }

    this.popOutBlocked.set(false);

    // That navigation replaces the pop-up's document, so the panel may only be moved once the new one is
    // there - a panel appended to the initial empty document would be dropped on load.
    fromEvent(popup, 'load')
      .pipe(
        take(1),
        tap(() => this.zone.run(() => this.mountPopOut(popup, panel))),
        takeUntil(this.popOutEnded$),
        finalize(() => source.revoke()),
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

  public clearQueryFilters() {
    this.queryFilter.set('');
    this.queryFacets.set(new Set());
  }

  public isQueryPinned(entry: QueryDevtoolsEntry) {
    return this.pinnedQueryIds().has(entry.id);
  }

  public toggleQueryPath(key: string) {
    const next = new Set(this.collapsedQueryPaths());

    if (!next.delete(key)) next.add(key);

    this.collapsedQueryPaths.set(next);
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

  protected moveFloat(move: DragMoveEvent) {
    this.floatGesture.set(true);
    this.floatRect.update((rect) =>
      clampFloatToPeek({ ...rect, x: rect.x + move.stepX, y: rect.y + move.stepY }, this.viewport()),
    );
  }

  protected endFloatMove() {
    const settled = settledFloatRect(this.floatRect(), this.viewport());

    this.floatRect.set(settled.rect);
    this.floatParked.set(settled.collapsed);
    this.floatGesture.set(false);
  }

  protected restoreFloat() {
    if (!this.floatParked()) return;

    this.floatRect.update((rect) => clampFloatRect(rect, this.viewport()));
    this.floatParked.set(false);
  }

  protected startFloatResize() {
    this.floatResizeBase = this.floatRect();
    this.floatGesture.set(true);
  }

  protected resizeFloat(move: ResizeMoveEvent) {
    this.floatRect.set(resizedFloatRect(this.floatResizeBase ?? this.floatRect(), { move, viewport: this.viewport() }));
  }

  protected endFloatResize() {
    this.floatResizeBase = null;
    this.floatGesture.set(false);
  }

  public startPaneResize(event: PointerEvent, target: { pane: PaneTarget; container: HTMLElement }) {
    event.preventDefault();
    this.drag.set({ kind: 'pane', ...target, axis: this.paneAxis(), doc: target.container.ownerDocument });
  }

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

  public routeSegments(entry: QueryDevtoolsEntry | undefined, query: AnyQuery): RouteSegment[] {
    const path = this.renderRoute(entry, this.queryArgs(query));
    const search = query.subtle.request()?.url.split('?')[1];

    return search && path.length ? [...path, { text: `?${search}`, kind: 'query' }] : path;
  }

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

  /**
   * The headers the last run sent, or what the args and client resolve to now for a query that has not
   * run; `null` while a header provider throws. Client headers and the secure `Authorization` never
   * reach the args, so the args alone cannot answer this.
   */
  public requestHeaders(query: AnyQuery) {
    const request = query.subtle.request();
    const args = this.queryArgs(query) as { headers?: unknown } | null;
    const headers = request?.subtle.lastSentHeaders() ?? this.resolvedHeaders(request, args);

    if (!headers) return null;

    const entries = headerEntries(headers);

    return entries.length ? Object.fromEntries(entries.map(({ k, v }) => [k, v])) : null;
  }

  public queryStatus(query: AnyQuery): QueryStatus {
    const state = query.executionState();
    if (!state) return 'idle';
    if (state.type === 'loading') return 'loading';
    if (state.type === 'failure') return 'error';
    return 'success';
  }

  public isStale(query: AnyQuery) {
    try {
      const request = query.subtle.request();

      if (!request || request.loading()) return false;

      return request.isStale();
    } catch {
      return false;
    }
  }

  public isTampered(entry: QueryDevtoolsEntry) {
    return (
      (entry.overrides?.list().length ?? 0) > 0 ||
      (entry.stats?.current().lastResponseWasFaulted ?? false) ||
      this.isMocked(entry)
    );
  }

  public isMocked(entry: QueryDevtoolsEntry) {
    if (!entry.meta.route) return false;

    const id = queryDevtoolsMockId({
      clientName: entry.meta.clientName ?? '',
      method: entry.meta.method ?? 'GET',
      pattern: entry.meta.route,
    });

    return queryDevtoolsArmedMocks().has(id);
  }

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

  public retryCause(status: number) {
    return status ? `after ${status}` : 'after a connection failure';
  }

  public formatPercent(percentage: number) {
    return `${Math.round(percentage)}%`;
  }

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

  public resetStats(entry: QueryDevtoolsEntry) {
    entry.stats?.reset();
    this.diffRunIndex.set(null);
    this.diffBaseRunIndex.set(null);
    this.errorRunIndex.set(null);
  }

  public queryRuns(entry: QueryDevtoolsEntry): QueryDevtoolsRun[] {
    return [...(entry.stats?.runs() ?? [])].reverse();
  }

  public runStatus(run: QueryDevtoolsRun) {
    return run.status === 'pending' ? 'loading' : run.status;
  }

  public canDiffRun(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun) {
    if (!run.hasResponse) return false;

    return (entry.stats?.runs() ?? []).some((other) => other.hasResponse && other.index !== run.index);
  }

  public toggleRunDiff(entry: QueryDevtoolsEntry, run: QueryDevtoolsRun) {
    const ends = this.diffEnds(entry);

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

  public canStepRunDiff(entry: QueryDevtoolsEntry, older: boolean) {
    return !!this.steppedDiffPair(entry, older);
  }

  public stepRunDiff(entry: QueryDevtoolsEntry, older: boolean) {
    const pair = this.steppedDiffPair(entry, older);

    if (!pair) return;

    this.diffBaseRunIndex.set(pair.before.index);
    this.diffRunIndex.set(pair.after.index);
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

  public selectQuery(id: string) {
    this.activeTab.set('queries');
    this.selectedQueryId.set(id);
  }

  public inlineValue(value: unknown) {
    if (typeof value === 'string') return value.length > 80 ? `"${value.slice(0, 80)}…"` : `"${value}"`;
    if (value === undefined) return 'undefined';

    const exotic = inlineExoticOf(value);

    if (exotic) return exotic;

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

  public formatTransferred(bytes: number, isEstimated: boolean) {
    return `${isEstimated ? '≈' : ''}${this.formatBytes(bytes)}`;
  }

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

  public copyReport(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const error = query.error();
    const httpStatus = error ? error.raw.status : this.responseStatus(query);
    const method = entry.meta.method ?? '';

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
    const argsJson = args !== null && args !== undefined ? JSON.stringify(slimForReport(args), null, 2) : null;
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

  public copyCurlRequest(entry: QueryDevtoolsEntry, query: AnyQuery) {
    this.writeToClipboard({ text: buildCurlCommand(this.exportedRequest(entry, query)) }, this.copiedCurl);
  }

  public copyGqlDocument(doc: string) {
    this.writeToClipboard({ text: this.gqlDocument(doc) }, this.copiedGql);
  }

  public copyableRoute(entry: QueryDevtoolsEntry, query: AnyQuery) {
    return this.requestUrl(query) ?? this.queryRoute(entry, query);
  }

  public copyableRouteTitle(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const route = this.copyableRoute(entry, query);
    const kind = this.requestUrl(query) ? 'the absolute URL of the last request' : 'the rendered route';

    return `Copy ${kind}: ${route}`;
  }

  public copyRoute(entry: QueryDevtoolsEntry, query: AnyQuery) {
    this.writeToClipboard({ text: this.copyableRoute(entry, query) }, this.copiedRoute);
  }

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

  protected downloadSession() {
    const now = Date.now();
    const json = JSON.stringify(
      buildQueryDevtoolsSessionExport({
        now,
        location: this.document.location?.href ?? '',
        about: queryDevtoolsAbout(),
        clients: this.sessionClients(),
        entries: this.sessionEntries(),
        events: this.sessionEvents(),
        faults: this.sessionFaults(),
        mocks: this.sessionMocks(),
        authQueryKeys: this.sessionAuthQueryKeys(),
      }),
      null,
      2,
    );

    this.downloadFile(`query-devtools-session-${now}.json`, json);
  }

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

  public forceLoading(query: AnyQuery) {
    // `executionState` prioritises loading > error > response, so clear the others to switch cleanly.
    query.subtle.setError(null);
    query.subtle.setLoading({ executeTime: Date.now(), progress: null });
  }

  public forceError(query: AnyQuery) {
    query.subtle.setLoading(null);
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

  public refetchCacheEntry(entry: QueryRepositoryCacheEntry) {
    entry.request.execute();
  }

  public evictCacheEntry(repository: QueryRepository, key: string) {
    repository.subtle.evict(key);
  }

  public evictAllCacheEntries(repository: QueryRepository) {
    for (const entry of repository.subtle.cacheEntries()) repository.subtle.evict(entry.key);
  }

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

  public cacheSync(entry: QueryRepositoryCacheEntry, pollStates: Record<string, QueryKeyLockState>) {
    this.clock();

    const parts: string[] = [];
    const pollState = pollStates[entry.key];

    if (pollState) parts.push(pollState === 'holder' ? 'polling' : 'standby');

    const lastSyncedAt = entry.request.subtle.lastExternalResponseAt();

    if (lastSyncedAt !== null) parts.push(`synced ${Math.max(0, Math.round((Date.now() - lastSyncedAt) / 1000))}s ago`);

    return parts.join(' · ') || '-';
  }

  public cachePersistence(entry: QueryRepositoryCacheEntry) {
    this.clock();

    const hydratedAt = entry.request.subtle.lastPersistedResponseAt();

    if (hydratedAt === null) return '-';

    return `from disk ${Math.max(0, Math.round((Date.now() - hydratedAt) / 1000))}s ago`;
  }

  public persistedCount(client: QueryClient) {
    this.clock();

    return client.subtle.persistence?.indexEntries().length ?? 0;
  }

  public clearPersistedQueries(client: QueryClient) {
    void client.clearPersistedQueries();
  }

  public requestPath(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  public asStack(entry: QueryDevtoolsEntry): AnyQueryStack {
    return entry.handle as AnyQueryStack;
  }

  public asPagedStack(entry: QueryDevtoolsEntry): AnyPagedQueryStack {
    return entry.handle as AnyPagedQueryStack;
  }

  public asSequence(entry: QueryDevtoolsEntry): QuerySequence<unknown[]> {
    return (entry.handle as { current: QuerySequence<unknown[]> }).current;
  }

  public asBatch(entry: QueryDevtoolsEntry): AnyQueryBatch {
    return (entry.handle as { current: AnyQueryBatch }).current;
  }

  public asAuth(entry: QueryDevtoolsEntry): AnyBearerAuthProvider {
    return entry.handle as AnyBearerAuthProvider;
  }

  public asWs(entry: QueryDevtoolsEntry): WebSocketDevtoolsHandle {
    return entry.handle as WebSocketDevtoolsHandle;
  }

  public socketMessages(ws: WebSocketDevtoolsHandle) {
    const messages = ws.messages();
    const terms = this.socketFilter().trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (!terms.length) return messages;

    return messages.filter((message) => {
      const haystack = `${message.direction} ${message.event} ${message.room}`.toLowerCase();

      return terms.every((term) => haystack.includes(term));
    });
  }

  public socketDirectionLabel(message: WebSocketDevtoolsMessage) {
    return message.direction === 'out' ? '↑ sent' : '↓ received';
  }

  public emitSocketMessage(options: { entry: QueryDevtoolsEntry; event: string; data: string }) {
    const { entry, event, data } = options;
    const name = event.trim();

    if (!name) {
      this.socketEmitError.set({ entryId: entry.id, message: 'An event name is required.' });

      return;
    }

    const payload = data.trim();
    let parsed: unknown;

    try {
      parsed = payload ? JSON.parse(payload) : undefined;
    } catch {
      this.socketEmitError.set({ entryId: entry.id, message: 'Invalid JSON' });

      return;
    }

    try {
      this.asWs(entry).emit({ event: name, data: parsed });
      this.socketEmitError.set(null);
    } catch (error) {
      this.socketEmitError.set({
        entryId: entry.id,
        message: error instanceof Error ? error.message : 'The socket did not take the message.',
      });
    }
  }

  public socketEmitErrorFor(entryId: string) {
    const error = this.socketEmitError();

    return error?.entryId === entryId ? error.message : null;
  }

  public asForm(entry: QueryDevtoolsEntry): QueryDevtoolsFormHandle {
    return entry.handle as QueryDevtoolsFormHandle;
  }

  public queriesDrivenByForm(entry: QueryDevtoolsEntry): QueryLink[] {
    return this.queryEntries()
      .filter((candidate) => candidate.formLinks?.ids().includes(entry.id))
      .map((candidate) => this.queryLinkFor(candidate));
  }

  public formsDrivingQuery(entry: QueryDevtoolsEntry): QueryDevtoolsEntry[] {
    const ids = entry.formLinks?.ids() ?? [];

    return this.formEntries().filter((form) => ids.includes(form.id));
  }

  public selectForm(id: string) {
    this.activeTab.set('forms');
    this.selectedFormId.set(id);
  }

  public refreshesFor(entryId: string) {
    return this.eventLog()
      .filter((item) => item.cause && item.refreshed?.some((refreshed) => refreshed.queryIds.includes(entryId)))
      .map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        label: this.causeLabel(item.cause as QueryRefreshCause),
      }));
  }

  public causeLabel(cause: QueryRefreshCause) {
    const scope =
      [cause.url ? this.requestPath(cause.url) : null, cause.tag ? `tag ${cause.tag}` : null]
        .filter((part) => part !== null)
        .join(' · ') || 'everything in use';
    const what =
      cause.type === 'invalidation'
        ? `invalidated ${scope}`
        : cause.type === 'mutation'
          ? `mutation on ${scope}`
          : `refreshed ${scope}`;

    return cause.otherTab ? `${what} · another tab` : what;
  }

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

  public lockStanding(row: DevtoolsLockRow): QueryDevtoolsChip {
    switch (row.standing) {
      case 'holder':
        return { label: 'holds it', tone: 'success', title: 'This tab is the one doing the work this lock guards.' };
      case 'queued':
        return {
          label: `waiting · #${row.queuePlace}`,
          tone: 'muted',
          title: `Another tab holds this lock. This one is number ${row.queuePlace} in line and takes over as soon as the tabs ahead of it release it - by closing, crashing or navigating away.`,
        };
      case 'absent':
        return {
          label: 'not taking part',
          tone: 'muted',
          title: 'Another tab holds this lock and this one never asked for it.',
        };
      case 'unknown':
        return {
          label: 'unknown',
          tone: 'muted',
          title:
            'The probe lock this tab identifies itself with has not been granted yet - the next poll should resolve it.',
        };
    }
  }

  public authLeadership(auth: AnyBearerAuthProvider): QueryDevtoolsChip | null {
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
    const title = `${isLeader ? 'This tab performs the automatic token refresh.' : 'Another tab performs the automatic token refresh.'} ${tabs} tab${tabs === 1 ? '' : 's'} in the election, counted on the last announce - a tab that crashed as a follower is still counted.`;

    return {
      label: `${isLeader ? 'leader' : 'follower'} · ~${tabs} tab${tabs === 1 ? '' : 's'}`,
      tone: isLeader ? 'success' : 'muted',
      title,
    };
  }

  public authTokenLifetime(entry: QueryDevtoolsEntry): QueryDevtoolsTokenLifetime {
    this.clock();

    const providerName = entry.meta.name ?? '';
    const payload = decodeJwtPayload(this.asAuth(entry).accessToken());
    const ttlSeconds = queryDevtoolsTokenTtls()[providerName] ?? null;
    const realExp = typeof payload?.['exp'] === 'number' ? payload['exp'] : null;
    const overridden = applyQueryDevtoolsTokenTtl({ payload, providerName });
    const exp = typeof overridden?.['exp'] === 'number' ? overridden['exp'] : null;

    return {
      expiresIn: expiryCountdown(exp),
      realExpiresIn: exp === realExp ? null : expiryCountdown(realExp),
      ttlSeconds,
      overridable: canOverrideQueryDevtoolsTokenTtl({ payload }),
    };
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

  public expandQueryGroup(key: string) {
    if (this.expandedQueryGroups().has(key)) return;

    this.expandedQueryGroups.set(new Set(this.expandedQueryGroups()).add(key));
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

  public batchRouteSegments(entry: QueryDevtoolsEntry): RouteSegment[] {
    return this.renderRoute(entry, null);
  }

  public batchOf(entry: QueryDevtoolsEntry): QueryDevtoolsEntry | null {
    const handle = entry.meta.batch;

    return handle ? (this.batchEntries().find((e) => e.handle === handle) ?? null) : null;
  }

  public queriesForBatch(entry: QueryDevtoolsEntry): QueryLink[] {
    return this.queryEntries()
      .filter((e) => e.meta.batch === entry.handle && !e.destroyedAt)
      .map((e) => this.queryLinkFor(e, e.handle as AnyQuery));
  }

  public batchItemQueryId(entry: QueryDevtoolsEntry, index: number): string | null {
    const item = this.queryEntries().find((e) => e.meta.batch === entry.handle && e.meta.batchItemIndex === index);

    return item?.id ?? null;
  }

  public batchItems(entry: QueryDevtoolsEntry): BatchItemView {
    const results = this.asBatch(entry).results();

    // Failures first: a bulk edit is read for the items it could not apply, and those are the ones a
    // cap must never be what drops. Everything else keeps input order.
    const ordered = [
      ...results.filter((result) => result.status === 'error'),
      ...results.filter((result) => result.status !== 'error'),
    ];

    return {
      rows: ordered.slice(0, MAX_BATCH_ITEM_ROWS).map((result) => ({
        result,
        segments: this.argsRouteSegments(entry, 'args' in result ? result.args : null),
      })),
      total: results.length,
      hidden: Math.max(0, results.length - MAX_BATCH_ITEM_ROWS),
    };
  }

  public batchThroughput(batch: AnyQueryBatch): string | null {
    const rate = batch.itemsPerSecond();

    if (rate === null) return null;

    const remaining = batch.remainingTime();
    const perSecond = `${rate.toFixed(rate < 10 ? 1 : 0)} items/s`;

    return remaining === null ? perSecond : `${perSecond} · ~${this.formatDuration(remaining)} left`;
  }

  public isBatchItemExpanded(entryId: string, index: number) {
    return this.expandedBatchItems().has(this.stepKey(entryId, index));
  }

  public toggleBatchItem(entryId: string, index: number) {
    const key = this.stepKey(entryId, index);
    const next = new Set(this.expandedBatchItems());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedBatchItems.set(next);
  }

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

  public featureSummary(feature: QueryDevtoolsFeature) {
    const details = feature.details.map((detail) => `${detail.label} ${detail.value}`);

    return [this.featureLabel(feature.type), ...details].join(' · ');
  }

  public clientFeatures(client: QueryClient | null | undefined) {
    const features = client?.subtle.devtoolsFeatures ?? [];

    return features.length ? features : null;
  }

  public formatTime(timestamp: number | null) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false });
  }

  public locatableElement(entry: QueryDevtoolsEntry) {
    return entry.meta.element ?? null;
  }

  public locateQuery(entry: QueryDevtoolsEntry) {
    const element = this.locatableElement(entry);
    if (!element) return;

    const target = element.isConnected ? renderedTarget(element) : null;

    if (!target) {
      this.locatedRect.set(null);
      this.locateState.set('offscreen');
      this.locate$.next(null);

      return;
    }

    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    this.locateState.set('located');
    this.locate$.next(target);
  }

  public downloadTextFile(file: { name: string; content: string; type: string }) {
    this.download({ content: file.content, filename: file.name, type: file.type });
  }

  public eventQueryId(event: EventLogItem) {
    if (this.eventOwners.has(event)) return this.eventOwners.get(event) ?? null;

    const id = resolveQueryDevtoolsEventOwner(this.queryEntries(), event);

    this.eventOwners.set(event, id);

    return id;
  }

  private resolvedHeaders(
    request: { subtle: { resolveHeaders: () => HttpHeaders | undefined } } | null | undefined,
    args: { headers?: unknown } | null,
  ) {
    try {
      if (request) return request.subtle.resolveHeaders();

      return resolveQueryHeaders(args?.headers as QueryHeadersInput | undefined);
    } catch {
      return undefined;
    }
  }

  private argsRouteSegments(entry: QueryDevtoolsEntry, args: unknown): RouteSegment[] {
    return this.renderRoute(entry, args as Record<string, unknown> | null);
  }

  private renderRoute(
    entry: QueryDevtoolsEntry | undefined,
    args: Record<string, unknown> | null | undefined,
  ): RouteSegment[] {
    const parts = entry?.meta.routeParts;

    if (!parts?.length) {
      return entry?.meta.route ? [{ text: entry.meta.route, kind: 'static' }] : [];
    }

    const pathParams = args?.['pathParams'] as Record<string, unknown> | undefined;

    return parts.map(({ text, param }): RouteSegment => {
      if (!param) return { text, kind: 'static' };

      const value = pathParams?.[param];

      return { text: value === undefined || value === null ? `:${param}` : String(value), kind: 'param', name: param };
    });
  }

  /**
   * Takes - or gives back - the lock whose name only this tab can have produced. Its `clientId` in the
   * snapshot is what tells this tab's rows from another tab's: `LockInfo` carries no tab identity, and
   * the platform offers no way to ask for one's own client id.
   */
  private holdProbeLock(inspecting: boolean) {
    if (inspecting) {
      this.probeHold ??= this.probeLocks.hold(devtoolsProbeLockKey(this.probeId));

      return;
    }

    this.probeHold?.release();
    this.probeHold = null;
    // A snapshot outlives the probe that made it readable, so keeping it would have every row claim it
    // belongs to some other tab the next time the tab is opened.
    this.lockSnapshot.set(null);
  }

  private steppedDiffPair(entry: QueryDevtoolsEntry, older: boolean) {
    const comparison = this.responseDiff(entry);

    if (!comparison) return null;

    // `stats.runs()` is oldest-first, so one step older is one index down.
    const held = (entry.stats?.runs() ?? []).filter((run) => run.hasResponse);
    const shift = older ? -1 : 1;
    const before = held[held.findIndex((run) => run.index === comparison.before.index) + shift];
    const after = held[held.findIndex((run) => run.index === comparison.after.index) + shift];

    return before && after ? { before, after } : null;
  }

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

    return { before: picked, after: undefined };
  }

  private isTabPrimary(tab: DevtoolsTab) {
    const badge = this.tabBadges()[tab];

    return this.PINNED_TABS.includes(tab) || this.activeTab() === tab || !!badge.count || !!badge.errors;
  }

  private mountPopOut(popup: Window, panel: HTMLElement) {
    const doc = popup.document;
    const renderer = this.renderer;

    renderer.setAttribute(doc.documentElement, 'class', this.document.documentElement.className);
    renderer.setCssProperties(doc.documentElement, this.inlineStyleOf(this.document.documentElement));
    renderer.setAttribute(doc.body, 'class', this.document.body.className);
    renderer.setStyle(doc.body, { margin: '0' });

    // Inserted before the stylesheets it applies to: a blob document's own base URL is the blob, so a
    // copied `<link href="styles.css">` - and every relative `url()` inside a copied `<style>` - would
    // resolve against nothing and silently fail to load.
    const base = renderer.createElement('base');

    renderer.setAttribute(base, 'href', this.document.baseURI);
    renderer.appendChild(doc.head, base);

    for (const styles of DEFERRED_STYLES) this.styleManager.mount(styles);

    this.popOutStyleSync = this.syncStylesInto(doc);

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
        takeUntil(this.popOutEnded$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    fromEvent<KeyboardEvent>(doc, 'keydown')
      .pipe(
        filter(isQueryDevtoolsShortcut),
        tap((event) => {
          event.preventDefault();
          this.zone.run(() => this.toggleOpen());
        }),
        takeUntil(this.popOutEnded$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    fromEvent(doc, 'visibilitychange')
      .pipe(
        startWith(null),
        tap(() => this.zone.run(() => this.popupVisible.set(doc.visibilityState !== 'hidden'))),
        takeUntil(this.popOutEnded$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.popup = popup;
    this.poppedOut.set(true);
  }

  /**
   * The chrome tokens as the app resolves them now: the pop-out has no ancestor carrying the host theme.
   * Empty on a browser that does not enumerate custom properties.
   */
  private chromeTokens() {
    const styles = this.document.defaultView?.getComputedStyle(this.hostEl.nativeElement);
    const tokens: Record<string, string> = {};

    for (const property of Array.from(styles ?? [])) {
      if (property.startsWith('--_et-qdt-')) tokens[property] = styles?.getPropertyValue(property) ?? '';
    }

    return tokens;
  }

  private inlineStyleOf(element: HTMLElement) {
    const styles: Record<string, string> = {};

    for (const property of Array.from(element.style)) styles[property] = element.style.getPropertyValue(property);

    return styles;
  }

  private isStyleNode(node: Element) {
    if (node.tagName === 'STYLE') return true;

    return node.tagName === 'LINK' && (node.getAttribute('rel') ?? '').includes('stylesheet');
  }

  /**
   * Copies the host document's stylesheets into the pop-up and keeps mirroring them while it is
   * open. Styles keep arriving after the move: Angular inserts a component's CSS and the style
   * manager mounts overlay strategy CSS the first time each is used - e.g. the first menu opened
   * over there - so a one-time copy would leave everything first used after the pop-out unstyled.
   */
  private syncStylesInto(doc: Document) {
    const copies = new Map<Element, Element>();

    const copy = (node: Node) => {
      if (!(node instanceof Element) || !this.isStyleNode(node) || copies.has(node)) return;

      const clone = doc.importNode(node, true);

      // A nonce'd element hides its `nonce` attribute once connected, so the clone gets it from the property.
      if (node instanceof HTMLElement && node.nonce) this.renderer.setAttribute(clone, 'nonce', node.nonce);

      copies.set(node, clone);
      this.renderer.appendChild(doc.head, clone);
    };

    const drop = (node: Node) => {
      if (!(node instanceof Element)) return;

      copies.get(node)?.remove();
      copies.delete(node);
    };

    for (const node of Array.from(this.document.head.children)) copy(node);

    // eslint-disable-next-line ethlete/no-native-observers -- this observer lives with the pop-out window, not with the component
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.removedNodes.forEach(drop);
        mutation.addedNodes.forEach(copy);
      }
    });

    observer.observe(this.document.head, { childList: true });

    return () => observer.disconnect();
  }

  private dockBack() {
    const panel = this.panelEl()?.nativeElement;

    if (panel) this.renderer.appendChild(this.hostEl.nativeElement, panel);

    this.poppedOut.set(false);
    this.closePopup();
  }

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

  private queryRoute(entry: QueryDevtoolsEntry | undefined, query: AnyQuery) {
    return this.routeSegments(entry, query)
      .map((segment) => segment.text)
      .join('');
  }

  private exportedRequest(entry: QueryDevtoolsEntry, query: AnyQuery): InsomniaRequestInput {
    const request = query.subtle.request();
    const args = this.queryArgs(query) as { body?: unknown; headers?: unknown } | null;
    const route = this.queryRoute(entry, query);

    return {
      method: request?.method ?? (entry.meta.gqlQuery ? 'POST' : (entry.meta.method ?? 'GET')),
      url: request?.url ?? `${entry.meta.clientBaseUrl ?? ''}${route}`,
      name: `${entry.meta.method ?? ''} ${request ? this.requestPath(request.url) : route || query.id() || 'request'}`.trim(),
      headers: this.insomniaHeaders(request, args),
      body: args?.body ?? null,
      gqlQuery: entry.meta.gqlQuery ? this.gqlDocument(entry.meta.gqlQuery) : null,
      group: entry.meta.clientName ?? null,
      secureBy: entry.meta.isSecure ? (entry.meta.authProviderName ?? null) : null,
    };
  }

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

  private accessTokenPath(provider: AnyBearerAuthProvider) {
    const token = provider.accessToken();
    const response = provider.latestExecutedQuery()?.snapshot.response();

    const path = token && response ? findInsomniaValuePath(token, response) : null;

    return path ?? '$.accessToken';
  }

  private accessTokenMaxAge(provider: AnyBearerAuthProvider) {
    const payload = decodeJwtPayload(provider.accessToken());
    const exp = payload?.['exp'];
    const iat = payload?.['iat'];

    if (typeof exp !== 'number') return DEFAULT_TOKEN_MAX_AGE_S;

    const lifetime = exp - (typeof iat === 'number' ? iat : Math.floor(Date.now() / 1000));

    if (lifetime <= 0) return DEFAULT_TOKEN_MAX_AGE_S;

    return Math.min(MAX_TOKEN_MAX_AGE_S, Math.max(60, Math.round(lifetime * 0.9)));
  }

  private insomniaHeaders(
    request: { subtle: { resolveHeaders: () => HttpHeaders | undefined } } | null | undefined,
    args: { headers?: unknown } | null,
  ) {
    const headers = this.resolvedHeaders(request, args);

    return headers ? headerEntries(headers).map(({ k, v }) => ({ name: k, value: v })) : [];
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

  private sessionAuthQueryKeys(): string[] {
    return queryDevtoolsEntries()
      .filter((entry) => entry.kind === 'auth-provider')
      .flatMap((entry) =>
        (entry.meta.authQueries ?? []).map((authQuery) =>
          sessionAuthQueryKey({
            client: entry.meta.clientBaseUrl ?? entry.meta.clientName ?? null,
            method: authQuery.method,
            route: authQuery.route,
          }),
        ),
      );
  }

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
      if (entry.kind === 'query-batch')
        return { ...base, method: entry.meta.method ?? null, detail: this.sessionBatch(entry) };
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

  private sessionBatch(entry: QueryDevtoolsEntry): Record<string, unknown> {
    const batch = this.asBatch(entry);
    const items = this.batchItems(entry);

    return {
      route: entry.meta.route ?? null,
      status: batch.status(),
      concurrency: entry.meta.concurrency ?? null,
      stopOnError: entry.meta.stopOnError ?? null,
      total: batch.total(),
      completed: batch.completed(),
      inFlight: batch.inFlight(),
      succeeded: batch.succeeded(),
      failed: batch.failed(),
      skipped: batch.skipped(),
      itemsPerSecond: batch.itemsPerSecond(),
      remainingTimeMs: batch.remainingTime(),
      listedItems: items.rows.length,
      hiddenItems: items.hidden,
      items: items.rows.map((row) => {
        const error = row.result.status === 'error' ? row.result.error : null;

        return {
          index: row.result.index,
          status: row.result.status,
          route: row.segments.map((segment) => segment.text).join(''),
          error: error
            ? { status: error.raw.status, body: slimForReport(error.isList ? error.errors : error.error) }
            : null,
        };
      }),
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
    const lifetime = this.authTokenLifetime(entry);

    return {
      isAuthenticated: auth.isAuthenticated(),
      hasAccessToken: !!auth.accessToken(),
      hasRefreshToken: !!auth.refreshToken(),
      expiresIn: lifetime.expiresIn,
      overriddenTokenTtlSeconds: lifetime.ttlSeconds,
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

  private sessionMocks(): SessionExportMock[] {
    const armed = queryDevtoolsArmedMocks();

    return queryDevtoolsMocks()
      .filter((mock) => armed.has(mock.id))
      .map((mock) => ({
        client: mock.clientName,
        method: mock.method,
        pattern: mock.pattern,
        status: mock.status,
        latencyMs: mock.latencyMs,
        body: slimForReport(mock.body),
      }));
  }

  private downloadFile(fileName: string, content: string) {
    this.downloadTextFile({ name: fileName, content, type: 'application/json' });
  }

  private stepKey(entryId: string, index: number) {
    return `${entryId}:${index}`;
  }

  private paneSize(pane: PaneTarget, axis: PaneAxis) {
    if (axis === 'block') return pane === 'list' ? this.listHeight : this.drawerHeight;

    return pane === 'list' ? this.listWidth : this.drawerWidth;
  }

  private applyResize(drag: ResizeDrag, event: PointerEvent) {
    if (drag.kind === 'pane') {
      this.applyPaneResize(drag, event);

      return;
    }

    const root = this.document.documentElement;
    const dock = this.dock();

    if (this.sideDocked()) {
      const viewport = root.clientWidth;
      const size = dock === 'right' ? viewport - event.clientX : event.clientX;

      this.panelWidth.set(clamp(size, MIN_WIDTH, Math.round(viewport * 0.9)));

      return;
    }

    const viewport = root.clientHeight;
    const size = dock === 'bottom' ? viewport - event.clientY : event.clientY;

    this.panelHeight.set(clamp(size, MIN_HEIGHT, Math.round(viewport * 0.9)));
  }

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

    this.popOutEnded$.next();
    this.popup = null;
    this.popOutStyleSync?.();
    this.popOutStyleSync = null;
    popup?.close();
  }

  private updateInspectHover(event: MouseEvent) {
    const host = this.hostEl.nativeElement;
    const map = this.elementQueryMap();
    let node = event.target as HTMLElement | null;

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
    const target = event.target as Node | null;

    if (target && this.hostEl.nativeElement.contains(target)) return;

    event.preventDefault();
    event.stopPropagation();

    const hover = this.inspectHover();
    const first = hover?.entries[0];

    if (!hover || !first) return;

    const ids = hover.entries.map((e) => e.id);

    this.open.set(true);
    this.activeTab.set('queries');
    this.selectedClientName.set(null);
    this.inspectFilterIds.set(ids);
    this.selectedQueryId.set(ids.length === 1 ? first.id : null);
    this.inspectActive.set(false);
  }

  private selectionKey() {
    return [
      this.selectedQueryId(),
      this.stackSelectedQueryId(),
      this.sequenceSelectedQueryId(),
      this.batchSelectedQueryId(),
      this.eventSelectedQueryId(),
      this.formSelectedQueryId(),
      this.timelineSelectedQueryId(),
    ].join('|');
  }

  private writeToClipboard(payload: { text: string; html?: string }, copied: QueryDevtoolsCopiedTick<boolean>) {
    const doc = this.panelEl()?.nativeElement.ownerDocument ?? this.document;

    writeQueryDevtoolsClipboard(payload, doc).then((result) => {
      if (result.ok) copied.mark(true);
    });
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

    if (event.type === 'entry-destroyed') {
      this.droppedCacheEntries.update((list) => {
        const next: DroppedCacheEntry[] = [
          { client, method: event.method, url: event.url, cause: event.cause, at: base.timestamp },
          ...list,
        ];
        let kept = 0;

        const cap = queryDevtoolsSettings().maxDroppedCacheEntries;

        return next.filter((entry) => entry.client !== client || ++kept <= cap);
      });

      this.pushEventItem({
        ...base,
        method: event.method,
        url: event.url,
        isSecure: event.isSecure,
        status: null,
        destroyCause: event.cause,
        request: null,
      });

      return;
    }

    if (event.type === 'unbind-all-secure') {
      this.pushEventItem({ ...base, method: null, url: null, isSecure: true, status: null, request: null });

      return;
    }

    if (event.type === 'queries-refreshed') {
      this.pushEventItem({
        ...base,
        method: null,
        url: null,
        isSecure: false,
        status: null,
        request: null,
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
      request: new WeakRef(event.request),
    });
  }

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
    this.eventLog.update((log) => [item, ...log].slice(0, queryDevtoolsSettings().maxEvents));
  }
}
