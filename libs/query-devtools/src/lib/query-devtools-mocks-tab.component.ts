import { Component, computed, effect, signal, ViewEncapsulation, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SelectComponent, SelectOptionData, SelectSearchDirective } from '@ethlete/components';
import { copyToClipboard } from '@ethlete/core';
import {
  armAllQueryDevtoolsMocks,
  armQueryDevtoolsMock,
  clearQueryDevtoolsArmedMocks,
  collectQueryDevtoolsSchemaComponents,
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
  QueryDevtoolsSeedStyle,
  saveQueryDevtoolsMock,
  seedQueryDevtoolsSchemaBody,
  seedQueryDevtoolsSchemaRoute,
} from '@ethlete/query';
import { Subject, switchMap, tap, timer } from 'rxjs';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsMockDesignerComponent } from './query-devtools-mock-designer.component';
import { buildQueryDevtoolsOpenApiDocument, buildQueryDevtoolsOpenApiPathItem } from './query-devtools-openapi';
import { buildQueryDefinitionSnippet } from './query-devtools-typescript';
import { AnyQuery, QUERY_DEVTOOLS_COPIED_RESET_MS } from './query-devtools-types';
import { toQueryDevtoolsYaml } from './query-devtools-yaml';

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

/** What a seeded body was generated from, so changing the style can re-roll it without asking again. */
type SeedSource = { kind: 'route'; method: string; pattern: string } | { kind: 'schema'; name: string };

const SEED_STYLES: { value: QueryDevtoolsSeedStyle; label: string; hint: string }[] = [
  {
    value: 'placeholder',
    label: 'Placeholder values',
    hint: 'Every field named after itself - a body nobody mistakes for real data.',
  },
  {
    value: 'realistic',
    label: 'Realistic values',
    hint: 'Varied sample values, and array elements generated one by one - a list of three different rows.',
  },
  {
    value: 'stress',
    label: 'Stress values',
    hint: 'Long text, unbreakable words, unicode and huge numbers - what a layout breaks on. Declared formats, enums and bounds are still honoured.',
  },
];

/** Which spelling of the exported document is written - the same tree either way. */
type SpecFormat = 'yaml' | 'json';

const SPEC_FORMATS: { value: SpecFormat; label: string }[] = [
  { value: 'yaml', label: 'YAML' },
  { value: 'json', label: 'JSON' },
];

const SPEC_MEDIA_TYPES: Record<SpecFormat, string> = {
  yaml: 'application/yaml',
  json: 'application/json',
};

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
  imports: [QueryDevtoolsMockDesignerComponent, SelectComponent, SelectSearchDirective],
})
export class QueryDevtoolsMocksTabComponent {
  protected host = injectQueryDevtoolsHost();

  protected readonly ARM_ALL = armAllQueryDevtoolsMocks;
  protected readonly DISARM_ALL = clearQueryDevtoolsArmedMocks;
  protected readonly METHODS = METHODS;
  protected readonly SPEC_FORMATS = SPEC_FORMATS;
  protected readonly SEED_STYLES = SEED_STYLES;

  /** The new-mock form, or `null` while it is closed. */
  protected draft = signal<MockDraft | null>(null);

  /** Which client the form is designing for - every description below is that client's, not the app's. */
  private draftClient = computed(() => this.draft()?.clientName ?? '');

  private schemaNames = computed(() => queryDevtoolsSchemaNames(this.draftClient()));
  private schemaRoutes = computed(() => queryDevtoolsSchemaRoutes(this.draftClient()));

  /**
   * A description declares hundreds of routes and named types, so both pickers are handed their options
   * as data: the select then windows the rows and filters the full set from its own search box.
   */
  protected routeOptions = computed<SelectOptionData[]>(() =>
    this.schemaRoutes().map((route) => {
      const target = `${route.method} ${route.pattern}`;

      return { value: target, label: route.summary ? `${target} — ${route.summary}` : target };
    }),
  );

  protected schemaNameOptions = computed<SelectOptionData[]>(() =>
    this.schemaNames().map((name) => ({ value: name, label: name })),
  );

  private schemaState = computed(() => queryDevtoolsSchemaState(this.draftClient()));

  /** Whether the application handed this client's API description in - nothing below shows without one. */
  protected hasSchema = computed(() => this.schemaState().status !== 'unavailable');
  protected isSchemaReady = computed(() => this.schemaState().status === 'ready');

  protected schemaError = computed(() => {
    const state = this.schemaState();

    return state.status === 'error' ? state.message : null;
  });

  protected draftError = signal<string | null>(null);

  /** What the description said about the draft's body, kept so the designer can label its fields. */
  protected draftSeed = signal<QueryDevtoolsSchemaSeed | null>(null);

