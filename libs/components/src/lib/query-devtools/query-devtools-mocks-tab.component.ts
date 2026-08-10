import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { copyToClipboard } from '@ethlete/core';
import {
  armQueryDevtoolsMock,
  clearQueryDevtoolsArmedMocks,
  deleteQueryDevtoolsMock,
  loadQueryDevtoolsSchema,
  measureQueryDevtoolsPayload,
  QueryDevtoolsEntry,
  QueryDevtoolsMock,
  queryDevtoolsArmedMocks,
  queryDevtoolsMockId,
  queryDevtoolsMocks,
  queryDevtoolsSchemaNames,
  queryDevtoolsSchemaRoutes,
  queryDevtoolsSchemaState,
  QueryDevtoolsSchemaSeed,
  saveQueryDevtoolsMock,
  seedQueryDevtoolsSchemaBody,
  seedQueryDevtoolsSchemaRoute,
} from '@ethlete/query';
import { tap } from 'rxjs';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsMockDesignerComponent } from './query-devtools-mock-designer.component';
import { buildQueryDefinitionSnippet } from './query-devtools-typescript';
import { AnyQuery } from './query-devtools-types';

/** A designed mock as the list renders it: the stored mock plus what only the live registry knows. */
type MockRow = {
  mock: QueryDevtoolsMock;
  armed: boolean;

  /** Serialized size of the body, so a library that is about to hit a quota reads as one. */
  bytes: number;

  /**
   * Whether a live query on this route authenticates. A mock replaces the request, so the interceptor
   * chain never runs and the token flow is not exercised - which has to be visible on the row.
   */
  isSecure: boolean;
};

/** A live query whose last response can be captured as the seed of a mock. */
type CaptureRow = {
  entry: QueryDevtoolsEntry;
  clientName: string;
  method: string;
  pattern: string;
  bytes: number;

  /** Whether the library already holds a mock for this route, so the button says `Re-capture`. */
  exists: boolean;

  /** How many other live queries share this route, since a mock answers the route rather than a query. */
  shared: number;
};

/** The new-mock form's fields, as text - a body is JSON only once it parses. */
type MockDraft = {
  clientName: string;
  method: string;
  pattern: string;
  query: string;
  status: string;
  latencyMs: string;
  body: string;
};

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const EMPTY_DRAFT: MockDraft = {
  clientName: '',
  method: 'GET',
  pattern: '',
  query: '',
  status: '200',
  latencyMs: '0',
  body: '{}',
};

/**
 * A mock matches on method + path, and every GraphQL query POSTs the same route - so one armed for a
 * `GQL QUERY` would either match nothing or answer every operation on the endpoint. Matching a document
 * is its own feature; until then GraphQL queries are left out of the capture list rather than offered as
 * something that silently does not fire.
 */
const isMockableMethod = (method: string) => !method.includes(' ');

/**
 * The Mocks tab: responses served in place of a request, either designed by hand for a route nothing has
 * ever called or captured from one that has. The library is persisted; whether a mock is armed is not, so
 * a reload always stops serving them.
 */
@Component({
  selector: 'et-query-devtools-mocks-tab',
  templateUrl: './query-devtools-mocks-tab.component.html',
  styleUrl: './query-devtools-mocks-tab.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsMockDesignerComponent],
})
export class QueryDevtoolsMocksTabComponent {
  protected host = injectQueryDevtoolsHost();

  protected readonly DISARM_ALL = clearQueryDevtoolsArmedMocks;
  protected readonly METHODS = METHODS;

  protected readonly SCHEMA_NAMES = queryDevtoolsSchemaNames;
  protected readonly SCHEMA_ROUTES = queryDevtoolsSchemaRoutes;

  /** Whether the application handed an API description in at all - nothing below shows without one. */
  protected hasSchema = computed(() => queryDevtoolsSchemaState().status !== 'unavailable');
  protected isSchemaReady = computed(() => queryDevtoolsSchemaState().status === 'ready');

  protected schemaError = computed(() => {
    const state = queryDevtoolsSchemaState();

    return state.status === 'error' ? state.message : null;
  });

  /** The new-mock form, or `null` while it is closed. */
  protected draft = signal<MockDraft | null>(null);
  protected draftError = signal<string | null>(null);

  /** What the description said about the draft's body, kept so the designer can label its fields. */
  protected draftSeed = signal<QueryDevtoolsSchemaSeed | null>(null);

