import { Signal, signal } from '@angular/core';
import { QueryDevtoolsMockTarget, QueryDevtoolsResolvedMock } from './query-devtools-hook';
import {
  clearQueryDevtoolsStore,
  queryDevtoolsSettings,
  readQueryDevtoolsStore,
  writeQueryDevtoolsStore,
} from './query-devtools-settings';

/**
 * A response designed in the devtools panel and served in place of a request. An override edits what came
 * back; a mock replaces the request itself, so it can be armed for a route that has never run - or does
 * not exist yet.
 */
export type QueryDevtoolsMock = {
  /** `clientName|method|pattern` - stable across reloads, and what the armed set holds. */
  id: string;

  /** Display name of the query client this is served for. */
  clientName: string;

  method: string;

  /** The route with its path params as `:name`, matched against a request's path. */
  pattern: string;

  /**
   * Query parameters the request must carry for this mock to answer it, as a query string
   * (`page=2&limit=10`). Every declared pair has to match; anything else on the request is ignored. Empty
   * matches whatever the request asks for.
   */
  query: string;

  /** The status the mock responds with. `400` and above arrive as an `HttpErrorResponse`. */
  status: number;

  body: unknown;

  /** Delay before the mocked response settles, so a mocked route still has a loading state. */
  latencyMs: number;

  /** When the body was captured from a real response, or `null` if it was authored from nothing. */
  capturedAt: number | null;
};

/**
 * The designed library. Whether a mock is **armed** is deliberately not part of it - see
 * {@link queryDevtoolsArmedMocks}.
 */
const STORAGE_KEY = 'ethlete:query:devtools:mocks:v1';

const mocks = /* @__PURE__ */ signal<readonly QueryDevtoolsMock[]>([]);
const armed = /* @__PURE__ */ signal<ReadonlySet<string>>(/* @__PURE__ */ new Set());

const scope = () => queryDevtoolsSettings().mocks;

/** The designed mocks, armed or not. Persisted, because losing an hour of authoring is unacceptable. */
export const queryDevtoolsMocks: Signal<readonly QueryDevtoolsMock[]> = /* @__PURE__ */ mocks.asReadonly();

/**
 * The ids currently being served. **Never persisted, at any scope**: an app that silently serves designed
 * data tomorrow morning is worse than losing which mocks were armed, so arming is per page load.
 */
export const queryDevtoolsArmedMocks: Signal<ReadonlySet<string>> = /* @__PURE__ */ armed.asReadonly();

/**
 * The identity of a designed mock: one per client, method, route **and** declared query. The query is part
 * of it so `/posts?page=1` and `/posts?page=2` can hold different bodies.
 */
export const queryDevtoolsMockId = (
  parts: Pick<QueryDevtoolsMock, 'clientName' | 'method' | 'pattern'> & { query?: string },
) => `${parts.clientName}|${parts.method}|${parts.pattern}${parts.query ? `?${parts.query}` : ''}`;

const write = () => {
  if (scope() === 'none') {
    clearQueryDevtoolsStore(STORAGE_KEY);

    return;
  }

  writeQueryDevtoolsStore(scope(), STORAGE_KEY, mocks());
};

const isMock = (value: unknown): value is QueryDevtoolsMock => {
  const mock = value as Partial<QueryDevtoolsMock> | null;

  return (
    !!mock &&
    typeof mock.id === 'string' &&
    typeof mock.clientName === 'string' &&
    typeof mock.method === 'string' &&
    typeof mock.pattern === 'string' &&
    typeof mock.status === 'number'
  );
};

/**
 * Reads the designed library, so a mock can be armed without authoring it again. Called by
 * `provideQueryDevtools()` after the settings it takes its scope from; nothing else may call it.
 * @internal
 */
export const initQueryDevtoolsMocks = () => {
  const stored = readQueryDevtoolsStore<unknown[]>(scope(), STORAGE_KEY);

  // `query` was added after the first version of the store, so an entry written before it still loads.
  mocks.set(Array.isArray(stored) ? stored.filter(isMock).map((mock) => ({ ...mock, query: mock.query ?? '' })) : []);
  armed.set(new Set());
};

