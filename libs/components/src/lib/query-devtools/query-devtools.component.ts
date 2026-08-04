import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  ViewEncapsulation,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { injectRenderer } from '@ethlete/core';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQuerySnapshot,
  AnyQueryStack,
  createQueryErrorResponse,
  Query,
  QueryClient,
  queryDevtoolsEntries,
  QueryDevtoolsEntry,
  QueryDevtoolsFeature,
  QueryDevtoolsStats,
  QueryDevtoolsStatsHandle,
  sumQueryDevtoolsStats,
  QueryKeyLockState,
  QueryRepository,
  QueryRepositoryCacheEntry,
  QueryRepositoryEvent,
  QuerySequence,
  QuerySequenceStatus,
  WebSocketDevtoolsHandle,
} from '@ethlete/query';
import { EMPTY, filter, fromEvent, interval, map, merge, Subject, switchMap, tap, timer } from 'rxjs';
import { buildInsomniaExport, InsomniaRequestInput, InsomniaTokenRefreshInput } from './query-devtools-insomnia';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { queryDevtoolsShortcutLabel } from './query-devtools-shortcut';
import { QueryDevtoolsToggleComponent } from './query-devtools-toggle.component';

// The registry stores queries type-erased; the panel reads them structurally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = Query<any>;

type DevtoolsTab = 'queries' | 'stacks' | 'sequences' | 'auth' | 'ws' | 'cache' | 'events';

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * A chunk of a route as rendered: literal path text, a path param (`name` is the param it fills in) or
 * the query string of the request that ran. The kind becomes the segment's class.
 */
type RouteSegment = { text: string; kind: 'static' | 'param' | 'query'; name?: string };

/** A query reachable from a stack or sequence card, rendered as a row that opens the detail drawer. */
type QueryLink = {
  id: string;
  query: AnyQuery;
  method: string;
  segments: RouteSegment[];
  clientBaseUrl: string;
  stats?: QueryDevtoolsStatsHandle;
};

/**
 * Query stats plus the numbers the panel derives from them rather than storing: an execution that never
 * reached the network was answered from the cache, and the averages come from the running totals.
 */
type QueryActivity = {
  stats: QueryDevtoolsStats;
  cacheServed: number;
  avgDurationMs: number | null;
  avgResponseBytes: number | null;
  hasActivity: boolean;
};

type EventLogItem = {
  id: number;
  timestamp: number;
  client: string;
  type: QueryRepositoryEvent['type'];

  /** `null` for events that are not about a single request, e.g. the logout-wide secure unbind. */
  method: string | null;
  url: string | null;
  isSecure: boolean;
  status: number | null;
};

type PersistedState = {
  open?: boolean;
  height?: number;
  activeTab?: DevtoolsTab;
  selectedClientName?: string | null;
  selectedQueryId?: string | null;
  inspectFilterIds?: string[] | null;
  jsonSearch?: string;
  expandedSteps?: string[];
  jsonExpanded?: string[];
  jsonCollapsed?: string[];
};

/** How long a copy button stays ticked after a successful write. */
const COPIED_RESET_MS = 1200;

const noop = () => undefined;

const STORAGE_KEY = 'ethlete:query:devtools:v4';
const MAX_EVENTS = 100;
const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 200;

const readPersistedState = (): PersistedState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
};

/**
 * Slims a value for a shareable report: long strings are truncated and long arrays keep only the
 * first couple of entries, replacing the repetitive tail with a `… (N more)` marker, so a big
 * response collapses to a representative sample.
 */
const slimForReport = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (depth > 6) return '…';

  if (Array.isArray(value)) {
    if (value.length > 3) {
      return [...value.slice(0, 2).map((v) => slimForReport(v, depth + 1)), `… (${value.length - 2} more)`];
    }

    return value.map((v) => slimForReport(v, depth + 1));
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) out[key] = slimForReport(val, depth + 1);

    return out;
  }

  return value;
};

/** How long an exported Insomnia collection reuses a refresh response whose token lifetime is unknown. */
const DEFAULT_TOKEN_MAX_AGE_S = 300;

