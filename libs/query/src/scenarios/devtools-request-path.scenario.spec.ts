import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  armQueryDevtoolsMock,
  clearQueryDevtoolsArmedMocks,
  clearQueryDevtoolsAuthSessions,
  clearQueryDevtoolsFaults,
  clearQueryDevtoolsMockStore,
  clearQueryDevtoolsOverrideStore,
  clearQueryDevtoolsTombstones,
  createBearerAuthProvider,
  createGetQuery,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  isQueryDevtoolsEnabled,
  provideQueryDevtools,
  QUERY_DEVTOOLS_FAULT_STATUSES,
  queryDevtoolsApiEnvIsProduction,
  queryDevtoolsApiEnvValues,
  queryDevtoolsArmedMocks,
  queryDevtoolsAuthAccountsFor,
  queryDevtoolsAuthSessionsFor,
  queryDevtoolsEntries,
  queryDevtoolsMockId,
  QueryDevtoolsMock,
  saveQueryDevtoolsMock,
  setQueryDevtoolsApiEnv,
  setQueryDevtoolsArmedMocksScope,
  setQueryDevtoolsFault,
  setQueryDevtoolsOverridePersistence,
  setQueryDevtoolsSettings,
  withArgs,
  withAuthenticationQuery,
  withDefaultRetry,
  withRefreshQuery,
} from '../index';
import { mintToken, Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';

const ARMED_MOCKS_STORAGE_KEY = 'ethlete:query:devtools:mocks:armed:v1';

const OVERRIDES_STORAGE_KEY = 'ethlete:query:devtools:overrides:v1';

const ENV_STORAGE_KEY = 'et-devtools-request-path-hub-env';
const VAULT_PROVIDER_NAME = 'devtools-request-path-vault-provider';

const devtoolsProviders = () => [
  provideQueryDevtools({
    apiEnvs: [
      {
        name: 'Hub API',
        storageKey: ENV_STORAGE_KEY,
        fallback: 'staging',
        envs: [
          { id: 'staging', url: 'https://staging.test' },
          { id: 'production', url: 'https://production.test', production: true },
        ],
      },
    ],
    authAccounts: [{ provider: VAULT_PROVIDER_NAME, label: 'Member', loginQuery: 'login' }],
  }),
];

const resetDevtoolsState = () => {
  clearQueryDevtoolsMockStore();
  clearQueryDevtoolsFaults();
  clearQueryDevtoolsAuthSessions();
  clearQueryDevtoolsTombstones();
  setQueryDevtoolsApiEnv(ENV_STORAGE_KEY, null);
  setQueryDevtoolsSettings({ armedMocks: 'none', armedFaults: 'none' });
};

let bootCounter = 0;

type TokenArgs = { body: { email?: string }; response: { accessToken: string; refreshToken: string } };

const serveAuth = (s: Scenario) => {
  s.api.on('POST', '/auth/login', ({ body }) => {
    const email = (body as TokenArgs['body']).email ?? 'user';

    return {
      body: {
        accessToken: mintToken({ claims: { sub: email } }),
        refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000, claims: { sub: email } }),
      },
    };
  });
  s.api.on('POST', '/auth/refresh', () => ({
    body: { accessToken: mintToken(), refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }) },
  }));
};

