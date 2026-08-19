import { EnvironmentProviders, isDevMode, makeEnvironmentProviders, Signal, signal } from '@angular/core';
import { CORE_VERSION } from '@ethlete/core';
import { AnyCreateQueryClientResult } from '../http/query-client';
import { QUERY_VERSION } from '../version';
import { QueryDevtoolsAppInfo, registerEthleteVersion, setQueryDevtoolsAppInfo } from './query-devtools-about';
import {
  QueryDevtoolsEntry,
  QueryDevtoolsRegistration,
  QueryDevtoolsRoutePart,
  setQueryDevtoolsFaultResolver,
  setQueryDevtoolsFormLinksFactory,
  setQueryDevtoolsMockResolver,
  setQueryDevtoolsOverridesFactory,
  setQueryDevtoolsRegistrar,
  setQueryDevtoolsStatsFactory,
  setQueryDevtoolsTokenPayloadPatcher,
} from './query-devtools-hook';
import { initQueryDevtoolsFaults, resolveQueryDevtoolsFaultForAttempt } from './query-devtools-faults';
import { createQueryDevtoolsFormLinks } from './query-devtools-form-links';
import {
  initQueryDevtoolsOverridePersistence,
  withQueryDevtoolsOverridePersistence,
} from './query-devtools-override-persistence';
import { createQueryDevtoolsOverrides } from './query-devtools-overrides';
import { initQueryDevtoolsMocks, resolveQueryDevtoolsMockForAttempt } from './query-devtools-mocks';
import { QueryDevtoolsSchemaLoaders, setQueryDevtoolsSchemaLoader } from './query-devtools-schema';
import { initQueryDevtoolsSettings } from './query-devtools-settings';
import { createQueryDevtoolsStats, setQueryDevtoolsResponseHistory } from './query-devtools-stats';
import { applyQueryDevtoolsTokenTtl } from './query-devtools-token-ttl';
import { MAX_QUERY_BATCH_TOMBSTONES, MAX_QUERY_DEVTOOLS_TOMBSTONES, tombstoneOf } from './query-devtools-tombstone';

const entries = /* @__PURE__ */ signal<QueryDevtoolsEntry[]>([]);

/**
 * The reactive list of every registered devtools entry, consumed by the `<et-query-devtools>` UI.
 */
export const queryDevtoolsEntries: Signal<QueryDevtoolsEntry[]> = /* @__PURE__ */ entries.asReadonly();

// Per-descriptor counter used to derive stable, reload-deterministic ids. Reset on page load (module
// re-eval), so the same queries created in the same order get the same ids across reloads - which is
// what lets the devtools restore the selected query after a reload.
const idCounters = /* @__PURE__ */ new Map<string, number>();

const descriptorOf = (entry: Pick<QueryDevtoolsEntry, 'kind' | 'meta'>) => {
  const { kind, meta } = entry;

  if (kind === 'query') return `query|${meta.clientName ?? ''}|${meta.method ?? ''}|${meta.route ?? ''}`;
  if (kind === 'auth-provider') return `auth-provider|${meta.name ?? ''}`;
  if (kind === 'ws-client') return `ws-client|${meta.name ?? ''}`;
  if (kind === 'query-form') return `query-form|${meta.name ?? ''}`;

  return kind;
};

/**
 * Wraps a path param name where a route function interpolated it. A NUL cannot occur in a route, so
 * a marked-up route stays unambiguously parseable.
 */
const PARAM_MARKER = '\u0000';

/**
 * Stands in for the path params object a route function expects, recording every param it reads as
 * `\0<name>\0` in the returned route. A route that transforms what it reads (`p.id.slice(2)`) still
 * yields a usable route - the recorded name is transformed along with it.
 */
const paramRecorder = () =>
  new Proxy(
    {},
    {
      get: (_, prop) => (typeof prop === 'string' ? `${PARAM_MARKER}${prop}${PARAM_MARKER}` : undefined),
    },
  );

/** Splits a recorded route into its literal chunks and the path params interleaved between them. */
const parseRecordedRoute = (recorded: string): QueryDevtoolsRoutePart[] =>
  recorded
    .split(PARAM_MARKER)
    // Markers are balanced, so every odd chunk is a param name and every even one is literal text.
    .map((text, index): QueryDevtoolsRoutePart => ({ text, param: index % 2 === 1 ? text : null }))
    .filter((part) => part.text !== '');

/**
 * Parses a query creator route into its literal and path-param parts, so the devtools can show which
 * segments of a route are dynamic and fill them in with the values a query actually used.
 * @internal
 */