/** The path of a request URL, without its origin or query string - what a pattern is matched against. */
export const queryDevtoolsRequestPath = (url: string) => {
  const withoutQuery = url.split('?')[0] ?? '';
  const schemeEnd = withoutQuery.indexOf('://');

  if (schemeEnd === -1) return withoutQuery;

  const pathStart = withoutQuery.indexOf('/', schemeEnd + 3);

  return pathStart === -1 ? '/' : withoutQuery.slice(pathStart);
};

const segmentsOf = (path: string) => path.split('/').filter(Boolean);

/** The query string of a request URL, without the `?`. */
const queryOf = (url: string) => url.split('?')[1] ?? '';

/**
 * Whether a request carries every query parameter a mock declares. Extra parameters are ignored - a mock
 * says what the request must ask for, not everything it may.
 */
export const matchesQueryDevtoolsMockQuery = (declared: string, url: string) => {
  if (!declared) return true;

  const asked = new URLSearchParams(queryOf(url));

  return [...new URLSearchParams(declared)].every(([key, value]) => asked.get(key) === value);
};

/**
 * Whether a request path is the route a pattern describes. A `:param` segment matches any single
 * non-empty segment, which is the whole point: a mock is armed for a route, not for the one URL a query
 * happened to build.
 */
export const matchesQueryDevtoolsMockPattern = (pattern: string, path: string) => {
  const patternSegments = segmentsOf(pattern);
  const pathSegments = segmentsOf(path);

  if (patternSegments.length !== pathSegments.length) return false;

  return patternSegments.every((segment, index) => segment.startsWith(':') || segment === pathSegments[index]);
};

/**
 * Adds a designed mock, or replaces the one already under its id. Arming is untouched: re-designing a
 * body while it is being served changes what the next request gets.
 */
export const saveQueryDevtoolsMock = (mock: QueryDevtoolsMock) => {
  mocks.update((current) => {
    const index = current.findIndex((entry) => entry.id === mock.id);

    if (index === -1) return [...current, mock];

    return current.map((entry) => (entry.id === mock.id ? mock : entry));
  });

  write();
};

/** Removes a designed mock, disarming it on the way out. */
export const deleteQueryDevtoolsMock = (id: string) => {
  mocks.update((current) => current.filter((entry) => entry.id !== id));
  armQueryDevtoolsMock(id, false);
  write();
};

/** Starts or stops serving one designed mock. Arming a mock that is not in the library does nothing. */
export const armQueryDevtoolsMock = (id: string, isArmed: boolean) => {
  armed.update((current) => {
    if (isArmed && !mocks().some((mock) => mock.id === id)) return current;

    const next = new Set(current);

    if (isArmed) next.add(id);
    else next.delete(id);

    return next;
  });
};

/** Stops serving every mock, leaving the library alone - the armed bar's one-click way out. */
export const clearQueryDevtoolsArmedMocks = () => armed.set(new Set());

/** Empties the designed library and disarms everything - the panel's "Reset devtools". */
export const clearQueryDevtoolsMockStore = () => {
  mocks.set([]);
  armed.set(new Set());
  clearQueryDevtoolsStore(STORAGE_KEY);
};

const declaredParamCount = (mock: QueryDevtoolsMock) => (mock.query ? [...new URLSearchParams(mock.query)].length : 0);

/**
 * The mock to serve one upcoming attempt, or `null` to let it reach the network. The armed mock declaring
 * the most query parameters wins, so a special case armed on top of a general one is what answers.
 *
 * Installed as the mock resolver by `provideQueryDevtools()`; nothing else may call it.
 * @internal
 */
export const resolveQueryDevtoolsMockForAttempt = (
  target: QueryDevtoolsMockTarget,
): QueryDevtoolsResolvedMock | null => {
  const ids = armed();

  if (!ids.size) return null;

  const path = queryDevtoolsRequestPath(target.url);

  const mock = mocks()
    .filter(
      (candidate) =>
        ids.has(candidate.id) &&
        candidate.clientName === target.clientName &&
        candidate.method === target.method &&
        matchesQueryDevtoolsMockPattern(candidate.pattern, path) &&
        matchesQueryDevtoolsMockQuery(candidate.query, target.url),
    )
    // The most specific armed mock answers: one that names `page=2` beats one that takes any query, so
    // arming a general mock does not shadow the special case someone armed on top of it.
    .sort((a, b) => declaredParamCount(b) - declaredParamCount(a))[0];

  if (!mock) return null;

  return { status: mock.status, body: mock.body, latencyMs: mock.latencyMs };
};
