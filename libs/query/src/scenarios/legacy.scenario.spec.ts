import { of, Subject } from 'rxjs';
import {
  AnyV2Query,
  BasicAuthProvider,
  CustomHeaderAuthProvider,
  def,
  filterFailure,
  filterQueryStates,
  filterSuccess,
  queryStateErrorSignal,
  queryStateResponseSignal,
  QueryStateType,
  switchQueryState,
  takeUntilResponse,
  toQuerySignal,
  V2BearerAuthProvider,
  V2QueryClient,
  V2QueryClientConfig,
  V2QueryState,
} from '../index';
import { describe, expect, it, vi } from 'vitest';
import { mintToken, Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const GC_INTERVAL = 15_000;

type User = { id: string; name: string };
type Tokens = { token: string; refreshToken: string };

type LegacyClientConfig = Omit<V2QueryClientConfig, 'baseRoute'>;
type TrackFn = <T extends AnyV2Query>(query: T) => T;

const withLegacyClient = (
  s: Scenario,
  config: LegacyClientConfig,
  body: (client: V2QueryClient, track: TrackFn) => void,
) => {
  const owner = s.consumer();
  const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL, ...config }));
  const tracked: AnyV2Query[] = [];

  try {
    body(client, (query) => {
      tracked.push(query);

      return query;
    });
  } finally {
    for (const query of tracked) {
      query.stopPolling();
      query.abort();
    }

    client._store.forEach((query, key) => {
      query.stopPolling();
      query.abort();
      client._store.remove(key);
    });

    client.clearAuthProvider();
    owner.destroy();
  }
};

const distinct = <T>(values: T[]) => values.filter((value, index, all) => value !== all[index - 1]);

/**
 * The request emits its `start` event after `execute()` already published `Loading`, so the raw stream
 * repeats `Loading`. `types()` collapses repeats down to the documented state sequence.
 */
const recordStates = (query: AnyV2Query) => {
  const states: V2QueryState[] = [];
  const subscription = query.state$.subscribe((state: V2QueryState) => states.push(state));

  return {
    states,
    types: () => distinct(states.map((state) => state.type)),
    stop: () => subscription.unsubscribe(),
  };
};

const createGetUser = (client: V2QueryClient) =>
  client.get({
    route: (p) => `/users/${p.id}`,
    types: {
      args: def<{ pathParams: { id: string } }>(),
      response: def<User>(),
    },
  });