export const parseQueryRoute = (route: unknown): QueryDevtoolsRoutePart[] => {
  if (route === undefined || route === null) return [];

  try {
    if (typeof route === 'function') {
      return parseRecordedRoute((route as (args: unknown) => string)(paramRecorder()));
    }

    return [{ text: String(route), param: null }];
  } catch {
    return [{ text: typeof route === 'function' ? '(dynamic route)' : String(route), param: null }];
  }
};

/** Renders parsed route parts as a template, e.g. `/team/:teamId/players`. */
export const stringifyQueryRouteParts = (parts: QueryDevtoolsRoutePart[]) =>
  parts.map((part) => (part.param ? `:${part.param}` : part.text)).join('');

/**
 * Extracts the human readable client name from a query client tuple. The client's DI token is named
 * `QueryClient_<name>`, so we strip the prefix to recover the original name.
 * @internal
 */
export const getQueryClientName = (client: AnyCreateQueryClientResult) => {
  const token = client.token;
  const desc = token?.toString?.() ?? '';

  return desc.replace('InjectionToken ', '').replace('QueryClient_', '') || 'unknown';
};

/**
 * The provider name behind a bearer auth provider definition, recovered from its DI token the way
 * {@link getQueryClientName} recovers a client's.
 * @internal
 */
export const getBearerAuthProviderName = (ref: { token?: unknown }) => {
  const desc = String(ref.token ?? '');

  return desc.replace('InjectionToken ', '').replace('BearerAuthProvider_', '') || 'unknown';
};

/**
 * Ids are derived deterministically from a stable descriptor + a per-descriptor sequence number, so
 * they survive a page reload (letting the UI restore the selected entry) instead of being random.
 */
const registerEntry = (registration: QueryDevtoolsRegistration): (() => void) => {
  const meta = { ...registration.meta };

  if (registration.route !== undefined) {
    meta.routeParts = parseQueryRoute(registration.route);
    meta.route = stringifyQueryRouteParts(meta.routeParts);
  }

  if (registration.clientRef) meta.clientName = getQueryClientName(registration.clientRef);

  if (registration.authProviderRef) {
    meta.isSecure = true;
    meta.authProviderName = getBearerAuthProviderName(registration.authProviderRef);
  }

  if (registration.authQueries) {
    meta.authQueries = registration.authQueries.map((authQuery) => ({
      ...authQuery,
      route: stringifyQueryRouteParts(parseQueryRoute(authQuery.route)),
    }));
  }

  let id = registration.id;

  if (!id) {
    const descriptor = descriptorOf({ kind: registration.kind, meta });
    const seq = idCounters.get(descriptor) ?? 0;
    idCounters.set(descriptor, seq + 1);
    id = `${descriptor}#${seq}`;
  }

  const fullEntry: QueryDevtoolsEntry = {
    id,
    kind: registration.kind,
    handle: registration.handle,
    meta,
    createdAt: Date.now(),
    stats: registration.stats,
    formLinks: registration.formLinks,
    overrides: registration.overrides && withQueryDevtoolsOverridePersistence(id, registration.overrides),
  };

  // A registration that brings its own id can repeat one a tombstone still holds; the live entry wins.
  entries.update((list) => [...list.filter((e) => !(e.id === id && e.destroyedAt)), fullEntry]);

  return () =>
    entries.update((list) => {
      const index = list.findIndex((e) => e.id === fullEntry.id);

      if (index === -1) return list;

      const next = list.slice();

      // Only queries leave a tombstone. A stack, sequence, batch, form or auth provider is a container
      // whose interesting state is the queries it owns - each of which tombstones on its own.
      if (fullEntry.kind !== 'query') {
        next.splice(index, 1);

        return next;
      }

      next[index] = tombstoneOf(fullEntry, Date.now());

      return capTombstones(next);
    });
};

/** The oldest `count` entries of a bucket, which is what a cap drops when the bucket is over it. */
const oldestOver = (bucket: QueryDevtoolsEntry[], cap: number) =>
  bucket.length <= cap
    ? []
    : bucket.sort((a, b) => (a.destroyedAt ?? 0) - (b.destroyedAt ?? 0)).slice(0, bucket.length - cap);

/**
 * Caps the tombstones the registry holds. A batch's items are counted per batch rather than against the
 * shared budget: a batch destroys one query per item as it settles, so a single 500-item run would
 * otherwise fill the whole buffer and evict every tombstone the panel is actually read for - the `401`
 * that took its component down with it. Each batch keeps its own recent tail instead.
 */