  /** The named schema picked in the form, which is not the same thing as the one a body came from. */
  protected pickedSchema = signal('');

  /**
   * The type annotations of each seeded body, by mock id. A mock only stores the *name* it was seeded
   * from, so this is what labels a body the description could not name - for as long as the panel is open.
   */
  private seededTypes = signal<Record<string, ReadonlyMap<string, string>>>({});

  /** The mock whose body is open in the designer. */
  protected editingId = signal<string | null>(null);

  /** The mock whose definition was last copied, so the button can confirm it. */
  protected copiedId = signal<string | null>(null);

  protected rows = computed<MockRow[]>(() => {
    const armed = queryDevtoolsArmedMocks();
    const entries = this.host.queryEntries();

    return queryDevtoolsMocks().map((mock) => ({
      mock,
      armed: armed.has(mock.id),
      bytes: measureQueryDevtoolsPayload({ body: mock.body }).bytes,
      isSecure: entries.some((entry) => !!entry.meta.isSecure && this.idOf(entry) === mock.id),
    }));
  });

  protected armedCount = computed(() => this.rows().filter((row) => row.armed).length);

  private editingRow = computed(() => this.rows().find((row) => row.mock.id === this.editingId()) ?? null);

  /**
   * What to label the open body's fields with: the seed it was authored from this session, or - after a
   * reload - the schema the mock remembers being seeded from.
   */
  protected editingAnnotations = computed(() => {
    const row = this.editingRow();

    if (!row) return null;

    const seeded = this.seededTypes()[row.mock.id];

    if (seeded) return seeded;

    const name = row.mock.schemaName;

    return name ? (seedQueryDevtoolsSchemaBody(name)?.types ?? null) : null;
  });

  /**
   * Every route a live response can seed a mock from - one row per route, not per query: several queries
   * on the same route would all capture into the same mock, so listing each of them offers the same
   * button three times.
   */
  protected captureRows = computed<CaptureRow[]>(() => {
    const known = new Set(queryDevtoolsMocks().map((mock) => mock.id));
    const rows = new Map<string, CaptureRow>();

    for (const entry of this.host.queryEntries()) {
      if (entry.destroyedAt || !entry.meta.route) continue;
      if (!isMockableMethod(entry.meta.method ?? 'GET')) continue;
      if ((entry.handle as AnyQuery).response() === null) continue;

      const id = this.idOf(entry);
      const existing = rows.get(id);

      if (existing) {
        existing.shared++;

        continue;
      }

      rows.set(id, {
        entry,
        clientName: entry.meta.clientName ?? '',
        method: entry.meta.method ?? 'GET',
        pattern: entry.meta.route ?? '',
        bytes: measureQueryDevtoolsPayload({ body: (entry.handle as AnyQuery).response() }).bytes,
        exists: known.has(id),
        shared: 1,
      });
    }

    return [...rows.values()];
  });

  constructor() {
    // The description is only worth fetching once someone is designing a mock, which is what opening
    // this tab means - so an application that hands one in still ships it as its own lazy chunk.
    loadQueryDevtoolsSchema();
  }

  protected openDraft() {
    this.draftError.set(null);
    this.draftSeed.set(null);
    this.draft.set({ ...EMPTY_DRAFT, clientName: this.host.clientNames()[0] ?? '' });
  }

  protected closeDraft() {
    this.draft.set(null);
    this.draftError.set(null);
    this.draftSeed.set(null);
  }

  protected patchDraft(patch: Partial<MockDraft>) {
    this.draft.update((current) => (current ? { ...current, ...patch } : current));
  }

  /** Fills the form from a route the description declares, whether or not the app has ever called it. */
  protected pickRoute(value: string) {
    const [method, pattern] = value.split(' ');

    if (!method || !pattern) return;

    this.patchDraft({ method, pattern });
    this.seedFromRoute({ method, pattern });
  }

  /** Seeds the body from the description's success response for the route the form names. */
  protected seedFromDraftRoute() {
    const draft = this.draft();

    if (draft) this.seedFromRoute({ method: draft.method, pattern: draft.pattern.trim() });
  }

  /** Seeds the body from one named schema, so a route the description does not declare still starts real. */
  protected seedFromSchema() {
    const name = this.pickedSchema();

    if (!name) return;

    this.applySeed(seedQueryDevtoolsSchemaBody(name), `The description does not name ${name}.`);
  }