  /** How lifelike the next seed comes out. The shape is the description's either way. */
  protected seedStyle = signal<QueryDevtoolsSeedStyle>('placeholder');

  private seedSource = signal<SeedSource | null>(null);

  protected seedStyleHint = computed(() => SEED_STYLES.find((style) => style.value === this.seedStyle())?.hint ?? '');

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

  /** The mock whose path item was last copied - a second button needs its own confirmation. */
  protected copiedSpecId = signal<string | null>(null);

  private copiedReset$ = new Subject<void>();

  /** Which spelling the OpenAPI export is written in. YAML is what a specification repository takes. */
  protected specFormat = signal<SpecFormat>('yaml');

  /** What the last export had to guess or could not resolve, shown under the library it came from. */
  protected specNotes = signal<readonly string[]>([]);

  protected rows = computed<MockRow[]>(() => {
    const armed = queryDevtoolsArmedMocks();
    const entries = this.host.queryEntries();

    return queryDevtoolsMocks().map((mock) => ({
      mock,
      armed: armed.has(mock.id),
      bytes: measureQueryDevtoolsPayload({ body: mock.body }).bytes,
      isSecure: entries.some((entry) => !!entry.meta.isSecure && this.idOf(entry, mock.query) === mock.id),
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

    return name ? (seedQueryDevtoolsSchemaBody(row.mock.clientName, name)?.types ?? null) : null;
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
    // Each copy restarts the tick countdown; switchMap drops the pending reset of the previous one.
    this.copiedReset$
      .pipe(
        switchMap(() => timer(QUERY_DEVTOOLS_COPIED_RESET_MS)),
        tap(() => {
          this.copiedId.set(null);
          this.copiedSpecId.set(null);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    // A description is only worth fetching once someone is designing a mock against that client, so an
    // application that hands several in still ships each as its own lazy chunk, loaded one at a time.
    effect(() => {
      const client = this.draftClient() || this.editingRow()?.mock.clientName;

      if (client) loadQueryDevtoolsSchema(client);
    });
  }

  protected openDraft() {
    this.draftError.set(null);
    this.draftSeed.set(null);
    this.seedSource.set(null);
    this.draft.set({ ...EMPTY_DRAFT, clientName: this.host.clientNames()[0] ?? '' });
  }

  protected closeDraft() {
    this.draft.set(null);
    this.draftError.set(null);
    this.draftSeed.set(null);
    this.seedSource.set(null);
  }

  protected patchDraft(patch: Partial<MockDraft>) {
    this.draft.update((current) => (current ? { ...current, ...patch } : current));
  }

  /** Switches which API the form is designing against, dropping what the previous one's seed named. */
  protected pickClient(clientName: string) {
    this.patchDraft({ clientName });
    this.pickedSchema.set('');
    this.seedSource.set(null);
    this.draftSeed.set(null);
    this.draftError.set(null);
  }

  /** Fills the form from a route the description declares, whether or not the app has ever called it. */
  protected pickRoute(value: unknown) {
    const [method, pattern] = typeof value === 'string' ? value.split(' ') : [];

    if (!method || !pattern) return;

    this.patchDraft({ method, pattern });
    this.seedFromRoute({ method, pattern });
  }

  /** Seeds the body from the description's success response for the route the form names. */
  protected seedFromDraftRoute() {
    const draft = this.draft();

    if (draft) this.seedFromRoute({ method: draft.method, pattern: draft.pattern.trim() });
  }

  protected pickSchema(value: unknown) {
    this.pickedSchema.set(typeof value === 'string' ? value : '');
  }

  /** Seeds the body from one named schema, so a route the description does not declare still starts real. */
  protected seedFromSchema() {
    const name = this.pickedSchema();

    if (!name) return;

    this.applySeed({ kind: 'schema', name });
  }

  /** Re-rolls whatever the body was seeded from, so the picked style is what the form already shows. */
  protected pickSeedStyle(value: string) {
    const style = SEED_STYLES.find((entry) => entry.value === value);

    if (!style) return;

    this.seedStyle.set(style.value);

    const source = this.seedSource();

    if (source) this.applySeed(source);
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

  protected pickSpecFormat(value: string) {
    const format = SPEC_FORMATS.find((entry) => entry.value === value);

    if (format) this.specFormat.set(format.value);
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
      .pipe(tap((ok) => this.confirmCopy(this.copiedId, ok ? row.mock.id : null)))
      .subscribe();
  }

  /**
   * Copies one route as an OpenAPI `paths` entry, ready to be pasted under an existing description's
   * `paths`. A route seeded from a named schema keeps its `$ref`, since it is merged back into the
   * document that declares it.
   */
  protected copyPathItem(row: MockRow) {
    const schemas = this.schemasFor([row.mock]);
    const built = buildQueryDevtoolsOpenApiPathItem({ mocks: [row.mock], schemas: schemas.schemas });

    this.specNotes.set([...schemas.notes, ...built.notes]);

    copyToClipboard(this.write(built.document))
      .pipe(tap((ok) => this.confirmCopy(this.copiedSpecId, ok ? row.mock.id : null)))
      .subscribe();
  }

  /**
   * Downloads the whole library as one OpenAPI 3.1 document - the deliverable the API team merges. Every
   * designed mock is in it, armed or not: the library is the design work, and arming is only what this
   * page load happens to be serving.
   */
  protected exportLibrary() {
    const mocks = this.rows().map((row) => row.mock);

    if (!mocks.length) return;

    const schemas = this.schemasFor(mocks);
    const built = buildQueryDevtoolsOpenApiDocument({ mocks, schemas: schemas.schemas, now: Date.now() });
    const format = this.specFormat();

    this.specNotes.set([...schemas.notes, ...built.notes]);
    this.host.downloadTextFile({
      name: `openapi-designed-mocks-${new Date().toISOString().slice(0, 10)}.${format}`,
      content: this.write(built.document),
      type: SPEC_MEDIA_TYPES[format],
    });
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

  /**
   * The declared schemas the given mocks were seeded from, so their responses can reference them. Each
   * client is asked its own description, and a name two of them both declare keeps the first - one
   * exported document cannot hold two `MatchView`s.
   */
  private schemasFor(mocks: readonly QueryDevtoolsMock[]) {
    const byClient = new Map<string, Set<string>>();

    for (const mock of mocks) {
      if (!mock.schemaName) continue;

      const names = byClient.get(mock.clientName) ?? new Set<string>();

      names.add(mock.schemaName);
      byClient.set(mock.clientName, names);
    }

    const schemas: Record<string, unknown> = {};
    const notes = new Set<string>();
    const owners = new Map<string, string>();

    for (const [clientName, names] of byClient) {
      const collected = collectQueryDevtoolsSchemaComponents(clientName, [...names]);

      for (const note of collected.notes) notes.add(note);

      for (const [name, schema] of Object.entries(collected.schemas)) {
        const owner = owners.get(name);

        if (owner !== undefined) {
          if (JSON.stringify(schemas[name]) !== JSON.stringify(schema)) {
            notes.add(`${name} is declared by both ${owner} and ${clientName} - the one from ${owner} was kept.`);
          }

          continue;
        }

        owners.set(name, clientName);
        schemas[name] = schema;
      }
    }

    return { schemas, notes: [...notes] };
  }

  private write(document: unknown) {
    if (this.specFormat() === 'yaml') return toQueryDevtoolsYaml(document);

    return `${JSON.stringify(document, null, 2)}\n`;
  }

  private seedFromRoute(target: { method: string; pattern: string }) {
    if (!target.pattern) {
      this.draftError.set('Name the path first - the seed comes from what the description says it returns.');

      return;
    }

    this.applySeed({ kind: 'route', ...target });
  }

  private applySeed(source: SeedSource) {
    const style = this.seedStyle();
    const client = this.draftClient();
    const seed =
      source.kind === 'schema'
        ? seedQueryDevtoolsSchemaBody(client, source.name, style)
        : seedQueryDevtoolsSchemaRoute({ clientName: client, method: source.method, pattern: source.pattern }, style);

    if (!seed) {
      this.draftSeed.set(null);
      this.seedSource.set(null);
      this.draftError.set(
        source.kind === 'schema'
          ? `The description does not name ${source.name}.`
          : `The description declares no JSON response for ${source.method} ${source.pattern}.`,
      );

      return;
    }

    this.seedSource.set(source);
    this.draftSeed.set(seed);
    this.draftError.set(null);
    this.patchDraft({ body: JSON.stringify(seed.body, null, 2) });
  }

  private countOf(value: string, fallback: number) {
    const count = Math.trunc(Number(value));

    return Number.isFinite(count) ? count : fallback;
  }

  /**
   * The mock id a live query would carry. `query` has to be the declared query of the mock being matched
   * against: it is part of the id, and a registered query carries no declaration of its own.
   */
  private confirmCopy(target: WritableSignal<string | null>, id: string | null) {
    target.set(id);
    this.copiedReset$.next();
  }

  private idOf(entry: QueryDevtoolsEntry, query = '') {
    return queryDevtoolsMockId({
      clientName: entry.meta.clientName ?? '',
      method: entry.meta.method ?? 'GET',
      pattern: entry.meta.route ?? '',
      query,
    });
  }
}
