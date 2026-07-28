import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQuerySnapshot,
  AnyQueryStack,
  createQueryErrorResponse,
  Query,
  queryDevtoolsEntries,
  QueryDevtoolsEntry,
  QueryRepository,
  QueryRepositoryCacheEntry,
  QueryRepositoryEvent,
  QuerySequence,
  QuerySequenceStatus,
  WebSocketDevtoolsHandle,
} from '@ethlete/query';
import { EMPTY, filter, fromEvent, interval, map, merge, switchMap, tap } from 'rxjs';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';
import { QueryDevtoolsToggleComponent } from './query-devtools-toggle.component';

// The registry stores queries type-erased; the panel reads them structurally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = Query<any>;

type DevtoolsTab = 'queries' | 'stacks' | 'sequences' | 'auth' | 'ws' | 'cache' | 'events';

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

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
 * Requires `provideQueryDevtools()` in the application providers — without it the registry stays
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
  protected editError = signal<string | null>(null);

  /** Transient "Copied!" feedback for the copy-report action. */
  protected copiedReport = signal(false);

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
    const map = new Map<QueryRepository, { name: string; baseUrl: string }>();
    for (const entry of queryDevtoolsEntries()) {
      const repo = entry.meta.repository;
      if (repo && !map.has(repo)) {
        map.set(repo, { name: entry.meta.clientName ?? 'unknown', baseUrl: entry.meta.clientBaseUrl ?? '' });
      }
    }
    return Array.from(map, ([repository, info]) => ({ repository, name: info.name, baseUrl: info.baseUrl }));
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
    this.repositories().map(({ repository, name, baseUrl }) => {
      // Read the version signal so this recomputes on every cache mutation.
      repository.subtle.cacheVersion();
      return { name, baseUrl, repository, entries: repository.subtle.cacheEntries() };
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

      if (key !== this.lastSelectionKey) {
        this.lastSelectionKey = key;
        this.jsonSearch.set('');
      }
    });

    const doc = this.document;

    // Global toggle shortcut: Ctrl/Cmd + Alt + Q ("Q" for Query) — uncommon, no browser/OS conflict.
    fromEvent<KeyboardEvent>(doc, 'keydown')
      .pipe(
        filter((e) => (e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'q'),
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
    if (entries.length === 1 && first) return `${first.meta.method ?? ''} ${first.meta.route ?? ''}`.trim();
    return `${entries.length} queries`;
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

  protected executeQuery(query: AnyQuery, allowCache: boolean) {
    query.execute(allowCache ? { options: { allowCache: true } } : undefined);
  }

  protected resetQuery(query: AnyQuery) {
    query.reset();
  }

  /**
   * Copies a shareable report (path, args, status, slimmed response) for handing to an API dev.
   * Writes both rich `text/html` (Slack applies formatting on paste — it does not parse markdown) and
   * a plain-text fallback.
   */
  protected copyReport(entry: QueryDevtoolsEntry, query: AnyQuery) {
    const error = query.error();
    const httpStatus = error ? error.raw.status : this.responseStatus(query);
    const method = entry.meta.method ?? '';
    const route = entry.meta.route || '—';
    const client = entry.meta.clientBaseUrl ?? entry.meta.clientName ?? '';
    const statusLine = `status: ${this.queryStatus(query)}${httpStatus !== null ? ` (${httpStatus})` : ''} · ${this.formatTime(query.lastTimeExecutedAt())}`;
    const gqlDoc = entry.meta.gqlQuery ? this.gqlDocument(entry.meta.gqlQuery) : null;
    const args = query.args();
    const argsLabel = gqlDoc ? 'Variables' : 'Args';
    const argsJson = args !== null && args !== undefined ? JSON.stringify(args, null, 2) : null;
    const bodyLabel = error ? `Error (${error.raw.status})` : 'Response';
    const bodyContent = error
      ? error.isList
        ? error.errors.map((e) => e.message).join('\n')
        : error.error.message
      : JSON.stringify(slimForReport(query.response()), null, 2);

    const textParts = [`${method} ${route}${client ? ` — ${client}` : ''}`, statusLine];
    if (gqlDoc) textParts.push('', 'GraphQL document', gqlDoc);
    if (argsJson) textParts.push('', argsLabel, argsJson);
    textParts.push('', bodyLabel, bodyContent);
    const text = textParts.join('\n');

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const htmlParts = [
      `<b>${esc(method)}</b> <code>${esc(route)}</code>${client ? ` — <code>${esc(client)}</code>` : ''}`,
      esc(statusLine),
    ];
    if (gqlDoc) htmlParts.push('<b>GraphQL document</b>', `<pre><code>${esc(gqlDoc)}</code></pre>`);
    if (argsJson) htmlParts.push(`<b>${argsLabel}</b>`, `<pre><code>${esc(argsJson)}</code></pre>`);
    htmlParts.push(`<b>${esc(bodyLabel)}</b>`, `<pre><code>${esc(bodyContent)}</code></pre>`);
    const html = htmlParts.join('<br>');

    this.writeToClipboard(html, text);
  }

  // --- JIT editing ---

  protected openResponseEditor(query: AnyQuery) {
    this.responseDraft.set(JSON.stringify(query.response() ?? null, null, 2));
    this.editError.set(null);
    this.editorMode.set('response');
  }

  protected openArgsEditor(query: AnyQuery) {
    this.argsDraft.set(JSON.stringify(query.args() ?? {}, null, 2));
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

  protected queriesForStack(
    stack: AnyQueryStack | AnyPagedQueryStack,
  ): { id: string; query: AnyQuery; method: string; route: string; clientName: string; clientBaseUrl: string }[] {
    const inner = stack.queries();
    const queryEntries = this.queryEntries();

    return inner.map((query) => {
      const entry = queryEntries.find((e) => e.handle === query);
      return {
        id: entry?.id ?? '',
        query: query as AnyQuery,
        method: entry?.meta.method ?? '',
        route: entry?.meta.route ?? '',
        clientName: entry?.meta.clientName ?? '',
        clientBaseUrl: entry?.meta.clientBaseUrl ?? '',
      };
    });
  }

  /** Identifying info for a stack, derived from its (uniform) inner queries. */
  protected stackIdentity(stack: AnyQueryStack | AnyPagedQueryStack) {
    const first = this.queriesForStack(stack)[0];
    return { method: first?.method ?? '', route: first?.route ?? '', baseUrl: first?.clientBaseUrl ?? '' };
  }

  protected authFeatures(auth: AnyBearerAuthProvider): string[] {
    return Object.keys(auth.features ?? {});
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

  protected queriesForSequence(
    sequence: QuerySequence<unknown[]>,
  ): { id: string; query: AnyQuery; method: string; route: string }[] {
    const queryEntries = this.queryEntries();

    return sequence.queries.map((query) => {
      const entry = queryEntries.find((e) => e.handle === query);
      return {
        id: entry?.id ?? '',
        query: query as AnyQuery,
        method: entry?.meta.method ?? '',
        route: entry?.meta.route ?? '',
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

  protected formatTime(timestamp: number | null) {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false });
  }

  protected eventTypeLabel(event: EventLogItem) {
    if (event.type === 'unbind-all-secure') return 'logout';

    return event.type === 'request-error' ? `error ${event.status}` : 'success';
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

  private writeToClipboard(html: string, text: string) {
    const clipboard = navigator.clipboard;
    if (!clipboard) return;

    // Prefer rich HTML (Slack keeps the formatting on paste); fall back to plain text.
    if ('write' in clipboard && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      clipboard
        .write([item])
        .then(() => this.copiedReport.set(true))
        .catch(() =>
          clipboard
            .writeText(text)
            .then(() => this.copiedReport.set(true))
            .catch(() => undefined),
        );

      return;
    }

    clipboard
      .writeText(text)
      .then(() => this.copiedReport.set(true))
      .catch(() => undefined);
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
    const base = { id: this.eventIdCounter++, timestamp: Date.now(), client, type: event.type };

    // A logout drops every secure entry at once — worth a row of its own, since the requests that
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
