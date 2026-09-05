import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
  Component,
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBearerAuthProvider,
  createGetQuery,
  createLegacyQueryCreator,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  EntityStore,
  isQueryDevtoolsEnabled,
  provideLegacyPrepareFallback,
  provideQueryDevtools,
  queryDevtoolsEntries,
  queryErrorMessage,
  queryErrorMessages,
  QueryStateType,
  withArgs,
  withAuthenticationQuery,
  withPersistentAuth,
  withRefreshQuery,
} from '../index';
import { mintToken, Scenario, ScenarioAuthBuilders, sequence, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const PERSISTENT_PROVIDER_NAME = 'migration-persistent-auth';
const COOKIE_NAME = 'etAuth';

type User = { id: string; name: string };
type GetUserArgs = { response: User; pathParams: { id: string } };
type TokenArgs = { body: { token?: string }; response: { accessToken: string; refreshToken: string } };
type Profile = { response: { id: string } };

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

const previewToken = signal<string | null>(null);

let bootCounter = 0;

const tokenPair = () => ({
  accessToken: mintToken({ expiresInMs: 15 * 60 * 1000 }),
  refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
});

describe('migrating from v2 scenario', () => {
  describe('provideHttpClient is now your job', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
      // Nothing may leave the machine if the default backend does answer this query, and the rejection
      // it then reports is the point of the test rather than an error to read.
      globalThis.fetch = (() => Promise.reject(new Error('no network in a scenario test'))) as typeof fetch;
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      TestBed.resetTestingModule();
      globalThis.fetch = originalFetch;
      vi.mocked(console.error).mockRestore();
      vi.useRealTimers();
    });

    // migrating-from-v2.md:43 says @ethlete/query never provides HttpClient, so an app without
    // provideHttpClient() throws on its first request. Angular 22 provides HttpClient, HttpHandler and
    // HttpBackend in root itself, so the request goes out over the default fetch backend instead.
    it.fails('a client without provideHttpClient throws on the first request instead of at construction', () => {
      TestBed.configureTestingModule({ providers: [] });

      const clientRef = createQueryClient({ name: 'migration-no-http-client', baseUrl: BASE_URL, keepUnusedFor: 0 });
      const getUser = createGetQuery(clientRef)<{ response: User }>('/users/1');
      const query = TestBed.runInInjectionContext(() => getUser({ onlyManualExecution: true }));

      expect(clientRef).toBeTruthy();
      expect(() => query.execute()).toThrow(/HttpClient/);
    });
  });

  describe('configure the auth provider', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('reads the token lifetime from expiresInPropertyName instead of the JWT exp', async () => {
      const s = scenario();

      expect(isQueryDevtoolsEnabled()).toBe(false);

      const tokenLifetimeMs = 600_000;
      const pair = () => ({
        accessToken: mintToken({
          expiresInMs: 100 * 60 * 1000,
          claims: { validUntil: Math.floor((Date.now() + tokenLifetimeMs) / 1000) },
        }),
        refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
      });

      s.api.on('POST', '/auth/login', () => ({ body: pair() }));
      s.api.on('POST', '/auth/refresh', () => ({ body: pair() }));

      const auth = s.auth({ expiresInPropertyName: 'validUntil', refreshStrategy: 0.75 });

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      expect(auth.isAuthenticated()).toBe(true);

      // 75% of the 600s `validUntil` lifetime, not of the 100 minute `exp` one.
      s.tick(448_000);
      expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

      s.tick(3_000);
      await s.settle();

      expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);

      c.destroy();
    });

    it('injects a client and an auth provider that were never listed in providers', async () => {
      const s = scenario();

      s.api.on('POST', '/auth/login', () => ({ body: tokenPair() }));
      s.api.on('POST', '/auth/refresh', () => ({ body: tokenPair() }));
      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/me', () => ({ body: { id: 'me' } }));

      const clientRef = createQueryClient({ name: 'migration-implicit-client', baseUrl: BASE_URL, keepUnusedFor: 0 });
      const post = createPostQuery(clientRef);
      const authRef = createBearerAuthProvider({
        name: 'migration-implicit-auth',
        queryClientRef: clientRef,
        queries: [
          withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
          withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh') }),
        ] as unknown as ScenarioAuthBuilders,
        features: [] as unknown as readonly [],
      });
      const getMe = createSecureGetQuery(clientRef, authRef)<Profile>('/secure/me');

      const c = s.consumer();
      const auth = c.run(() => authRef.inject());

      expect(auth).toBeTruthy();

      c.run(() => auth?.queries.login.execute({ body: {} }));
      await s.settle();

      const query = c.run(() => getMe());
      s.flush();
      await s.settle();

      expect(query.response()).toEqual({ id: 'me' });

      c.destroy();
    });
  });

  describe('default headers move onto the client', () => {
    const scenario = useScenario({
      clientOptions: {
        keepUnusedFor: 0,
        headers: () => {
          const token = previewToken();

          return token
            ? new HttpHeaders({ 'X-Client': 'api', 'X-Preview-Token': token })
            : new HttpHeaders({ 'X-Client': 'api' });
        },
      },
    });

    beforeEach(() => previewToken.set(null));

    it('a per-execution header overrides the client header of the same name and leaves the others', () => {
      const s = scenario();
      s.api.on('GET', '/preview', ({ headers }) => ({
        body: { client: headers.get('X-Client'), preview: headers.get('X-Preview-Token') },
      }));

      previewToken.set('from-client');

      const getPreview = s.get<{
        response: { client: string | null; preview: string | null };
        headers: HttpHeaders;
      }>('/preview');

      const c = s.consumer();
      const query = c.run(() =>
        getPreview(withArgs(() => ({ headers: new HttpHeaders({ 'X-Preview-Token': 'per-query' }) }))),
      );

      s.tick();

      expect(query.response()).toEqual({ client: 'api', preview: 'per-query' });

      c.destroy();
    });

    it('changing a client header serves the cached response instead of re-fetching', () => {
      const s = scenario();
      s.api.on('GET', '/preview', ({ headers }) => ({ body: { preview: headers.get('X-Preview-Token') } }));

      const getPreview = s.get<{ response: { preview: string | null } }>('/preview');

      const c = s.consumer();
      const query = c.run(() => getPreview());

      s.tick();

      const keyBefore = s.client.repository.subtle.cacheEntries().map((entry) => entry.key);

      expect(query.response()).toEqual({ preview: null });
      expect(keyBefore).toHaveLength(1);

      previewToken.set('tok');
      s.tick();

      expect(s.api.requestCount('GET', '/preview')).toBe(1);
      expect(query.response()).toEqual({ preview: null });

      s.client.refreshQueriesInUse();
      s.tick();

      expect(s.api.requestCount('GET', '/preview')).toBe(2);
      expect(s.api.requests[1]?.headers.get('X-Preview-Token')).toBe('tok');
      expect(query.response()).toEqual({ preview: 'tok' });
      expect(s.client.repository.subtle.cacheEntries().map((entry) => entry.key)).toEqual(keyBefore);

      c.destroy();
    });

    it('refreshQueriesInUse re-runs a bound HEAD and OPTIONS, and restarts one already in flight', () => {
      const s = scenario();
      s.api.on('GET', '/slow', () => ({ body: { ok: true }, delay: 1_000 }));
      s.api.on('HEAD', '/assets/poster', () => ({ headers: { 'content-length': '512' } }));
      s.api.on('OPTIONS', '/uploads', () => ({ body: { allow: ['POST'] } }));

      const getSlow = s.get<{ response: { ok: boolean } }>('/slow');
      const headAsset = s.head<{ response: null }>('/assets/poster');
      const optionsUploads = s.options<{ response: { allow: string[] } }>('/uploads');

      const c = s.consumer();
      const slow = c.run(() => getSlow());
      c.run(() => headAsset());
      c.run(() => optionsUploads());

      s.tick(100);

      expect(s.api.requestCount('GET', '/slow')).toBe(1);
      expect(s.api.requestCount('HEAD', '/assets/poster')).toBe(1);
      expect(s.api.requestCount('OPTIONS', '/uploads')).toBe(1);

      s.client.refreshQueriesInUse();
      s.tick();

      expect(s.api.requests[0]?.aborted).toBe(true);
      expect(s.api.requestCount('GET', '/slow')).toBe(2);
      expect(s.api.requestCount('HEAD', '/assets/poster')).toBe(2);
      expect(s.api.requestCount('OPTIONS', '/uploads')).toBe(2);

      s.flush();

      expect(slow.response()).toEqual({ ok: true });

      c.destroy();
    });
  });

  describe('templates read signals, not directives', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('executionState separates a first load from a revalidation that still has a cached response', () => {
      const s = scenario();
      s.api.on(
        'GET',
        '/report',
        sequence([
          { body: { n: 1 }, delay: 100 },
          { body: { n: 2 }, delay: 100 },
        ]),
      );

      const getReport = s.get<{ response: { n: number } }>('/report');

      const c = s.consumer();
      const query = c.run(() => getReport());

      s.tick(50);

      expect(query.executionState()).toMatchObject({ type: 'loading', hasCachedResponse: false });

      s.tick(60);

      expect(query.executionState()).toMatchObject({ type: 'success', response: { n: 1 } });

      query.execute();
      s.tick(50);

      expect(query.executionState()).toMatchObject({
        type: 'loading',
        hasCachedResponse: true,
        cachedResponse: { n: 1 },
      });

      s.tick(60);

      expect(query.executionState()).toMatchObject({ type: 'success', response: { n: 2 } });

      c.destroy();
    });

    it('flattens a single message and a violation list into the same string array, first one first', () => {
      const s = scenario();
      s.api.on('GET', '/single', () => ({ status: 422, body: { message: 'nope' } }));
      s.api.on('GET', '/list', () => ({ status: 422, body: ['too short', 'already taken'] }));

      const getSingle = s.get<{ response: unknown }>('/single');
      const getList = s.get<{ response: unknown }>('/list');

      const c = s.consumer();
      const single = c.run(() => getSingle());
      const list = c.run(() => getList());

      s.flush();

      expect(queryErrorMessages(single.error())).toEqual(['nope']);
      expect(queryErrorMessage(single.error())).toBe('nope');
      expect(queryErrorMessages(list.error())).toEqual(['too short', 'already taken']);
      expect(queryErrorMessage(list.error())).toBe('too short');
      expect(queryErrorMessages(null)).toEqual([]);
      expect(queryErrorMessage(null)).toBeNull();

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
      c.destroy();
    });
  });

  describe('prepare() needs an injector', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('an unnamed creator is reported in ET950 by its method and route', () => {
      const s = scenario();
      s.api.on('GET', '/person', () => ({ body: [] }));

      const findPeople = s.get<{ response: User[] }>('/person');
      const legacyFindPeople = createLegacyQueryCreator({ creator: findPeople });

      expect(() => legacyFindPeople.prepare({})).toThrow(/950/);
      expect(() => legacyFindPeople.prepare({})).toThrow(/"GET \/person"/);
      expect(s.api.requests).toHaveLength(0);
    });

    it('a missing provider inside prepare surfaces as its own DI error, not as ET950', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ body: { id: '1', name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });
      const providerLessInjector = Injector.create({ providers: [] });

      let thrown: unknown = null;

      try {
        legacyGetUser.prepare({ pathParams: { id: '1' }, injector: providerLessInjector });
      } catch (error) {
        thrown = error;
      }

      expect(String(thrown)).toMatch(/NG0201|No provider/);
      expect(String(thrown)).not.toMatch(/950/);
      expect(s.api.requests).toHaveLength(0);
    });

    it('createSubject and behaviorSubject throw the named ET950 without an injector and run with one', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      expect(() => legacyGetUser.createSubject(null)).toThrow(/950/);
      expect(() => legacyGetUser.createSubject(null)).toThrow(/"legacyGetUser"/);
      expect(() => legacyGetUser.behaviorSubject(null)).toThrow(/950/);

      const c = s.consumer();
      const container = legacyGetUser.behaviorSubject(null, { injector: c.injector });
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());

      container.next(query);
      s.tick();

      expect(container.getValue()).toBe(query);
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });

      c.destroy();
    });
  });

  describe('opting out of the requirement entirely', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: () => [provideLegacyPrepareFallback()],
    });

    it('a fallback-prepared query outlives the component that made it until destroyOnResponse ends it', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1_000 }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const component = s.consumer();
      const outlives = legacyGetUser.prepare({ pathParams: { id: '1' } }).execute();

      s.tick(100);
      component.destroy();
      s.tick();

      expect(s.api.requests[0]?.aborted).toBe(false);

      s.tick(1_000);

      expect(outlives.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(1);

      outlives.destroy();

      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);

      const selfEnding = legacyGetUser
        .prepare({ pathParams: { id: '2' }, config: { destroyOnResponse: true } })
        .execute();

      s.flush();

      expect(selfEnding.rawState.type).toBe(QueryStateType.Success);
      expect(s.client.repository.subtle.cacheEntries()).toHaveLength(0);
    });
  });

  describe('the prepare fallback on the server', () => {
    const warn = vi.fn();

    beforeEach(() => {
      warn.mockClear();
      vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => warn(...args));
    });

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: () => [provideLegacyPrepareFallback(), { provide: PLATFORM_ID, useValue: 'server' }],
    });

    afterEach(() => vi.mocked(console.warn).mockRestore());

    it('the prepare fallback refuses to stash a root injector on the server and still throws ET950', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ body: { id: '1', name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      expect(() => legacyGetUser.prepare({ pathParams: { id: '1' } })).toThrow(/950/);
      expect(s.api.requests).toHaveLength(0);
      expect(String(warn.mock.calls[0]?.[0])).toContain('server');
    });
  });

  describe('behavior worth knowing before you debug it', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('a secure query created before any login parks and runs itself once the first token lands', async () => {
      const s = scenario();
      const auth = s.auth();

      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/me', () => ({ body: { id: 'me' } }));

      const getMe = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/me');

      const c = s.consumer();
      const query = c.run(() => getMe());

      s.tick();

      expect(s.api.requests).toHaveLength(0);
      expect(query.error()).toBeNull();
      expect(query.executionState()?.type).toBe('loading');

      c.run(() => auth.queries.login.execute({ body: {} }));
      s.flush();
      await s.settle();

      expect(s.api.requestCount('GET', '/secure/me')).toBe(1);
      expect(query.response()).toEqual({ id: 'me' });

      c.destroy();
    });

    // migrating-from-v2.md:201 promises the response survives a failed refresh, but the secure execute
    // path clears it when the auth query it waits on is the failed refresh.
    it.fails('keeps the last response when the refresh behind a re-execution fails', async () => {
      const s = scenario();
      const auth = s.auth({ onRefreshFailure: () => undefined });

      s.api.protect('/secure/**');
      s.api.on('GET', '/secure/me', () => ({ body: { id: 'me' } }));

      const getMe = createSecureGetQuery(s.clientRef, auth.ref)<Profile>('/secure/me');

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      const query = c.run(() => getMe());
      s.flush();
      await s.settle();

      expect(query.response()).toEqual({ id: 'me' });

      s.api.once('POST', '/auth/refresh', () => ({ status: 400, body: { message: 'refresh rejected' } }));
      c.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken() ?? '' } }));
      s.flush();
      await s.settle();

      query.execute();
      s.flush();
      await s.settle();

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
      c.destroy();

      expect(query.response()).toEqual({ id: 'me' });
    });

    it('an interop GET container aborts its superseded query', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1_000 }));

      const legacyGetUser = createLegacyQueryCreator({
        creator: s.get<GetUserArgs>((p) => `/users/${p.id}`),
        name: 'legacyGetUser',
      });

      const c = s.consumer();
      const container = legacyGetUser.createSignal(null, { injector: c.injector });
      const first = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());

      container.set(first);
      s.tick(100);

      expect(s.api.pending()).toHaveLength(1);

      const second = c.run(() => legacyGetUser.prepare({ pathParams: { id: '2' } }));

      container.set(second);
      s.tick();

      expect(s.api.requests.find((request) => request.path === '/users/1')?.aborted).toBe(true);
      expect(s.api.pending()).toHaveLength(0);
      expect(second.rawState.type).toBe(QueryStateType.Prepared);

      c.destroy();
    });

    // migrating-from-v2.md:202 defaults the container cleanup to "on for cacheable requests", but the
    // container destroys every superseded query it held, which cancels an uncacheable POST too.
    it.fails('an interop POST container leaves its superseded query alone', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body, delay: 1_000 }));

      const legacyCreateUser = createLegacyQueryCreator({
        creator: s.post<{ body: { name: string }; response: User }>('/users'),
        name: 'legacyCreateUser',
      });

      const c = s.consumer();
      const container = legacyCreateUser.createSignal(null, { injector: c.injector });
      const first = c.run(() => legacyCreateUser.prepare({ body: { name: 'Ada' } }).execute());

      container.set(first);
      s.tick(100);

      expect(s.api.pending()).toHaveLength(1);

      const second = c.run(() => legacyCreateUser.prepare({ body: { name: 'Grace' } }));

      container.set(second);
      s.tick();

      const aborted = s.api.requests.find((request) => request.method === 'POST')?.aborted;

      s.flush();
      c.destroy();
      first.destroy();
      second.destroy();

      expect(aborted).toBe(false);
    });

    it('an entity set runs on a 204 with a null body and never on prepare or on a failure', () => {
      const s = scenario();
      s.api.on('GET', '/users/empty', () => ({ status: 204 }));
      s.api.on('GET', '/users/:id', sequence([{ body: { id: '1', name: 'Ada' } }, { status: 500, body: {} }]));

      const store = new EntityStore<User>({ name: 'migration-users' });
      const calls: { id: string; response: User | null }[] = [];
      const legacyGetUser = createLegacyQueryCreator({
        creator: s.get<GetUserArgs>((p) => `/users/${p.id}`),
        name: 'legacyGetUser',
        entity: {
          store,
          id: ({ args }) => args.pathParams.id,
          set: ({ id, response }) => calls.push({ id, response }),
        },
      });

      const c = s.consumer();
      const prepared = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }));

      s.tick();

      expect(calls).toEqual([]);

      prepared.execute();
      s.tick();

      expect(calls).toEqual([{ id: '1', response: { id: '1', name: 'Ada' } }]);

      prepared.execute({ skipCache: true });
      s.flush();

      expect(prepared.rawState.type).toBe(QueryStateType.Failure);
      expect(calls).toHaveLength(1);

      const empty = c.run(() => legacyGetUser.prepare({ pathParams: { id: 'empty' } }).execute());
      s.tick();

      expect(empty.rawState.type).toBe(QueryStateType.Success);
      expect(calls).toEqual([
        { id: '1', response: { id: '1', name: 'Ada' } },
        { id: 'empty', response: null },
      ]);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      c.destroy();
    });
  });

  describe('withPersistentAuth calls tryLogin during setup', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: () => [provideRouter([{ path: '**', children: [] }])],
    });

    beforeEach(() => {
      document.cookie = `${COOKIE_NAME}=; max-age=0; path=/`;
      localStorage.removeItem(`${COOKIE_NAME}-rememberMe`);
    });

    const boot = (s: Scenario) => {
      const clientRef = createQueryClient({
        name: `migration-persistent-client-${++bootCounter}`,
        baseUrl: BASE_URL,
        keepUnusedFor: 0,
      });
      const post = createPostQuery(clientRef);
      const authRef = createBearerAuthProvider({
        name: PERSISTENT_PROVIDER_NAME,
        queryClientRef: clientRef,
        queries: [
          withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
          withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh'), refreshStrategy: 0.5 }),
        ] as unknown as ScenarioAuthBuilders,
        features: [
          withPersistentAuth<ScenarioAuthBuilders>({
            autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
          }),
        ] as unknown as readonly [],
      });

      const injector = createEnvironmentInjector(
        [...clientRef.provide(), ...authRef.provide()],
        s.run(() => inject(EnvironmentInjector)),
      );
      const auth = injector.runInContext(() => authRef.inject());

      if (!auth) throw new Error('migrating-from-v2 scenario: failed to create the auth provider');

      return { auth, destroy: () => injector.destroy() };
    };

    // migrating-from-v2.md:199 says a failed restore surfaces as autoLogin/error, but the default
    // refresh-failure handling logs out and overwrites it with logout/success.
    it.fails('a rejected cookie restore ends in executionState autoLogin/error', async () => {
      const s = scenario();

      s.api.on('POST', '/auth/login', () => ({ body: tokenPair() }));
      s.api.on('POST', '/auth/refresh', () => ({ body: tokenPair() }));

      const first = boot(s);
      first.auth.queries.login.execute({ body: {} });
      await s.settle();
      first.destroy();

      expect(document.cookie).toContain(`${COOKIE_NAME}=`);

      s.api.once('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'expired' } }));

      const second = boot(s);
      await s.settle();
      s.flush();
      await s.settle();

      expect(second.auth.isAuthenticated()).toBe(false);

      s.expectError(is401);
      second.destroy();

      expect(second.auth.executionState()).toMatchObject({ type: 'autoLogin', state: 'error' });
    });
  });

  describe('devtools keep their markup', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: () => [provideQueryDevtools(), provideLegacyPrepareFallback()],
    });

    it('a single provideQueryDevtools registers two clients and their auth providers', async () => {
      const s = scenario();

      expect(isQueryDevtoolsEnabled()).toBe(true);

      s.api.on('POST', '/auth/login', () => ({ body: tokenPair() }));
      s.api.on('POST', '/auth/refresh', () => ({ body: tokenPair() }));
      s.api.on('GET', '/one', () => ({ body: { n: 1 } }));
      s.api.on('GET', '/two', () => ({ body: { n: 2 } }));

      const bootClient = (name: string, route: '/one' | '/two') => {
        const clientRef = createQueryClient({ name, baseUrl: BASE_URL, keepUnusedFor: 0 });
        const post = createPostQuery(clientRef);
        const authRef = createBearerAuthProvider({
          name: `${name}-auth`,
          queryClientRef: clientRef,
          queries: [
            withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
            withRefreshQuery('refresh', { queryCreator: post<TokenArgs>('/auth/refresh') }),
          ] as unknown as ScenarioAuthBuilders,
          features: [] as unknown as readonly [],
        });

        return { get: createGetQuery(clientRef)<{ response: { n: number } }>(route), authRef };
      };

      const one = bootClient('migration-devtools-one', '/one');
      const two = bootClient('migration-devtools-two', '/two');

      const c = s.consumer();
      c.run(() => one.authRef.inject());
      c.run(() => two.authRef.inject());
      c.run(() => one.get());
      c.run(() => two.get());

      s.tick();

      const entries = queryDevtoolsEntries();
      const clientNames = entries
        .filter((entry) => entry.kind === 'query')
        .map((entry) => entry.meta.clientName)
        .filter((name) => name?.startsWith('migration-devtools-'));
      const providerNames = entries
        .filter((entry) => entry.kind === 'auth-provider')
        .map((entry) => entry.meta.name)
        .filter((name) => name?.startsWith('migration-devtools-'));

      expect(new Set(clientNames)).toEqual(new Set(['migration-devtools-one', 'migration-devtools-two']));
      expect(new Set(providerNames)).toEqual(new Set(['migration-devtools-one-auth', 'migration-devtools-two-auth']));

      c.destroy();
    });

    it('a fallback-prepared query reaches the devtools without a host element', () => {
      const s = scenario();

      expect(isQueryDevtoolsEnabled()).toBe(true);

      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const fixture = TestBed.createComponent(PrepareHost);
      fixture.detectChanges();

      const inComponent = legacyGetUser.prepare({
        pathParams: { id: '1' },
        injector: fixture.componentRef.injector,
      });
      const viaFallback = legacyGetUser.prepare({ pathParams: { id: '2' } });

      const elementOf = (handle: unknown) =>
        queryDevtoolsEntries().find((entry) => entry.handle === handle)?.meta.element;

      expect(elementOf(inComponent.newQuery)).toBeInstanceOf(HTMLElement);
      expect(elementOf(viaFallback.newQuery)).toBeNull();

      inComponent.destroy();
      viaFallback.destroy();
      fixture.destroy();
    });
  });
});

@Component({ template: '' })
class PrepareHost {}
