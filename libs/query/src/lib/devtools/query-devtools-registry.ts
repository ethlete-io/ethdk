import { EnvironmentProviders, isDevMode, makeEnvironmentProviders, Signal, signal } from '@angular/core';
import { AnyCreateQueryClientResult } from '../http/query-client';
import {
  QueryDevtoolsEntry,
  QueryDevtoolsRegistration,
  QueryDevtoolsRoutePart,
  setQueryDevtoolsFaultResolver,
  setQueryDevtoolsFormLinksFactory,
  setQueryDevtoolsOverridesFactory,
  setQueryDevtoolsRegistrar,
  setQueryDevtoolsStatsFactory,
} from './query-devtools-hook';
import { resolveQueryDevtoolsFaultForAttempt } from './query-devtools-faults';
import { createQueryDevtoolsFormLinks } from './query-devtools-form-links';
import { createQueryDevtoolsOverrides } from './query-devtools-overrides';
import { createQueryDevtoolsStats } from './query-devtools-stats';

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
    overrides: registration.overrides,
  };

  entries.update((list) => [...list, fullEntry]);

  return () => entries.update((list) => list.filter((e) => e.id !== fullEntry.id));
};

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
export const provideQueryDevtools = (): EnvironmentProviders => {
  setQueryDevtoolsRegistrar(registerEntry);
  setQueryDevtoolsStatsFactory(createQueryDevtoolsStats);
  setQueryDevtoolsFormLinksFactory(createQueryDevtoolsFormLinks);
  setQueryDevtoolsOverridesFactory(createQueryDevtoolsOverrides);
  setQueryDevtoolsFaultResolver(resolveQueryDevtoolsFaultForAttempt);

  if (!isDevMode()) {
    console.warn(
      'You are using the Query Devtools in production mode. This increases the size of your bundle and should only be used for development purposes.',
    );
  }

  return makeEnvironmentProviders([]);
};