/** A second auth provider, named explicitly so it can be matched against a declared `authAccounts` entry. */
const bootAuthTab = (s: Scenario, options: { name: string }) => {
  const clientRef = createQueryClient({
    name: `devtools-request-path-vault-${++bootCounter}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
  });
  const post = createPostQuery(clientRef);
  const authRef = createBearerAuthProvider({
    name: options.name,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh') }),
    ],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('devtools request-path scenario: failed to create the auth provider');

  return { auth, destroy: () => injector.destroy() };
};

describe('a request without the devtools attached', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('runs normally, and the bridge reports itself disabled', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    s.api.on('GET', '/control', () => ({ body: { ok: true } }));

    const getControl = s.get<{ response: { ok: boolean } }>('/control');
    const c = s.consumer();
    const query = c.run(() => getControl());
    await s.settle();

    expect(query.response()).toEqual({ ok: true });
    expect(s.api.requests).toHaveLength(1);

    c.destroy();
  });
});

describe('an armed mock answers a route without a request', () => {
  const CLIENT_NAME = 'devtools-request-path-mocks';
  const scenario = useScenario({
    name: CLIENT_NAME,
    clientOptions: { keepUnusedFor: 0 },
    providers: devtoolsProviders,
  });

  beforeEach(resetDevtoolsState);

  it('serves the designed body while armed, and lets the real request through once disarmed', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    const path = '/mocks-designed';
    const id = queryDevtoolsMockId({ clientName: CLIENT_NAME, method: 'GET', pattern: path });
    const mock: QueryDevtoolsMock = {
      id,
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern: path,
      query: '',
      status: 200,
      body: { source: 'mock' },
      latencyMs: 0,
      capturedAt: null,
    };

    s.api.on('GET', path, () => ({ body: { source: 'api' } }));
    saveQueryDevtoolsMock(mock);
    armQueryDevtoolsMock(id, true);

    const getMocked = s.get<{ response: { source: string } }>(path);
    const c = s.consumer();
    const query = c.run(() => getMocked());
    await s.settle();

    expect(s.api.requests).toHaveLength(0);
    expect(query.response()).toEqual({ source: 'mock' });

    armQueryDevtoolsMock(id, false);
    query.execute();
    await s.settle();

    expect(s.api.requests).toHaveLength(1);
    expect(query.response()).toEqual({ source: 'api' });

    c.destroy();
  });

  it('answering 400 and above arrives as a real HttpErrorResponse', async () => {
    const s = scenario();
    const path = '/mocks-error';
    const id = queryDevtoolsMockId({ clientName: CLIENT_NAME, method: 'GET', pattern: path });

    saveQueryDevtoolsMock({
      id,
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern: path,
      query: '',
      status: 422,
      body: { message: 'mocked failure' },
      latencyMs: 0,
      capturedAt: null,
    });
    armQueryDevtoolsMock(id, true);

    const getMocked = s.get<{ response: unknown }>(path);
    const c = s.consumer();
    const query = c.run(() => getMocked());
    await s.settle();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);

    expect(query.error()?.code).toBe(422);
    expect(s.api.requests).toHaveLength(0);

    c.destroy();
  });

  it('the mock naming more query parameters wins, and Disarm all empties the served set', async () => {
    const s = scenario();
    const path = '/mocks-specific';
    const generalId = queryDevtoolsMockId({ clientName: CLIENT_NAME, method: 'GET', pattern: path });
    const specificId = queryDevtoolsMockId({
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern: path,
      query: 'page=2',
    });

    s.api.on('GET', path, () => ({ body: { page: 'from-api' } }));
    saveQueryDevtoolsMock({
      id: generalId,
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern: path,
      query: '',
      status: 200,
      body: { page: 'any' },
      latencyMs: 0,
      capturedAt: null,
    });
    saveQueryDevtoolsMock({
      id: specificId,
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern: path,
      query: 'page=2',
      status: 200,
      body: { page: 'two' },
      latencyMs: 0,
      capturedAt: null,
    });
    armQueryDevtoolsMock(generalId, true);
    armQueryDevtoolsMock(specificId, true);

    const getPage = s.get<{ response: { page: string }; queryParams: { page: number } }>(path);
    const c = s.consumer();
    const query = c.run(() => getPage(withArgs(() => ({ queryParams: { page: 2 } }))));
    await s.settle();

    expect(query.response()).toEqual({ page: 'two' });
    expect(s.api.requests).toHaveLength(0);

    clearQueryDevtoolsArmedMocks();

    expect(queryDevtoolsArmedMocks().size).toBe(0);

    c.destroy();
  });

  it('the armed set is written to the storage the scope names, and to neither once the scope is none', () => {
    const path = '/mocks-scope';
    const id = queryDevtoolsMockId({ clientName: CLIENT_NAME, method: 'GET', pattern: path });

    saveQueryDevtoolsMock({
      id,
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern: path,
      query: '',
      status: 200,
      body: {},
      latencyMs: 0,
      capturedAt: null,
    });

    setQueryDevtoolsArmedMocksScope('session');
    armQueryDevtoolsMock(id, true);

    expect(window.sessionStorage.getItem(ARMED_MOCKS_STORAGE_KEY)).toContain(id);

    setQueryDevtoolsArmedMocksScope('none');

    expect(window.sessionStorage.getItem(ARMED_MOCKS_STORAGE_KEY)).toBeNull();
  });
});

describe('an armed fault on a secure query', () => {
  const CLIENT_NAME = 'devtools-request-path-auth-fault';
  const scenario = useScenario({
    name: CLIENT_NAME,
    clientOptions: { keepUnusedFor: 0 },
    providers: devtoolsProviders,
  });

  beforeEach(resetDevtoolsState);

  it('refreshes once and retries once, then clears so the next request is clean', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/fault-401', () => ({ body: { ok: true } }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    s.tick();

    setQueryDevtoolsFault({ clientName: CLIENT_NAME, patch: { status: 401, failNext: 1 } });

    const getSecure = createSecureGetQuery(s.clientRef, auth.ref)<{ response: { ok: boolean } }>('/secure/fault-401');
    const query = c.run(() => getSecure());
    s.flush();
    await s.settle();
    s.flush();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);

    expect(query.response()).toEqual({ ok: true });
    expect(s.api.requestCount('GET', '/secure/fault-401')).toBe(1);
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

    clearQueryDevtoolsFaults(CLIENT_NAME);
    query.execute();
    await s.settle();

    expect(s.api.requestCount('GET', '/secure/fault-401')).toBe(2);

    c.destroy();
  });
});

describe('an armed fault on a plain query, resolved by the default retry policy', () => {
  const CLIENT_NAME = 'devtools-request-path-status-fault';
  const scenario = useScenario({
    name: CLIENT_NAME,
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ maxAttempts: 2, baseDelayMs: 10, jitter: 0 })],
    providers: devtoolsProviders,
  });

  beforeEach(resetDevtoolsState);

  it('a 500 fault waits out its latency, then fails without a retry and never reaches the network', async () => {
    const s = scenario();
    const path = '/faults-500';

    s.api.on('GET', path, () => ({ body: { ok: true } }));
    setQueryDevtoolsFault({ clientName: CLIENT_NAME, patch: { status: 500, failNext: 1, latencyMs: 300 } });

    expect(QUERY_DEVTOOLS_FAULT_STATUSES.find((entry) => entry.status === 500)?.retryable).toBe(false);

    const getFlaky = s.get<{ response: { ok: boolean } }>(path);
    const c = s.consumer();
    const query = c.run(() => getFlaky());

    s.tick(299);
    expect(query.error()).toBeNull();
    expect(query.response()).toBeNull();

    s.flush();
    await s.settle();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    expect(query.response()).toBeNull();
    expect(query.error()?.code).toBe(500);
    expect(s.api.requests).toHaveLength(0);

    c.destroy();
  });

  it('a 503 fault is retried by the default policy, and the retried attempt reaches the network', async () => {
    const s = scenario();
    const path = '/faults-503';

    s.api.on('GET', path, () => ({ body: { ok: true } }));
    setQueryDevtoolsFault({ clientName: CLIENT_NAME, patch: { status: 503, failNext: 1 } });

    expect(QUERY_DEVTOOLS_FAULT_STATUSES.find((entry) => entry.status === 503)?.retryable).toBe(true);

    const getFlaky = s.get<{ response: { ok: boolean } }>(path);
    const c = s.consumer();
    const query = c.run(() => getFlaky());

    s.flush();
    await s.settle();

    expect(query.response()).toEqual({ ok: true });
    expect(s.api.requests).toHaveLength(1);

    c.destroy();
  });
});

describe('a response override survives a refetch and drops on disarm', () => {
  const CLIENT_NAME = 'devtools-request-path-overrides';
  const scenario = useScenario({
    name: CLIENT_NAME,
    clientOptions: { keepUnusedFor: 0 },
    providers: devtoolsProviders,
  });

  beforeEach(resetDevtoolsState);

  it('replays the armed edit against every future response, and stops once cleared', async () => {
    const s = scenario();
    const path = '/overrides-test';
    let n = 0;

    s.api.on('GET', path, () => ({ body: { title: `Original ${++n}`, count: n } }));

    const getOverridden = s.get<{ response: { title: string; count: number } }>(path);
    const c = s.consumer();
    const query = c.run(() => getOverridden());
    await s.settle();

    expect(query.response()).toEqual({ title: 'Original 1', count: 1 });

    const entry = queryDevtoolsEntries().find((candidate) => candidate.handle === query);

    if (!entry?.overrides) {
      throw new Error('devtools request-path scenario: the query registered no overrides recorder');
    }

    entry.overrides.arm({ type: 'set', path: ['title'], value: 'Overridden' });

    expect(query.response()).toEqual({ title: 'Overridden', count: 1 });

    query.execute();
    await s.settle();

    expect(s.api.requestCount('GET', path)).toBe(2);
    expect(query.response()).toEqual({ title: 'Overridden', count: 2 });

    entry.overrides.clearAll();

    expect(query.response()).toEqual({ title: 'Original 2', count: 2 });

    c.destroy();
  });
});

describe('an override recorder is released with the query that armed it', () => {
  const CLIENT_NAME = 'devtools-request-path-override-release';
  const scenario = useScenario({
    name: CLIENT_NAME,
    clientOptions: { keepUnusedFor: 0 },
    providers: devtoolsProviders,
  });

  beforeEach(() => {
    resetDevtoolsState();
    setQueryDevtoolsOverridePersistence(false);
    clearQueryDevtoolsOverrideStore();
  });

  it('keeps a destroyed query out of what "Keep across reloads" captures', async () => {
    const s = scenario();
    const path = '/override-release-test';

    s.api.on('GET', path, () => ({ body: { title: 'Original' } }));

    const getOverridden = s.get<{ response: { title: string } }>(path);
    const c = s.consumer();
    const query = c.run(() => getOverridden());
    await s.settle();

    const entry = queryDevtoolsEntries().find((candidate) => candidate.handle === query);

    if (!entry?.overrides) {
      throw new Error('devtools request-path scenario: the query registered no overrides recorder');
    }

    entry.overrides.arm({ type: 'set', path: ['title'], value: 'Overridden' });

    expect(query.response()).toEqual({ title: 'Overridden' });

    c.destroy();
    await s.settle();

    setQueryDevtoolsOverridePersistence(true);

    const stored = JSON.parse(window.sessionStorage.getItem(OVERRIDES_STORAGE_KEY) ?? 'null') as {
      ops: Record<string, unknown[]>;
    } | null;

    expect(stored?.ops[entry.id]).toBeUndefined();
  });
});

describe('the API environment switch scopes the session vault', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    providers: devtoolsProviders,
  });

  beforeEach(resetDevtoolsState);

  it('writes the storage key and updates the values signal, without touching the network', () => {
    const s = scenario();

    expect(queryDevtoolsApiEnvValues()[ENV_STORAGE_KEY]).toBeNull();
    expect(queryDevtoolsApiEnvIsProduction()).toBe(false);

    setQueryDevtoolsApiEnv(ENV_STORAGE_KEY, 'production');

    expect(window.localStorage.getItem(ENV_STORAGE_KEY)).toBe('production');
    expect(queryDevtoolsApiEnvValues()[ENV_STORAGE_KEY]).toBe('production');
    expect(queryDevtoolsApiEnvIsProduction()).toBe(true);
    expect(s.api.requests).toHaveLength(0);
  });

  it('scopes accounts and sessions to the picked env, and refuses to keep either while production is the pick', async () => {
    const s = scenario();
    serveAuth(s);

    setQueryDevtoolsApiEnv(ENV_STORAGE_KEY, 'staging');
    expect(queryDevtoolsAuthAccountsFor(VAULT_PROVIDER_NAME)).toHaveLength(1);

    const tab = bootAuthTab(s, { name: VAULT_PROVIDER_NAME });
    tab.auth.queries.login.execute({ body: { email: 'staging-user@test' } });
    await s.settle();

    expect(queryDevtoolsAuthSessionsFor(VAULT_PROVIDER_NAME)).toHaveLength(1);

    setQueryDevtoolsApiEnv(ENV_STORAGE_KEY, 'production');

    expect(queryDevtoolsApiEnvIsProduction()).toBe(true);
    expect(queryDevtoolsAuthAccountsFor(VAULT_PROVIDER_NAME)).toHaveLength(0);
    expect(queryDevtoolsAuthSessionsFor(VAULT_PROVIDER_NAME)).toHaveLength(0);

    tab.auth.queries.login.execute({ body: { email: 'prod-user@test' } });
    await s.settle();

    expect(tab.auth.sessionStatus()).toBe('authenticated');
    expect(queryDevtoolsAuthSessionsFor(VAULT_PROVIDER_NAME)).toHaveLength(0);

    setQueryDevtoolsApiEnv(ENV_STORAGE_KEY, 'staging');
    expect(queryDevtoolsAuthSessionsFor(VAULT_PROVIDER_NAME)).toHaveLength(1);

    tab.destroy();
  });
});

describe('registry teardown once every client is destroyed', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    providers: devtoolsProviders,
  });

  beforeEach(resetDevtoolsState);

  it('leaves a tombstone per query instead of a live entry, and both are clearable', async () => {
    const s = scenario();
    const clientRef = createQueryClient({
      name: `devtools-request-path-registry-${++bootCounter}`,
      baseUrl: BASE_URL,
      keepUnusedFor: 0,
    });

    s.api.on('GET', '/registry-a', () => ({ body: { id: 'a' } }));
    s.api.on('GET', '/registry-b', () => ({ body: { id: 'b' } }));

    const getA = createGetQuery(clientRef)<{ response: { id: string } }>('/registry-a');
    const getB = createGetQuery(clientRef)<{ response: { id: string } }>('/registry-b');

    const injector = createEnvironmentInjector(
      [...clientRef.provide()],
      s.run(() => inject(EnvironmentInjector)),
    );
    const consumerInjector = createEnvironmentInjector([], injector);
    const queryA = consumerInjector.runInContext(() => getA());
    const queryB = consumerInjector.runInContext(() => getB());
    await s.settle();

    expect(queryA.response()).toEqual({ id: 'a' });
    expect(queryB.response()).toEqual({ id: 'b' });

    const before = queryDevtoolsEntries().filter((entry) => entry.handle === queryA || entry.handle === queryB);

    expect(before).toHaveLength(2);
    expect(before.every((entry) => !entry.destroyedAt)).toBe(true);

    const ids = before.map((entry) => entry.id);
    const executionsBefore = before.map((entry) => entry.stats?.current().executions);

    consumerInjector.destroy();
    injector.destroy();

    const after = queryDevtoolsEntries().filter((entry) => ids.includes(entry.id));

    expect(after).toHaveLength(2);
    expect(after.every((entry) => !!entry.destroyedAt)).toBe(true);
    expect(after.map((entry) => entry.stats?.current().executions)).toEqual(executionsBefore);

    clearQueryDevtoolsTombstones(ids);

    expect(queryDevtoolsEntries().some((entry) => ids.includes(entry.id))).toBe(false);
  });
});