describe('legacy scenario', () => {
  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  describe('state stream', () => {
    it('moves from Prepared through Loading to Success', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(createGetUser(client).prepare({ pathParams: { id: '1' } }));
        const recorded = recordStates(query);

        expect(recorded.types()).toEqual([QueryStateType.Prepared]);

        query.execute();
        s.tick();

        expect(recorded.types()).toEqual([QueryStateType.Prepared, QueryStateType.Loading, QueryStateType.Success]);
        expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });
        expect(s.api.requestCount('GET', '/users/1')).toBe(1);

        recorded.stop();
      });
    });

    it('moves to Failure and keeps the status and body of the error', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ status: 404, body: { message: 'not found' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );
        const recorded = recordStates(query);

        s.tick();

        expect(recorded.types()).toEqual([QueryStateType.Loading, QueryStateType.Failure]);
        expect(query.rawState).toMatchObject({
          type: QueryStateType.Failure,
          error: { status: 404, detail: { message: 'not found' } },
        });

        recorded.stop();
      });
    });

    it('moves to Cancelled on abort() and marks the request aborted', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1000 }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(createGetUser(client).prepare({ pathParams: { id: '1' } }));
        const recorded = recordStates(query);

        query.execute();
        s.tick(100);

        expect(s.api.pending()).toHaveLength(1);

        query.abort();

        expect(recorded.types()).toEqual([QueryStateType.Prepared, QueryStateType.Loading, QueryStateType.Cancelled]);
        expect(s.api.requests[0]?.aborted).toBe(true);
        expect(s.api.pending()).toHaveLength(0);

        recorded.stop();
      });
    });

    it('cancels the in-flight request when execute({ cancelPrevious: true }) runs', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1000 }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(createGetUser(client).prepare({ pathParams: { id: '1' } }));
        const recorded = recordStates(query);

        query.execute();
        s.tick(100);
        query.execute({ cancelPrevious: true });
        s.tick(1000);

        expect(recorded.types()).toEqual([
          QueryStateType.Prepared,
          QueryStateType.Loading,
          QueryStateType.Cancelled,
          QueryStateType.Loading,
          QueryStateType.Success,
        ]);
        expect(s.api.requestCount('GET', '/users/1')).toBe(2);
        expect(s.api.requests[0]?.aborted).toBe(true);
        expect(s.api.requests[1]?.aborted).toBe(false);

        recorded.stop();
      });
    });

    it('keeps a second execute() while loading as a no-op without cancelPrevious', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1000 }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick(100);
        query.execute();
        s.tick(1000);

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      });
    });
  });

  describe('operators and signal helpers', () => {
    it('unwraps a successful state with filterSuccess, filterQueryStates and takeUntilResponse', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(createGetUser(client).prepare({ pathParams: { id: '1' } }));
        const responses: User[] = [];
        const loadingStates: V2QueryState[] = [];
        const seenTypes: QueryStateType[] = [];
        let completed = false;

        query.state$.pipe(filterSuccess()).subscribe((state) => responses.push(state.response));
        query.state$
          .pipe(filterQueryStates([QueryStateType.Loading]))
          .subscribe((state) => loadingStates.push(state as V2QueryState));
        query.state$.pipe(takeUntilResponse()).subscribe({
          next: (state) => seenTypes.push(state.type),
          complete: () => (completed = true),
        });

        query.execute();
        s.tick();

        expect(responses).toEqual([{ id: '1', name: 'Ada' }]);
        expect(loadingStates.length).toBeGreaterThanOrEqual(1);
        expect(distinct(seenTypes)).toEqual([QueryStateType.Prepared, QueryStateType.Loading, QueryStateType.Success]);
        expect(completed).toBe(true);
      });
    });

    it('unwraps a failed state with filterFailure and switchQueryState', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ status: 400, body: { message: 'bad request' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(createGetUser(client).prepare({ pathParams: { id: '1' } }));
        const failures: number[] = [];
        const switched: (QueryStateType | null)[] = [];

        query.state$.pipe(filterFailure()).subscribe((state) => failures.push(state.error.status));
        of(query)
          .pipe(switchQueryState())
          .subscribe((state) => switched.push(state?.type ?? null));

        query.execute();
        s.tick();

        expect(failures).toEqual([400]);
        expect(distinct(switched)).toEqual([QueryStateType.Prepared, QueryStateType.Loading, QueryStateType.Failure]);
      });
    });

    it('reads a response through toQuerySignal and queryStateResponseSignal', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();

        const signals = s.run(() => {
          const querySignal = toQuerySignal(of(query as AnyV2Query), { requireSync: true });

          return { response: queryStateResponseSignal(querySignal), error: queryStateErrorSignal(querySignal) };
        });

        s.tick();

        expect(signals.response()).toEqual({ id: '1', name: 'Ada' });
        expect(signals.error()).toBeNull();
      });
    });

    it('reads an error through queryStateErrorSignal', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ status: 400, body: { message: 'bad request' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();

        const signals = s.run(() => {
          const querySignal = toQuerySignal(of(query as AnyV2Query), { requireSync: true });

          return { response: queryStateResponseSignal(querySignal), error: queryStateErrorSignal(querySignal) };
        });

        s.tick();

        expect(signals.response()).toBeNull();
        expect(signals.error()).toMatchObject({ status: 400 });
      });
    });
  });

  describe('caching', () => {
    it('returns the same instance for two prepare() calls with the same args', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client) => {
        const getUser = createGetUser(client);
        const first = getUser.prepare({ pathParams: { id: '1' } });
        const second = getUser.prepare({ pathParams: { id: '1' } });
        const other = getUser.prepare({ pathParams: { id: '2' } });

        expect(second).toBe(first);
        expect(other).not.toBe(first);
      });
    });

    it('serves a cache-control response from cache until it expires', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: 'Ada' },
        headers: { 'cache-control': 'max-age=60' },
      }));

      withLegacyClient(s, {}, (client, track) => {
        const getUser = createGetUser(client);
        const query = track(getUser.prepare({ pathParams: { id: '1' } }).execute());
        const recorded = recordStates(query);

        s.tick();
        expect(s.api.requestCount('GET', '/users/1')).toBe(1);
        expect(query.isExpired).toBe(false);

        getUser.prepare({ pathParams: { id: '1' } }).execute();
        s.tick();
        expect(s.api.requestCount('GET', '/users/1')).toBe(1);

        s.tick(31_000);
        expect(query.isExpired).toBe(true);

        getUser.prepare({ pathParams: { id: '1' } }).execute();
        s.tick();
        expect(s.api.requestCount('GET', '/users/1')).toBe(2);

        recorded.stop();
      });
    });

    it('bypasses the cache with skipCache', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: 'Ada' },
        headers: { 'cache-control': 'max-age=60' },
      }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();
        query.execute({ skipCache: true });
        s.tick();

        expect(s.api.requestCount('GET', '/users/1')).toBe(2);
      });
    });

    it('never caches a POST query', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

      withLegacyClient(s, {}, (client, track) => {
        const createUser = client.post({
          route: '/users',
          types: {
            args: def<{ body: { name: string } }>(),
            response: def<User>(),
          },
        });

        const first = track(createUser.prepare({ body: { name: 'Ada' } }));
        const second = track(createUser.prepare({ body: { name: 'Ada' } }));

        expect(second).not.toBe(first);

        first.execute();
        second.execute();
        s.tick();

        expect(s.api.requestCount('POST', '/users')).toBe(2);
        expect(s.api.requests[0]?.body).toEqual({ name: 'Ada' });
      });
    });

    it('garbage-collects an expired unused query after 15 seconds', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const getUser = createGetUser(client);
        const query = track(getUser.prepare({ pathParams: { id: '1' } }).execute());

        s.tick();
        expect(query.isExpired).toBe(true);
        expect(query.isInUse).toBe(false);
        expect(getUser.prepare({ pathParams: { id: '1' } })).toBe(query);

        s.tick(GC_INTERVAL);

        expect(getUser.prepare({ pathParams: { id: '1' } })).not.toBe(query);
      });
    });

    it('keeps an unexpired unused query across a collector run', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: 'Ada' },
        headers: { 'cache-control': 'max-age=600' },
      }));

      withLegacyClient(s, {}, (client, track) => {
        const getUser = createGetUser(client);
        const query = track(getUser.prepare({ pathParams: { id: '1' } }).execute());

        s.tick();
        s.tick(GC_INTERVAL);

        expect(query.isExpired).toBe(false);
        expect(getUser.prepare({ pathParams: { id: '1' } })).toBe(query);
      });
    });
  });

  describe('auto refresh on window focus', () => {
    const blurThenFocus = (s: Scenario) => {
      window.dispatchEvent(new Event('blur'));
      s.tick(5_000);
      s.tick(GC_INTERVAL + 1);
      window.dispatchEvent(new Event('focus'));
      s.tick();
    };

    it('re-executes a query in use when the window regains focus', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );
        const recorded = recordStates(query);

        s.tick();
        expect(s.api.requestCount('GET', '/users/1')).toBe(1);

        blurThenFocus(s);

        expect(s.api.requestCount('GET', '/users/1')).toBe(2);
        expect(query.rawState.meta.triggeredVia).toBe('auto');

        recorded.stop();
      });
    });

    it('does not re-execute when the client disables autoRefreshQueriesOnWindowFocus', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, { request: { autoRefreshQueriesOnWindowFocus: false } }, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );
        const recorded = recordStates(query);

        s.tick();
        blurThenFocus(s);

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);

        recorded.stop();
      });
    });

    it('does not re-execute a query with autoRefreshOn.windowFocus false', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const getUser = client.get({
          route: (p) => `/users/${p.id}`,
          autoRefreshOn: { windowFocus: false },
          types: {
            args: def<{ pathParams: { id: string } }>(),
            response: def<User>(),
          },
        });
        const query = track(getUser.prepare({ pathParams: { id: '1' } }).execute());
        const recorded = recordStates(query);

        s.tick();
        blurThenFocus(s);

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);

        recorded.stop();
      });
    });

    it('does not re-execute a query that nothing is using', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: 'Ada' },
        headers: { 'cache-control': 'max-age=600' },
      }));

      withLegacyClient(s, {}, (client, track) => {
        track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();
        blurThenFocus(s);

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      });
    });
  });

  describe('polling', () => {
    it('keeps its interval and stops on stopPolling()', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const stopPolling$ = new Subject<void>();
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();
        query.poll({ interval: 1_000, takeUntil: stopPolling$ });

        s.tick(2_000);
        expect(s.api.requestCount('GET', '/users/1')).toBe(2);

        s.tick(1_000);
        expect(s.api.requestCount('GET', '/users/1')).toBe(3);

        query.stopPolling();
        s.tick(5_000);

        expect(query.isPolling).toBe(false);
        expect(s.api.requestCount('GET', '/users/1')).toBe(3);
      });
    });

    it('pauses while the window is blurred and resumes on focus', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const stopPolling$ = new Subject<void>();
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();
        query.poll({ interval: 1_000, takeUntil: stopPolling$ });
        s.tick(2_000);
        expect(s.api.requestCount('GET', '/users/1')).toBe(2);

        window.dispatchEvent(new Event('blur'));
        s.tick(5_000);

        const whilePaused = s.api.requestCount('GET', '/users/1');

        expect(query.isPolling).toBe(false);

        s.tick(5_000);
        expect(s.api.requestCount('GET', '/users/1')).toBe(whilePaused);

        window.dispatchEvent(new Event('focus'));
        s.tick(1_000);

        expect(query.isPolling).toBe(true);
        expect(s.api.requestCount('GET', '/users/1')).toBe(whilePaused + 1);

        query.stopPolling();
      });
    });

    it('keeps polling while blurred when enableSmartPolling is false', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, { request: { enableSmartPolling: false } }, (client, track) => {
        const stopPolling$ = new Subject<void>();
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();
        query.poll({ interval: 1_000, takeUntil: stopPolling$ });

        window.dispatchEvent(new Event('blur'));
        s.tick(6_000);

        expect(query.isPolling).toBe(true);
        expect(s.api.requestCount('GET', '/users/1')).toBe(6);

        query.stopPolling();
      });
    });
  });

  describe('auth', () => {
    const createSecureQuery = (client: V2QueryClient) =>
      client.get({
        route: '/secure',
        secure: true,
        types: { response: def<{ ok: boolean }>() },
      });

    const createRefreshQuery = (client: V2QueryClient) =>
      client.post({
        route: '/auth/refresh',
        types: {
          args: def<{ body: { refreshToken: string } }>(),
          response: def<Tokens>(),
        },
      });

    it('throws when a secure query runs without an auth provider', () => {
      const s = scenario();
      s.api.on('GET', '/secure', () => ({ body: { ok: true } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(createSecureQuery(client).prepare());

        expect(() => query.execute()).toThrow('Cannot execute secure query without auth provider');
        expect(query.rawState.type).toBe(QueryStateType.Prepared);
        expect(s.api.requests).toHaveLength(0);
      });
    });

    it('sends the bearer header of a V2BearerAuthProvider', () => {
      const s = scenario();
      const token = mintToken({ claims: { scope: 'admin' } });

      s.api.on('GET', '/secure', () => ({ body: { ok: true } }));
      s.api.protect('/secure', ({ claims }) => claims['scope'] === 'admin');

      withLegacyClient(s, {}, (client, track) => {
        client.setAuthProvider(
          new V2BearerAuthProvider({
            token,
            refreshConfig: { queryCreator: createRefreshQuery(client), token: mintToken() },
          }),
        );

        const query = track(createSecureQuery(client).prepare().execute());

        s.tick();

        expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { ok: true } });
        expect(s.api.requests[0]?.headers.get('Authorization')).toBe(`Bearer ${token}`);
      });
    });

    it('refreshes and retries once a secure query gets a 401', () => {
      const s = scenario();
      const staleToken = mintToken();
      const freshToken = mintToken({ claims: { scope: 'admin' } });

      s.api.on('GET', '/secure', () => ({ body: { ok: true } }));
      s.api.protect('/secure', ({ claims }) => claims['scope'] === 'admin');
      s.api.on('POST', '/auth/refresh', () => ({ body: { token: freshToken, refreshToken: mintToken() } }));

      withLegacyClient(s, {}, (client, track) => {
        client.setAuthProvider(
          new V2BearerAuthProvider({
            token: staleToken,
            refreshConfig: { queryCreator: createRefreshQuery(client), token: mintToken() },
          }),
        );

        const query = track(createSecureQuery(client).prepare().execute());

        s.flush();

        expect(s.api.requests.map((r) => `${r.method} ${r.path} ${r.status}`)).toEqual([
          'GET /secure 401',
          'POST /auth/refresh 200',
          'GET /secure 200',
        ]);
        expect(s.api.requests[2]?.headers.get('Authorization')).toBe(`Bearer ${freshToken}`);
        expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { ok: true } });
      });
    });

    it('sends the basic auth header of a BasicAuthProvider', () => {
      const s = scenario();
      s.api.on('GET', '/secure', () => ({ body: { ok: true } }));

      withLegacyClient(s, {}, (client, track) => {
        client.setAuthProvider(new BasicAuthProvider({ username: 'ada', password: 'lovelace' }));

        track(createSecureQuery(client).prepare().execute());
        s.tick();

        expect(s.api.requests[0]?.headers.get('Authorization')).toBe(`Basic ${btoa('ada:lovelace')}`);
      });
    });

    it('sends the configured header of a CustomHeaderAuthProvider', () => {
      const s = scenario();
      s.api.on('GET', '/secure', () => ({ body: { ok: true } }));

      withLegacyClient(s, {}, (client, track) => {
        client.setAuthProvider(new CustomHeaderAuthProvider({ name: 'X-Api-Key', value: 'secret' }));

        track(createSecureQuery(client).prepare().execute());
        s.tick();

        expect(s.api.requests[0]?.headers.get('X-Api-Key')).toBe('secret');
      });
    });
  });

  describe('teardown', () => {
    it('stops the garbage collector and window focus handling when the owning injector is destroyed', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const owner = s.consumer();
      const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL }));
      const query = owner.run(() =>
        createGetUser(client)
          .prepare({ pathParams: { id: '1' } })
          .execute(),
      );
      const recorded = recordStates(query);

      s.tick();
      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(query.isInUse).toBe(true);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      owner.destroy();
      s.tick();

      expect(vi.getTimerCount()).toBe(0);

      window.dispatchEvent(new Event('blur'));
      s.tick(5_000);
      s.tick(GC_INTERVAL + 1);
      window.dispatchEvent(new Event('focus'));
      s.tick();

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);

      recorded.stop();
      query.abort();
    });
  });
});