/** Upper bound for the same, so a token that claims a year of life still gets refreshed hourly. */
const MAX_TOKEN_MAX_AGE_S = 3600;

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
  imports: [NgTemplateOutlet, QueryDevtoolsJsonComponent, QueryDevtoolsToggleComponent],
  host: {
    class: 'et-query-devtools-host',
  },
})
export class QueryDevtoolsComponent {
  private hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = injectRenderer();
  protected document = inject(DOCUMENT);

  private eventIdCounter = 0;
  private lastSelectionKey = '';

  private readonly persisted = readPersistedState();

  protected readonly tabs = [
    { id: 'queries', label: 'Queries' },
    { id: 'stacks', label: 'Stacks' },
    { id: 'sequences', label: 'Sequences' },
    { id: 'auth', label: 'Auth' },
    { id: 'ws', label: 'Sockets' },
    { id: 'cache', label: 'Cache' },
    { id: 'events', label: 'Events' },
  ] satisfies { id: DevtoolsTab; label: string }[];

  protected readonly shortcut = queryDevtoolsShortcutLabel();

  protected open = signal(this.persisted.open ?? false);
  protected panelHeight = signal(this.persisted.height ?? DEFAULT_HEIGHT);
  protected resizing = signal(false);
  protected activeTab = signal<DevtoolsTab>(this.persisted.activeTab ?? 'queries');
  protected selectedClientName = signal<string | null>(this.persisted.selectedClientName ?? null);
  protected selectedQueryId = signal<string | null>(this.persisted.selectedQueryId ?? null);

  // Independent per-drawer selection so the Stacks / Sequences drawers don't share the Queries tab's.
  protected stackSelectedQueryId = signal<string | null>(null);
  protected sequenceSelectedQueryId = signal<string | null>(null);

  protected eventLog = signal<EventLogItem[]>([]);

  /** Keys (`<entryId>:<stepIndex>`) of the sequence steps whose in/out detail is expanded. */
  private expandedSteps = signal<ReadonlySet<string>>(new Set(this.persisted.expandedSteps ?? []));

  /** Shared value-explorer search term. */
  protected jsonSearch = signal(this.persisted.jsonSearch ?? '');
  protected jsonSearchTerm = computed(() => this.jsonSearch().trim().toLowerCase());

  /** Path-keyed value-explorer expansion overrides (persisted so open trees survive a reload). */
  protected jsonExpandedPaths = signal<ReadonlySet<string>>(new Set(this.persisted.jsonExpanded ?? []));
  protected jsonCollapsedPaths = signal<ReadonlySet<string>>(new Set(this.persisted.jsonCollapsed ?? []));

  /** Bound callback passed into the value explorer to persist per-path expansion. Assigned in the constructor. */
  protected toggleJsonPath: (path: string, expand: boolean) => void;

  /** JIT editor state (response / args editing on the selected query). */
  protected editorMode = signal<'none' | 'response' | 'args'>('none');
  protected responseDraft = signal('');
  protected argsDraft = signal('');

  /**
   * The text the currently open editor was seeded with. The textareas bind `value` to this and not to
   * the live draft: a `value` binding fed by the draft is written back on every keystroke, and writing
   * a textarea's `value` puts the caret at the end.
   */
  protected editorSeed = '';
  protected editError = signal<string | null>(null);

  /** Transient "Copied!" feedback for the copy-report, copy-as-Insomnia and copy-document actions. */
  protected copiedReport = signal(false);
  protected copiedInsomnia = signal(false);
  protected copiedGql = signal(false);
  private copiedReset$ = new Subject<void>();

  /** 1-second tick driving the cache freshness countdowns. */
  private clock = toSignal(interval(1000), { initialValue: 0 });

  /** "Inspect" mode: hover the live UI to find the query that a component created. */
  protected inspectActive = signal(false);
  protected inspectHover = signal<{ rect: DOMRect; entries: QueryDevtoolsEntry[] } | null>(null);

  /** When set (via inspect), the Queries list is filtered to exactly these entry ids. */
  protected inspectFilterIds = signal<string[] | null>(this.persisted.inspectFilterIds ?? null);

  private queryEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query'));

  protected stackEntries = computed(() =>
    queryDevtoolsEntries().filter((e) => e.kind === 'query-stack' || e.kind === 'paged-query-stack'),
  );

  protected sequenceEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query-sequence'));