  /**
   * Saves the form as a designed mock and opens the designer on it. Nothing is checked against the
   * registry - a route no query has ever called is the point - only that the path is a path and the body
   * is JSON.
   */
  protected saveDraft() {
    const draft = this.draft();

    if (!draft) return;

    const pattern = draft.pattern.trim();

    if (!pattern.startsWith('/')) {
      this.draftError.set('The path has to start with a "/" — it is matched against the request path.');

      return;
    }

    let body: unknown;

    try {
      body = JSON.parse(draft.body || 'null');
    } catch (error) {
      this.draftError.set(error instanceof Error ? error.message : String(error));

      return;
    }

    const identity = {
      clientName: draft.clientName,
      method: draft.method,
      pattern,
      query: draft.query.trim().replace(/^\?/, ''),
    };

    const id = queryDevtoolsMockId(identity);
    const seed = this.draftSeed();

    saveQueryDevtoolsMock({
      ...identity,
      id,
      status: this.countOf(draft.status, 200),
      latencyMs: this.countOf(draft.latencyMs, 0),
      body,
      capturedAt: null,
      schemaName: seed?.schemaName ?? null,
    });

    if (seed) this.seededTypes.update((current) => ({ ...current, [id]: seed.types }));

    this.closeDraft();
    this.editingId.set(id);
  }

  /** Captures the query's current response as a designed mock, replacing an earlier capture of the route. */
  protected capture(row: CaptureRow) {
    saveQueryDevtoolsMock({
      id: this.idOf(row.entry),
      clientName: row.clientName,
      method: row.method,
      pattern: row.pattern,
      query: '',
      status: 200,
      body: (row.entry.handle as AnyQuery).response(),
      latencyMs: 0,
      capturedAt: Date.now(),
    });
  }

  protected toggleArmed(row: MockRow) {
    armQueryDevtoolsMock(row.mock.id, !row.armed);
  }

  protected remove(row: MockRow) {
    deleteQueryDevtoolsMock(row.mock.id);
  }

  protected setStatus(row: MockRow, value: string) {
    saveQueryDevtoolsMock({ ...row.mock, status: this.countOf(value, row.mock.status) });
  }

  protected setLatency(row: MockRow, value: string) {
    saveQueryDevtoolsMock({ ...row.mock, latencyMs: this.countOf(value, row.mock.latencyMs) });
  }

  /**
   * Copies the route as a `@ethlete/query` definition - the response type inferred from the designed body,
   * the args contract and the creator call - so a mocked route can be pasted into the app it was designed
   * for.
   */
  protected copyDefinition(row: MockRow) {
    const snippet = buildQueryDefinitionSnippet({
      method: row.mock.method,
      pattern: row.mock.pattern,
      query: row.mock.query,
      body: row.mock.body,
    });

    copyToClipboard(snippet)
      .pipe(tap((ok) => this.copiedId.set(ok ? row.mock.id : null)))
      .subscribe();
  }

  protected editBody(row: MockRow) {
    this.editingId.set(row.mock.id);
  }

  protected cancelBody() {
    this.editingId.set(null);
  }

  protected saveBody(row: MockRow, body: unknown) {
    saveQueryDevtoolsMock({ ...row.mock, body });
    this.cancelBody();
  }

  private seedFromRoute(target: { method: string; pattern: string }) {
    if (!target.pattern) {
      this.draftError.set('Name the path first - the seed comes from what the description says it returns.');

      return;
    }

    this.applySeed(
      seedQueryDevtoolsSchemaRoute(target),
      `The description declares no JSON response for ${target.method} ${target.pattern}.`,
    );
  }

  private applySeed(seed: QueryDevtoolsSchemaSeed | null, missing: string) {
    if (!seed) {
      this.draftSeed.set(null);
      this.draftError.set(missing);

      return;
    }

    this.draftSeed.set(seed);
    this.draftError.set(null);
    this.patchDraft({ body: JSON.stringify(seed.body, null, 2) });
  }

  private countOf(value: string, fallback: number) {
    const count = Math.trunc(Number(value));

    return Number.isFinite(count) ? count : fallback;
  }

  private idOf(entry: QueryDevtoolsEntry) {
    return queryDevtoolsMockId({
      clientName: entry.meta.clientName ?? '',
      method: entry.meta.method ?? 'GET',
      pattern: entry.meta.route ?? '',
    });
  }
}
