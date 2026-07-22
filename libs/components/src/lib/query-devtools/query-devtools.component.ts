import { JsonPipe } from '@angular/common';
import { Component, computed, effect, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  AnyBearerAuthProvider,
  AnyPagedQueryStack,
  AnyQueryStack,
  Query,
  queryDevtoolsEntries,
  QueryDevtoolsEntry,
  QueryRepository,
  QueryRepositoryEvent,
  QuerySequence,
  QuerySequenceStatus,
} from '@ethlete/query';
import { map, merge, switchMap, tap } from 'rxjs';

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
    const raw = localStorage.getItem(STORAGE_KEY);
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
  imports: [JsonPipe],
  host: {
    class: 'et-query-devtools-host',
  },
})
export class QueryDevtoolsComponent {
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
      return { name, entries: repository.subtle.cacheEntries() };
    }),
  );

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore (private mode / disabled storage)
      }
    });
  }

  protected toggleOpen() {
    this.open.update((v) => !v);
  }

  protected clearEvents() {
    this.eventLog.set([]);
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

  protected queriesForStack(stack: AnyQueryStack | AnyPagedQueryStack): { id: string; query: AnyQuery }[] {
    const inner = stack.queries();
    const queryEntries = this.queryEntries();

    return inner.map((query) => {
      const entry = queryEntries.find((e) => e.handle === query);
      return { id: entry?.id ?? '', query: query as AnyQuery };
    });
  }

  /** Jumps to the Queries tab and opens the detail view for the given (linked) query id. */
  protected openQueryDetail(id: string) {
    if (!id) return;
    this.activeTab.set('queries');
    this.selectedClientName.set(null);
    this.selectedQueryId.set(id);
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