const capTombstones = (list: QueryDevtoolsEntry[]) => {
  const shared: QueryDevtoolsEntry[] = [];
  const perBatch = new Map<object, QueryDevtoolsEntry[]>();

  for (const entry of list) {
    if (!entry.destroyedAt) continue;

    const batch = entry.meta.batch;

    if (!batch) {
      shared.push(entry);
      continue;
    }

    const bucket = perBatch.get(batch);

    if (bucket) bucket.push(entry);
    else perBatch.set(batch, [entry]);
  }

  const doomed = new Set(oldestOver(shared, MAX_QUERY_DEVTOOLS_TOMBSTONES));

  for (const bucket of perBatch.values()) {
    for (const entry of oldestOver(bucket, MAX_QUERY_BATCH_TOMBSTONES)) doomed.add(entry);
  }

  return doomed.size ? list.filter((e) => !doomed.has(e)) : list;
};

/**
 * Forgets destroyed entries the registry is holding - the panel's "clear gone" action. Pass the ids to
 * drop to forget only those; with no argument every tombstone goes. Live entries are untouched.
 */
export const clearQueryDevtoolsTombstones = (ids?: Iterable<string>) => {
  const doomed = ids ? new Set(ids) : null;

  entries.update((list) => list.filter((e) => !e.destroyedAt || (doomed ? !doomed.has(e.id) : false)));
};

export type QueryDevtoolsOptions = {
  /**
   * How many of each query's most recent runs keep their response (or error) body, which is what the
   * panel's response diff compares. Defaults to `5`. Bodies dominate what the run buffer retains, so
   * raise this only as far as the reach you actually need - a polling query holds one per run.
   *
   * This is the default; the panel's Settings tab can raise it for the rest of a page.
   */
  responseHistory?: number;

  /**
   * Build information about the application - version, commit SHA, environment name. Shown on the
   * panel's About tab, included in the session export and exposed on `window.ethlete`, so a bug report
   * says which build it came from. Generate it rather than typing it:
   * `nx g @ethlete/core:devtools-about <app>`.
   */
  about?: QueryDevtoolsAppInfo;

  /**
   * The OpenAPI (or JSON Schema) document behind each query client, so the panel's mock designer can
   * seed a response from the real shape of a route and label each field with the type it is declared as.
   * One loader describes every client; a record keyed by client name describes an application whose
   * clients speak to different APIs. Each loader runs at most once, and only when the designer first
   * asks for it - see {@link QueryDevtoolsSchemaLoaders}.
   */
  schema?: QueryDevtoolsSchemaLoaders;
};

let queryDevtoolsInitialized = false;

/**
 * Enables the `@ethlete/query` devtools. Add this to your application providers (e.g. in
 * `bootstrapApplication`) to make query clients, queries, stacks, sequences and auth providers
 * appear in the `<et-query-devtools>` panel.
 *
 * When omitted, all devtools instrumentation is a no-op: the registry is never installed, so nothing
 * is retained at runtime and the registry itself is dropped from the bundle.
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideQueryDevtools()],
 * });
 * ```
 */
export const provideQueryDevtools = (options?: QueryDevtoolsOptions): EnvironmentProviders => {
  if (queryDevtoolsInitialized) return makeEnvironmentProviders([]);

  queryDevtoolsInitialized = true;

  // First: the stored settings say where the override store lives and whether the panel has raised the
  // retention this app asked for, and both are read by the calls below.
  initQueryDevtoolsSettings();
  setQueryDevtoolsResponseHistory(options?.responseHistory);
  registerEthleteVersion('core', CORE_VERSION);
  registerEthleteVersion('query', QUERY_VERSION);
  setQueryDevtoolsAppInfo(options?.about);
  initQueryDevtoolsOverridePersistence();
  initQueryDevtoolsMocks();
  initQueryDevtoolsFaults();
  setQueryDevtoolsSchemaLoader(options?.schema);
  setQueryDevtoolsRegistrar(registerEntry);
  setQueryDevtoolsStatsFactory(createQueryDevtoolsStats);
  setQueryDevtoolsFormLinksFactory(createQueryDevtoolsFormLinks);
  setQueryDevtoolsOverridesFactory(createQueryDevtoolsOverrides);
  setQueryDevtoolsFaultResolver(resolveQueryDevtoolsFaultForAttempt);
  setQueryDevtoolsMockResolver(resolveQueryDevtoolsMockForAttempt);
  setQueryDevtoolsTokenPayloadPatcher(applyQueryDevtoolsTokenTtl);

  if (!isDevMode()) {
    console.warn(
      'You are using the Query Devtools in production mode. This increases the size of your bundle and should only be used for development purposes.',
    );
  }

  return makeEnvironmentProviders([]);
};