  protected authEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'auth-provider'));

  protected wsEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'ws-client'));

  /** Unique client names present across queries and auth providers, for the Queries-tab picker. */
  protected clientNames = computed(() => {
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

  protected filteredQueries = computed(() => {
    const entries = this.queryEntries();
    const inspectIds = this.inspectFilterIds();

    let filtered: QueryDevtoolsEntry[];
    if (inspectIds) {
      filtered = entries.filter((e) => inspectIds.includes(e.id));
    } else {
      const client = this.selectedClientName();
      filtered = client ? entries.filter((e) => e.meta.clientName === client) : entries;
    }

    return filtered.map((entry) => ({ entry, query: entry.handle as AnyQuery }));
  });

  protected selectedQuery = computed(() => this.findQuery(this.selectedQueryId()));
  protected stackSelectedQuery = computed(() => this.findQuery(this.stackSelectedQueryId()));
  protected sequenceSelectedQuery = computed(() => this.findQuery(this.sequenceSelectedQueryId()));

  protected cacheView = computed(() =>
    this.repositories().map(({ repository, name, baseUrl, client }) => {
      // Read the version signal so this recomputes on every cache mutation.
      repository.subtle.cacheVersion();

      return {
        name,
        baseUrl,
        repository,
        entries: repository.subtle.cacheEntries(),
        pollStates: client?.subtle.sync?.lockManager.keyStates() ?? {},
        client,
      };
    }),
  );

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
          this.copiedGql.set(false);
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
        activeTab: this.activeTab(),
        selectedClientName: this.selectedClientName(),
        selectedQueryId: this.selectedQueryId(),
        inspectFilterIds: this.inspectFilterIds(),
        jsonSearch: this.jsonSearch(),
        expandedSteps: [...this.expandedSteps()],
        jsonExpanded: [...this.jsonExpandedPaths()],
        jsonCollapsed: [...this.jsonCollapsedPaths()],
      };

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

      if (key !== this.lastSelectionKey) {
        this.lastSelectionKey = key;
        this.jsonSearch.set('');
      }
    });

    const doc = this.document;

    // Global toggle shortcut: Ctrl/Cmd + Alt + Q ("Q" for Query) - uncommon, no browser/OS conflict.
    // Matched on `code` (the physical key), not `key`: on macOS, Option rewrites `key` to the layout's
    // alternate glyph (Option+Q is "œ" on a US layout), so a `key === 'q'` test never fires there.
    fromEvent<KeyboardEvent>(doc, 'keydown')
      .pipe(
        filter((e) => (e.ctrlKey || e.metaKey) && e.altKey && (e.code === 'KeyQ' || e.key.toLowerCase() === 'q')),
        tap((e) => {
          e.preventDefault();
          this.open.update((v) => !v);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Drag-to-resize: while a resize is in progress, track pointer movement on the document.
    toObservable(this.resizing)
      .pipe(
        switchMap((active) =>
          active
            ? merge(
                fromEvent<PointerEvent>(doc, 'pointermove').pipe(tap((e) => this.applyResize(e))),
                fromEvent<PointerEvent>(doc, 'pointerup').pipe(tap(() => this.resizing.set(false))),
              )
            : EMPTY,
        ),
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

  protected toggleOpen() {
    this.open.update((v) => !v);
  }

  protected clearEvents() {
    this.eventLog.set([]);
  }

  protected selectClient(name: string | null) {
    this.selectedClientName.set(name);
    this.inspectFilterIds.set(null);
  }

  protected clearInspectFilter() {
    this.inspectFilterIds.set(null);
  }

  protected toggleInspect() {
    this.inspectActive.update((v) => !v);
  }

  protected startResize(event: PointerEvent) {
    event.preventDefault();
    this.resizing.set(true);
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
  protected routeSegments(entry: QueryDevtoolsEntry | undefined, query: AnyQuery): RouteSegment[] {
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
  protected requestUrl(query: AnyQuery) {
    return query.subtle.request()?.url ?? null;
  }

  /**
   * The args of a query. A query executed imperatively (`execute({ args })`, a sequence step, an auth
   * query) never writes them to its own `args` signal - only the `withArgs` feature does - so the args
   * its current request was built from stand in.
   */
  protected queryArgs(query: AnyQuery) {
    return query.args() ?? query.subtle.request()?.args ?? null;
  }

  protected queryStatus(query: AnyQuery): QueryStatus {
    const state = query.executionState();
    if (!state) return 'idle';
    if (state.type === 'loading') return 'loading';
    if (state.type === 'failure') return 'error';
    return 'success';
  }

  protected isStale(query: AnyQuery) {
    try {
      return query.subtle.request()?.isStale() ?? false;
    } catch {
      return false;
    }
  }

  protected queryActivity(entry: QueryDevtoolsEntry): QueryActivity {
    return this.activityOf([entry.stats]);
  }

  protected linkActivity(link: QueryLink): QueryActivity {
    return this.activityOf([link.stats]);
  }

  protected stackActivity(stack: AnyQueryStack | AnyPagedQueryStack): QueryActivity {
    return this.activityOf(this.queriesForStack(stack).map((link) => link.stats));
  }

  protected sequenceActivity(sequence: QuerySequence<unknown[]>): QueryActivity {
    return this.activityOf(this.queriesForSequence(sequence).map((link) => link.stats));
  }

  /** Clears an entry's counters, so the next interaction can be measured on its own. */
  protected resetStats(entry: QueryDevtoolsEntry) {
    entry.stats?.reset();
  }

  /** A byte count the way a network panel spells one out. */
  protected formatBytes(bytes: number) {
    if (bytes < 1000) return `${bytes} B`;
    if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} kB`;

    return `${(bytes / 1_000_000).toFixed(2)} MB`;
  }

  /**
   * A transferred size, marked `≈` when any part of it was measured from a decoded body instead of read
   * from a `content-length` header - such a size ignores transport compression.
   */
  protected formatTransferred(bytes: number, isEstimated: boolean) {
    return `${isEstimated ? '≈' : ''}${this.formatBytes(bytes)}`;
  }

  protected formatDuration(ms: number | null) {
    if (ms === null) return '—';

    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  protected executeQuery(query: AnyQuery, allowCache: boolean) {
    query.execute(allowCache ? { options: { allowCache: true } } : undefined);
  }

  protected resetQuery(query: AnyQuery) {
    query.reset();
  }

  /**
   * Copies a shareable report (path, args, status, slimmed response) for handing to an API dev.
   * Writes both rich `text/html` (Slack applies formatting on paste - it does not parse markdown) and
   * a plain-text fallback.
   */
  protected copyReport(entry: QueryDevtoolsEntry, query: AnyQuery) {
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
  protected copyInsomniaRequest(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const requests = [this.insomniaRequest(entry, query)];
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

  /** Copies the GraphQL document as displayed — dedented, so it pastes straight into a playground. */
  protected copyGqlDocument(doc: string) {
    this.writeToClipboard({ text: this.gqlDocument(doc) }, this.copiedGql);
  }

  /**
   * Downloads every query currently listed (so the client filter and the inspection filter both apply)
   * as one Insomnia collection, filed into a folder per query client.
   */
  protected downloadInsomniaCollection() {
    const items = this.filteredQueries();
    if (!items.length) return;

    const client = this.selectedClientName();
    const requests = items.map(({ entry, query }) => this.insomniaRequest(entry, query));
    const json = JSON.stringify(
      buildInsomniaExport({
        name: `${client ?? 'ethlete'} queries`,
        requests,
        tokenRefreshes: this.insomniaTokenRefreshes(requests),
        now: Date.now(),
      }),
      null,
      2,
    );

    this.downloadFile(`insomnia-${client ?? 'ethlete'}-queries.json`, json);
  }

  // --- JIT editing ---

  protected openResponseEditor(query: AnyQuery) {
    const draft = JSON.stringify(query.response() ?? null, null, 2);

    this.editorSeed = draft;
    this.responseDraft.set(draft);
    this.editError.set(null);
    this.editorMode.set('response');
  }

  protected openArgsEditor(query: AnyQuery) {
    const draft = JSON.stringify(this.queryArgs(query) ?? {}, null, 2);

    this.editorSeed = draft;
    this.argsDraft.set(draft);
    this.editError.set(null);
    this.editorMode.set('args');
  }

  protected applyResponse(query: AnyQuery) {
    try {
      query.subtle.setResponse(JSON.parse(this.responseDraft()));
      this.editorMode.set('none');
      this.editError.set(null);
    } catch {
      this.editError.set('Invalid JSON');
    }
  }

  protected applyArgs(query: AnyQuery) {
    try {
      query.execute({ args: JSON.parse(this.argsDraft()) });
      this.editorMode.set('none');
      this.editError.set(null);
    } catch {
      this.editError.set('Invalid JSON');
    }
  }

  protected cancelEditor() {
    this.editorMode.set('none');
    this.editError.set(null);
  }

  // --- Force states ---

  protected forceLoading(query: AnyQuery) {
    // `executionState` prioritises loading > error > response, so clear the others to switch cleanly.
    query.subtle.setError(null);
    query.subtle.setLoading({ executeTime: Date.now(), progress: null });
  }

  protected forceError(query: AnyQuery) {
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

  protected forceEmpty(query: AnyQuery) {
    query.subtle.setLoading(null);
    query.subtle.setError(null);
    query.subtle.setResponse(null);
  }

  protected clearForced(query: AnyQuery) {
    query.subtle.setLoading(null);
    query.subtle.setError(null);
  }

  // --- Cache actions ---

  protected refetchCacheEntry(entry: QueryRepositoryCacheEntry) {
    entry.request.execute();
  }

  protected evictCacheEntry(repository: QueryRepository, key: string) {
    repository.subtle.evict(key);
  }

  protected cacheFreshness(entry: QueryRepositoryCacheEntry) {
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
  protected cacheSync(entry: QueryRepositoryCacheEntry, pollStates: Record<string, QueryKeyLockState>) {
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
  protected cachePersistence(entry: QueryRepositoryCacheEntry) {
    this.clock();

    const hydratedAt = entry.request.subtle.lastPersistedResponseAt();

    if (hydratedAt === null) return '-';

    return `from disk ${Math.max(0, Math.round((Date.now() - hydratedAt) / 1000))}s ago`;
  }

  /** How many responses this client has on disk, which is usually more than it has in memory. */
  protected persistedCount(client: QueryClient) {
    this.clock();

    return client.subtle.persistence?.indexEntries().length ?? 0;
  }

  protected clearPersistedQueries(client: QueryClient) {
    void client.clearPersistedQueries();
  }

  /** The path + query of a request URL (origin stripped), for readable cache/event identifiers. */
  protected requestPath(url: string) {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  // --- Typed template accessors (entry.handle is `unknown`) ---

  protected asStack(entry: QueryDevtoolsEntry): AnyQueryStack {
    return entry.handle as AnyQueryStack;
  }

  protected asPagedStack(entry: QueryDevtoolsEntry): AnyPagedQueryStack {
    return entry.handle as AnyPagedQueryStack;
  }

  protected asSequence(entry: QueryDevtoolsEntry): QuerySequence<unknown[]> {
    return (entry.handle as { current: QuerySequence<unknown[]> }).current;
  }

  protected asAuth(entry: QueryDevtoolsEntry): AnyBearerAuthProvider {
    return entry.handle as AnyBearerAuthProvider;
  }

  protected asWs(entry: QueryDevtoolsEntry): WebSocketDevtoolsHandle {
    return entry.handle as WebSocketDevtoolsHandle;
  }

  /** Derives the per-step status of a sequence step from its live progress signals. */
  protected sequenceStepStatus(sequence: QuerySequence<unknown[]>, index: number): QuerySequenceStatus {
    const failedAt = sequence.failedAt();
    if (failedAt !== null && index === failedAt) return 'error';

    const current = sequence.currentStep();
    const running = sequence.running();

    if (index < current - 1) return 'success';
    if (index === current - 1 && running) return 'running';
    if (sequence.status() === 'success') return 'success';

    return 'idle';
  }

  protected authTokenPayload(auth: AnyBearerAuthProvider): Record<string, unknown> | null {
    return decodeJwtPayload(auth.accessToken());
  }

  protected queriesForStack(stack: AnyQueryStack | AnyPagedQueryStack): QueryLink[] {
    const inner = stack.queries();
    const queryEntries = this.queryEntries();

    return inner.map((query) => {
      const entry = queryEntries.find((e) => e.handle === query);
      return {
        id: entry?.id ?? '',
        query: query as AnyQuery,
        method: entry?.meta.method ?? '',
        segments: this.routeSegments(entry, query as AnyQuery),
        clientBaseUrl: entry?.meta.clientBaseUrl ?? '',
        stats: entry?.stats,
      };
    });
  }

  /** Identifying info for a stack, derived from its (uniform) inner queries. */
  protected stackIdentity(stack: AnyQueryStack | AnyPagedQueryStack) {
    const first = this.queriesForStack(stack)[0];
    return { method: first?.method ?? '', segments: first?.segments ?? [], baseUrl: first?.clientBaseUrl ?? '' };
  }

  protected authQueryKeys(auth: AnyBearerAuthProvider): string[] {
    return Object.keys(auth.queries ?? {});
  }

  /** Countdown to the access-token's `exp` (the point a refresh becomes due), or `null` if unknown. */
  protected authTokenExpiry(auth: AnyBearerAuthProvider): string | null {
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

  protected queriesForSequence(sequence: QuerySequence<unknown[]>): QueryLink[] {
    const queryEntries = this.queryEntries();

    return sequence.queries.map((query) => {
      const entry = queryEntries.find((e) => e.handle === query);
      return {
        id: entry?.id ?? '',
        query: query as AnyQuery,
        method: entry?.meta.method ?? '',
        segments: this.routeSegments(entry, query as AnyQuery),
        clientBaseUrl: entry?.meta.clientBaseUrl ?? '',
        stats: entry?.stats,
      };
    });
  }

  /** The snapshot of a sequence step, once it has run (holds the args in and the response/error out). */
  protected stepSnapshot(sequence: QuerySequence<unknown[]>, index: number): AnyQuerySnapshot | null {
    return sequence.snapshots()[index] ?? null;
  }

  protected isStepExpanded(entryId: string, index: number) {
    return this.expandedSteps().has(this.stepKey(entryId, index));
  }

  protected toggleStep(entryId: string, index: number) {
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
  protected gqlDocument(doc: string) {
    const lines = doc.replace(/\t/g, '  ').split('\n');
    while (lines.length && !lines[0]?.trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1]?.trim()) lines.pop();
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)?.[0].length ?? 0);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(min)).join('\n');
  }

  protected featureLabel(type: string) {
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
  protected clientFeatures(client: QueryClient | null | undefined) {
    const features = client?.subtle.devtoolsFeatures ?? [];

    return features.length ? features : null;
  }

  protected formatTime(timestamp: number | null) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false });
  }

  protected eventTypeLabel(event: EventLogItem) {
    if (event.type === 'unbind-all-secure') return 'logout';

    return event.type === 'request-error' ? `error ${event.status}` : 'success';
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
  private insomniaRequest(entry: QueryDevtoolsEntry, query: AnyQuery): InsomniaRequestInput {
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

  private downloadFile(fileName: string, content: string) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = this.renderer.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  private stepKey(entryId: string, index: number) {
    return `${entryId}:${index}`;
  }

  private applyResize(event: PointerEvent) {
    // The panel is docked to the bottom, so its height is the distance from the pointer to the viewport bottom.
    const viewport = this.document.documentElement.clientHeight;
    const next = viewport - event.clientY;
    const max = Math.round(viewport * 0.9);
    this.panelHeight.set(Math.min(Math.max(next, MIN_HEIGHT), max));
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
    return `${this.selectedQueryId()}|${this.stackSelectedQueryId()}|${this.sequenceSelectedQueryId()}`;
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

    const base = { id: this.eventIdCounter++, timestamp: Date.now(), client, type: event.type };

    // A logout drops every secure entry at once - worth a row of its own, since the requests that
    // disappear from the cache view are otherwise unexplained.
    const item: EventLogItem =
      event.type === 'unbind-all-secure'
        ? { ...base, method: null, url: null, isSecure: true, status: null }
        : {
            ...base,
            method: event.request.method,
            url: event.request.url,
            isSecure: event.isSecure,
            status: event.type === 'request-error' ? event.error.status : null,
          };

    this.eventLog.update((log) => [item, ...log].slice(0, MAX_EVENTS));
  }
}
