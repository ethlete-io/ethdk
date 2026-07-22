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
} from '@ethlete/query';
import { EMPTY, fromEvent, interval, map, merge, switchMap, tap } from 'rxjs';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

// The registry stores queries type-erased; the panel reads them structurally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = Query<any>;

type DevtoolsTab = 'queries' | 'stacks' | 'sequences' | 'auth' | 'cache' | 'events';

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

type EventLogItem = {
  id: number;
  timestamp: number;
  clientName: string;
  type: QueryRepositoryEvent['type'];
  key: string;
  isSecure: boolean;
  status: number | null;
};

type PersistedState = {
  open?: boolean;
  activeTab?: DevtoolsTab;
  selectedClientName?: string | null;
};

const STORAGE_KEY = 'ethlete:query:devtools:v3';
const MAX_EVENTS = 100;

const readPersistedState = (): PersistedState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
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
  imports: [NgTemplateOutlet, QueryDevtoolsJsonComponent],
  host: {
    class: 'et-query-devtools-host',
  },
})
export class QueryDevtoolsComponent {
  private hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);

  private eventIdCounter = 0;

  private readonly persisted = readPersistedState();

  protected readonly tabs = [
    { id: 'queries', label: 'Queries' },
    { id: 'stacks', label: 'Stacks' },
    { id: 'sequences', label: 'Sequences' },
    { id: 'auth', label: 'Auth' },
    { id: 'cache', label: 'Cache' },
    { id: 'events', label: 'Events' },
  ] satisfies { id: DevtoolsTab; label: string }[];

  protected open = signal(this.persisted.open ?? false);
  protected activeTab = signal<DevtoolsTab>(this.persisted.activeTab ?? 'queries');
  protected selectedClientName = signal<string | null>(this.persisted.selectedClientName ?? null);
  protected selectedQueryId = signal<string | null>(null);

  protected eventLog = signal<EventLogItem[]>([]);

  /** Keys (`<entryId>:<stepIndex>`) of the sequence steps whose in/out detail is expanded. */
  private expandedSteps = signal<ReadonlySet<string>>(new Set());

  /** Shared value-explorer search term. */
  protected jsonSearch = signal('');
  protected jsonSearchTerm = computed(() => this.jsonSearch().trim().toLowerCase());

  /** JIT editor state (response / args editing on the selected query). */
  protected editorMode = signal<'none' | 'response' | 'args'>('none');
  protected responseDraft = signal('');
  protected argsDraft = signal('');
  protected editError = signal<string | null>(null);

  /** 1-second tick driving the cache freshness countdowns. */
  private clock = toSignal(interval(1000), { initialValue: 0 });

  /** "Inspect" mode: hover the live UI to find the query that a component created. */
  protected inspectActive = signal(false);
  protected inspectHover = signal<{ rect: DOMRect; entries: QueryDevtoolsEntry[] } | null>(null);

  private queryEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query'));

  protected stackEntries = computed(() =>
    queryDevtoolsEntries().filter((e) => e.kind === 'query-stack' || e.kind === 'paged-query-stack'),
  );

  protected sequenceEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'query-sequence'));

  protected authEntries = computed(() => queryDevtoolsEntries().filter((e) => e.kind === 'auth-provider'));

  /** Unique client names present across queries and auth providers, for the Queries-tab picker. */
  protected clientNames = computed(() => {
    const names = new Set<string>();
    for (const entry of queryDevtoolsEntries()) {
      if (entry.meta.clientName) names.add(entry.meta.clientName);
    }
    return Array.from(names).sort();
  });

  /** Unique repositories (with their client name) used by the Cache and Events tabs. */
  private repositories = computed(() => {
    const map = new Map<QueryRepository, string>();
    for (const entry of queryDevtoolsEntries()) {
      const repo = entry.meta.repository;
      if (repo && !map.has(repo)) {
        map.set(repo, entry.meta.clientName ?? 'unknown');
      }
    }
    return Array.from(map, ([repository, name]) => ({ repository, name }));
  });

  protected filteredQueries = computed(() => {
    const client = this.selectedClientName();
    const entries = this.queryEntries();
    const filtered = client ? entries.filter((e) => e.meta.clientName === client) : entries;
    return filtered.map((entry) => ({ entry, query: entry.handle as AnyQuery }));
  });

  protected selectedQuery = computed(() => {
    const id = this.selectedQueryId();
    if (!id) return null;
    const entry = this.queryEntries().find((e) => e.id === id);
    return entry ? { entry, query: entry.handle as AnyQuery } : null;
  });

  protected cacheView = computed(() =>
    this.repositories().map(({ repository, name }) => {
      // Read the version signal so this recomputes on every cache mutation.
      repository.subtle.cacheVersion();
      return { name, repository, entries: repository.subtle.cacheEntries() };
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
    // Merge every live repository's event stream into the rolling log, re-subscribing as the set of
    // repositories changes. Composed with RxJS (not a subscribe-in-effect) per the styleguide.
    toObservable(this.repositories)
      .pipe(
        switchMap((repos) =>
          merge(...repos.map(({ repository, name }) => repository.events$.pipe(map((event) => ({ event, name }))))),
        ),
        tap(({ event, name }) => this.pushEvent(event, name)),
        takeUntilDestroyed(),
      )
      .subscribe();

    effect(() => {
      const state: PersistedState = {
        open: this.open(),
        activeTab: this.activeTab(),
        selectedClientName: this.selectedClientName(),
      };

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore (private mode / disabled storage)
      }
    });

    // Close any open JIT editor when the inspected query changes.
    effect(() => {
      this.selectedQueryId();
      this.editorMode.set('none');
      this.editError.set(null);
    });

    // Inspect mode: while active, listen on the document to map the hovered element to a query.
    const doc = this.document;
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

  protected toggleInspect() {
    this.inspectActive.update((v) => !v);
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
    const expiresAt = entry.request.expiresAt();
    if (expiresAt === null) return 'uncacheable';
    const ms = expiresAt - Date.now();
    return ms <= 0 ? 'stale' : `${Math.ceil(ms / 1000)}s`;
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
  ): { id: string; query: AnyQuery; method: string; route: string }[] {
    const inner = stack.queries();
    const queryEntries = this.queryEntries();

    return inner.map((query) => {
      const entry = queryEntries.find((e) => e.handle === query);
      return {
        id: entry?.id ?? '',
        query: query as AnyQuery,
        method: entry?.meta.method ?? '',
        route: entry?.meta.route ?? '',
      };
    });
  }

  /**
   * Opens the detail for a linked query in a split-view drawer of the current tab, so the stack /
   * sequence context is not lost by jumping to the Queries tab.
   */
  protected inspectQuery(id: string) {
    if (!id) return;
    this.selectedQueryId.set(id);
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

  protected range(length: number): number[] {
    return Array.from({ length }, (_, i) => i);
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

  private stepKey(entryId: string, index: number) {
    return `${entryId}:${index}`;
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

    if (!first) return;

    event.preventDefault();
    event.stopPropagation();

    this.open.set(true);
    this.activeTab.set('queries');
    this.selectedClientName.set(null);
    this.selectedQueryId.set(first.id);
    this.inspectActive.set(false);
  }

  private pushEvent(event: QueryRepositoryEvent, clientName: string) {
    const item: EventLogItem = {
      id: this.eventIdCounter++,
      timestamp: Date.now(),
      clientName,
      type: event.type,
      key: event.key,
      isSecure: event.isSecure,
      status: event.type === 'request-error' ? event.error.status : null,
    };

    this.eventLog.update((log) => [item, ...log].slice(0, MAX_EVENTS));
  }
}
