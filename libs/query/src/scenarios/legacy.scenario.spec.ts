import { Component, createEnvironmentInjector, EnvironmentInjector, inject, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { form, schema } from '@angular/forms/signals';
import { map, of, Subject } from 'rxjs';
import {
  AnyInfinityQueryConfig,
  AnyV2Query,
  BasicAuthProvider,
  createInfinityQueryConfig,
  CustomHeaderAuthProvider,
  def,
  EntityStore,
  filterFailure,
  filterQueryStates,
  filterSuccess,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  provideQueryClientForDevtools,
  QUERY_CLIENT_DEVTOOLS_TOKEN,
  QueryDirective,
  QueryField,
  QueryForm,
  queryStateErrorSignal,
  queryStateResponseSignal,
  QueryStateType,
  SERVER_VIOLATION_ERROR_KIND,
  switchQueryState,
  takeUntilResponse,
  toQuerySignal,
  V2BearerAuthProvider,
  V2QueryClient,
  V2QueryClientConfig,
  V2QueryState,
  validateWithV2Query,
  withArgs,
} from '../index';
import { describe, expect, it, vi } from 'vitest';
import { mintToken, Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const GC_INTERVAL = 15_000;

const GET_POSTS = 'query GetPosts($limit: Int) { posts(limit: $limit) { id } }';
const CREATE_POST = 'mutation CreatePost($title: String!) { createPost(title: $title) { id } }';

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

@Component({
  imports: [QueryDirective],
  template: `
    <p
      *etQuery="
        query();
        let user;
        let loading = loading;
        let refreshing = refreshing;
        let error = error;
        let progress = progress
      "
    >
      <span data-slot="name">{{ user?.name ?? '-' }}</span>
      <span data-slot="loading">{{ loading }}</span>
      <span data-slot="refreshing">{{ refreshing }}</span>
      <span data-slot="error">{{ error?.status ?? '-' }}</span>
      <span data-slot="progress">{{ progress?.percentage ?? '-' }}</span>
    </p>
  `,
})
class QueryDirectiveHost {
  query = input.required<AnyV2Query | null>();
}

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div
      *etInfinityQuery="
        config();
        let items;
        let canLoadMore = canLoadMore;
        let currentPage = currentPage;
        let totalPages = totalPages
      "
    >
      <span data-slot="items">{{ ids(items) }}</span>
      <span data-slot="canLoadMore">{{ canLoadMore }}</span>
      <span data-slot="currentPage">{{ currentPage }}</span>
      <span data-slot="totalPages">{{ totalPages }}</span>
      @if (canLoadMore) {
        <button data-slot="more" etInfinityQueryTrigger type="button">more</button>
      }
    </div>
  `,
})
class InfinityQueryHost {
  config = input.required<AnyInfinityQueryConfig>();

  ids = (items: { id: string }[] | null) => (items ?? []).map((item) => item.id).join(',');
}

const slotText = (fixture: { nativeElement: HTMLElement }, slot: string) =>
  (fixture.nativeElement.querySelector(`[data-slot="${slot}"]`)?.textContent ?? '').trim();

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

    it('does not re-execute on a focus that follows a short blur', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );

        s.tick();

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);

        window.dispatchEvent(new Event('blur'));
        s.tick(3_000);
        window.dispatchEvent(new Event('focus'));
        s.tick();

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);
        expect(query.rawState.meta.triggeredVia).toBe('program');
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
        expect(s.api.requestCount('GET', '/users/1')).toBe(3);

        s.tick(1_000);
        expect(s.api.requestCount('GET', '/users/1')).toBe(4);

        query.stopPolling();
        s.tick(5_000);

        expect(query.isPolling).toBe(false);
        expect(s.api.requestCount('GET', '/users/1')).toBe(4);
      });
    });

    it('executes a polled query immediately when triggerImmediately is set', () => {
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

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);

        query.poll({ interval: 1_000, triggerImmediately: true, takeUntil: stopPolling$ });
        s.tick(1);

        expect(s.api.requestCount('GET', '/users/1')).toBe(2);

        s.tick(1_000);

        expect(s.api.requestCount('GET', '/users/1')).toBe(3);

        query.stopPolling();
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
        expect(s.api.requestCount('GET', '/users/1')).toBe(3);

        window.dispatchEvent(new Event('blur'));
        s.tick(5_000);

        const whilePaused = s.api.requestCount('GET', '/users/1');

        expect(query.isPolling).toBe(false);

        s.tick(5_000);
        expect(s.api.requestCount('GET', '/users/1')).toBe(whilePaused);

        window.dispatchEvent(new Event('focus'));
        s.tick(1);

        expect(query.isPolling).toBe(true);
        expect(s.api.requestCount('GET', '/users/1')).toBe(whilePaused + 1);

        s.tick(1_000);

        expect(s.api.requestCount('GET', '/users/1')).toBe(whilePaused + 2);

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
        expect(s.api.requestCount('GET', '/users/1')).toBe(7);

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

  describe('method helpers', () => {
    it('builds and executes a put, a patch and a delete creator', () => {
      const s = scenario();
      s.api.on('PUT', '/users/:id', ({ params, body }) => ({
        body: { id: params['id'], name: (body as { name: string }).name },
      }));
      s.api.on('PATCH', '/users/:id', ({ params, body }) => ({
        body: { id: params['id'], name: (body as { name: string }).name },
      }));
      s.api.on('DELETE', '/users/:id', () => ({ status: 204 }));

      withLegacyClient(s, {}, (client, track) => {
        const writeTypes = {
          args: def<{ pathParams: { id: string }; body: { name: string } }>(),
          response: def<User>(),
        };
        const replaceUser = client.put({ route: (p) => `/users/${p.id}`, types: writeTypes });
        const updateUser = client.patch({ route: (p) => `/users/${p.id}`, types: writeTypes });
        const removeUser = client.delete({
          route: (p) => `/users/${p.id}`,
          types: { args: def<{ pathParams: { id: string } }>(), response: def<null>() },
        });

        const replaced = track(replaceUser.prepare({ pathParams: { id: '1' }, body: { name: 'Ada' } }).execute());
        const updated = track(updateUser.prepare({ pathParams: { id: '1' }, body: { name: 'Grace' } }).execute());
        const removed = track(removeUser.prepare({ pathParams: { id: '1' } }).execute());

        s.tick();

        expect(replaced.rawState).toMatchObject({
          type: QueryStateType.Success,
          response: { id: '1', name: 'Ada' },
        });
        expect(updated.rawState).toMatchObject({
          type: QueryStateType.Success,
          response: { id: '1', name: 'Grace' },
        });
        expect(removed.rawState).toMatchObject({ type: QueryStateType.Success });
        expect(s.api.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
          'PUT /users/1',
          'PATCH /users/1',
          'DELETE /users/1',
        ]);
      });
    });

    it('sends a gqlQuery as a POST with the query and variables, and a gqlMutate the same way', () => {
      const s = scenario();
      s.api.on('POST', '/graphql', ({ body }) =>
        (body as { operationName: string }).operationName === 'GetPosts'
          ? { body: { data: { posts: [{ id: '1' }] } } }
          : { body: { data: { createPost: { id: '2' } } } },
      );

      withLegacyClient(s, {}, (client, track) => {
        const getPosts = client.gqlQuery({
          route: '/graphql',
          query: GET_POSTS,
          types: { args: def<{ variables: { limit: number } }>(), response: def<{ posts: { id: string }[] }>() },
        });
        const createPost = client.gqlMutate({
          route: '/graphql',
          query: CREATE_POST,
          types: { args: def<{ variables: { title: string } }>(), response: def<{ createPost: { id: string } }>() },
        });

        const list = track(getPosts.prepare({ variables: { limit: 2 } }).execute());
        const created = track(createPost.prepare({ variables: { title: 'Hello' } }).execute());

        s.tick();

        expect(list.rawState).toMatchObject({ type: QueryStateType.Success, response: { posts: [{ id: '1' }] } });
        expect(created.rawState).toMatchObject({
          type: QueryStateType.Success,
          response: { createPost: { id: '2' } },
        });
        expect(s.api.requests.map((r) => `${r.method} ${r.path}`)).toEqual(['POST /graphql', 'POST /graphql']);
        expect(s.api.requests[0]?.body).toEqual({
          query: GET_POSTS,
          variables: JSON.stringify({ limit: 2 }),
          operationName: 'GetPosts',
        });
        expect(s.api.requests[1]?.body).toEqual({
          query: CREATE_POST,
          variables: JSON.stringify({ title: 'Hello' }),
          operationName: 'CreatePost',
        });
      });
    });
  });

  describe('caching beyond GET', () => {
    it('caches an OPTIONS and a HEAD query, and re-uses the prepared instance', () => {
      const s = scenario();
      s.api.on('OPTIONS', '/users', () => ({
        body: { allow: 'GET' },
        headers: { 'cache-control': 'max-age=600' },
      }));
      s.api.on('HEAD', '/posts', () => ({ headers: { 'cache-control': 'max-age=600' } }));

      withLegacyClient(s, {}, (client, track) => {
        const optionsUsers = client.fetch<'/users', { allow: string }, undefined, string>({
          method: 'OPTIONS',
          route: '/users',
          types: { response: def<{ allow: string }>() },
        });
        const headPosts = client.fetch<'/posts', null, undefined, string>({
          method: 'HEAD',
          route: '/posts',
          types: { response: def<null>() },
        });

        const optionsQuery = track(optionsUsers.prepare().execute());
        const headQuery = track(headPosts.prepare().execute());

        s.tick();

        expect(optionsUsers.prepare()).toBe(optionsQuery);
        expect(headPosts.prepare()).toBe(headQuery);
        expect(optionsQuery.isExpired).toBe(false);
        expect(headQuery.isExpired).toBe(false);

        optionsUsers.prepare().execute();
        headPosts.prepare().execute();

        s.tick();

        expect(s.api.requestCount('OPTIONS', '/users')).toBe(1);
        expect(s.api.requestCount('HEAD', '/posts')).toBe(1);
      });
    });

    it('caches a gqlQuery within its TTL and never caches a gqlMutate', () => {
      const s = scenario();
      s.api.on('POST', '/graphql', ({ body }) =>
        (body as { operationName: string }).operationName === 'GetPosts'
          ? { body: { data: { posts: [{ id: '1' }] } }, headers: { 'cache-control': 'max-age=600' } }
          : { body: { data: { createPost: { id: '2' } } }, headers: { 'cache-control': 'max-age=600' } },
      );

      withLegacyClient(s, {}, (client, track) => {
        const getPosts = client.gqlQuery({
          route: '/graphql',
          query: GET_POSTS,
          types: { args: def<{ variables: { limit: number } }>(), response: def<{ posts: { id: string }[] }>() },
        });
        const createPost = client.gqlMutate({
          route: '/graphql',
          query: CREATE_POST,
          types: { args: def<{ variables: { title: string } }>(), response: def<{ createPost: { id: string } }>() },
        });

        const firstList = track(getPosts.prepare({ variables: { limit: 2 } }));

        expect(getPosts.prepare({ variables: { limit: 2 } })).toBe(firstList);

        firstList.execute();
        s.tick();
        getPosts.prepare({ variables: { limit: 2 } }).execute();
        s.tick();

        expect(s.api.requests).toHaveLength(1);

        const firstMutation = track(createPost.prepare({ variables: { title: 'Hello' } }));
        const secondMutation = track(createPost.prepare({ variables: { title: 'Hello' } }));

        expect(secondMutation).not.toBe(firstMutation);

        firstMutation.execute();
        secondMutation.execute();
        s.tick();

        expect(s.api.requests).toHaveLength(3);
      });
    });
  });

  describe('default headers', () => {
    it('setDefaultHeaders sends the header on every subsequent request', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

      withLegacyClient(s, {}, (client, track) => {
        client.setDefaultHeaders({ headers: { 'X-Tenant': 'ada' } });

        const createUser = client.post({
          route: '/users',
          types: { args: def<{ body: { name: string } }>(), response: def<User>() },
        });

        track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );
        track(createUser.prepare({ body: { name: 'Ada' } }).execute());

        s.tick();

        expect(s.api.requests).toHaveLength(2);
        expect(s.api.requests.map((r) => r.headers.get('X-Tenant'))).toEqual(['ada', 'ada']);
      });
    });

    it('setDefaultHeaders with refreshQueriesInUse re-executes the queries in use under the new header', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: 'Ada' },
        headers: { 'cache-control': 'max-age=600' },
      }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(
          createGetUser(client)
            .prepare({ pathParams: { id: '1' } })
            .execute(),
        );
        const recorded = recordStates(query);

        s.tick();

        expect(s.api.requestCount('GET', '/users/1')).toBe(1);
        expect(query.isInUse).toBe(true);
        expect(query.isExpired).toBe(false);

        client.setDefaultHeaders({ headers: { 'X-Tenant': 'ada' }, refreshQueriesInUse: true });
        s.tick();

        expect(s.api.requestCount('GET', '/users/1')).toBe(2);
        expect(s.api.requests[0]?.headers.get('X-Tenant')).toBeNull();
        expect(s.api.requests[1]?.headers.get('X-Tenant')).toBe('ada');
        expect(query.rawState.meta.triggeredVia).toBe('auto');

        recorded.stop();
      });
    });
  });

  describe('entity store', () => {
    it('an entity config reads a response out of and writes it back into the entity store', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      withLegacyClient(s, {}, (client, track) => {
        const store = new EntityStore<User>({ name: 'users' });
        const getUser = client.get({
          route: (p) => `/users/${p.id}`,
          types: { args: def<{ pathParams: { id: string } }>(), response: def<User>() },
          entity: {
            store,
            id: ({ response }) => response.id,
            set: ({ store, id, response }) => store.set(id, response),
            get: ({ store, id }) => store.select(id).pipe(map((user) => user ?? { id, name: 'unknown' })),
          },
        });

        const stored: (User | null)[] = [];
        const subscription = store.select('1').subscribe((user) => stored.push(user));
        const query = track(getUser.prepare({ pathParams: { id: '1' } }).execute());
        const recorded = recordStates(query);

        s.tick();

        expect(stored.at(-1)).toEqual({ id: '1', name: 'Ada' });
        expect(recorded.states.at(-1)).toMatchObject({
          type: QueryStateType.Success,
          response: { id: '1', name: 'Ada' },
        });

        store.set('1', { id: '1', name: 'Grace' });
        s.tick();

        expect(recorded.states.at(-1)).toMatchObject({
          type: QueryStateType.Success,
          response: { id: '1', name: 'Grace' },
        });

        subscription.unsubscribe();
        recorded.stop();
      });
    });
  });

  describe('QueryForm across both systems', () => {
    it('a legacy QueryForm drives a current-system query through withArgs', () => {
      const s = scenario();
      s.api.on('GET', '/users', ({ query }) => ({ body: { search: query['search'] ?? null } }));

      const searchUsers = s.get<{
        response: { search: string | null };
        queryParams: { search: string | null };
      }>('/users');

      const c = s.consumer();
      const queryForm = c.run(() =>
        new QueryForm({ search: new QueryField({ control: new FormControl<string | null>(null) }) }).observe({
          writeToQueryParams: false,
        }),
      );
      const query = c.run(() =>
        searchUsers(withArgs(() => ({ queryParams: { search: queryForm.currentValue()?.search ?? null } }))),
      );

      s.tick();

      expect(query.response()).toEqual({ search: null });

      queryForm.setValue({ search: 'ada' });
      s.flush();

      expect(query.response()).toEqual({ search: 'ada' });
      expect(s.api.requestCount('GET', '/users')).toBe(2);

      c.destroy();
    });

    it('a legacy QueryForm drives a legacy prepare() with the same value', () => {
      const s = scenario();
      s.api.on('GET', '/users', ({ query }) => ({ body: { search: query['search'] ?? null } }));

      withLegacyClient(s, {}, (client, track) => {
        const c = s.consumer();
        const queryForm = c.run(() =>
          new QueryForm({ search: new QueryField({ control: new FormControl<string | null>(null) }) }).observe({
            writeToQueryParams: false,
          }),
        );
        const searchUsers = client.get({
          route: '/users',
          types: {
            args: def<{ queryParams: { search: string | null } }>(),
            response: def<{ search: string | null }>(),
          },
        });

        queryForm.setValue({ search: 'ada' });
        s.tick();

        const query = track(searchUsers.prepare({ queryParams: { search: queryForm.value.search } }).execute());

        s.tick();

        expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { search: 'ada' } });
        expect(s.api.requests[0]?.query).toEqual({ search: 'ada' });

        c.destroy();
      });
    });
  });

  describe('devtools registration', () => {
    it('provideQueryClientForDevtools exposes the legacy client to the devtools bridge', () => {
      const s = scenario();

      withLegacyClient(s, {}, (client) => {
        const root = s.run(() => inject(EnvironmentInjector));
        const injector = createEnvironmentInjector(
          [provideQueryClientForDevtools({ displayName: 'Legacy API', client })],
          root,
        );

        const registered = injector.get(QUERY_CLIENT_DEVTOOLS_TOKEN);

        expect(registered).toHaveLength(1);
        expect(registered[0]?.displayName).toBe('Legacy API');
        expect(registered[0]?.client).toBe(client);

        injector.destroy();
      });
    });
  });

  describe('validateWithV2Query', () => {
    it('validateWithV2Query maps a 422 violation list onto the control', async () => {
      const s = scenario();
      s.api.on('POST', '/validate', () => ({
        status: 422,
        body: { violations: [{ message: 'Email already taken.', propertyPath: 'email' }] },
      }));

      const owner = s.consumer();
      const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL }));
      const validateEmail = client.post({
        route: '/validate',
        types: { args: def<{ body: { email: string } }>(), response: def<void>() },
      });

      const testForm = owner.run(() => {
        const emailSchema = schema<{ email: string }>((p) => {
          validateWithV2Query(p, {
            queryCreator: validateEmail,
            args: (ctx) => ({ body: { email: ctx.value().email } }),
            debounce: 0,
          });
        });

        return form(signal({ email: 'ada@example.com' }), emailSchema);
      });

      await s.settle();

      expect(s.api.requestCount('POST', '/validate')).toBe(1);
      expect(testForm.email().errors()).toEqual([
        expect.objectContaining({ kind: SERVER_VIOLATION_ERROR_KIND, message: 'Email already taken.' }),
      ]);

      owner.destroy();
    });
  });
  describe('query directives', () => {
    const blurThenFocus = (s: Scenario) => {
      window.dispatchEvent(new Event('blur'));
      s.tick(5_000);
      s.tick(GC_INTERVAL + 1);
      window.dispatchEvent(new Event('focus'));
      s.tick();
    };

    it('*etQuery executes the query and exposes the response, loading, refreshing and error to its template', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 500 }));
      s.api.on('GET', '/broken', () => ({ status: 404, body: { message: 'not found' } }));

      withLegacyClient(s, {}, (client, track) => {
        const query = track(createGetUser(client).prepare({ pathParams: { id: '1' } }));
        const fixture = TestBed.createComponent(QueryDirectiveHost);

        fixture.componentRef.setInput('query', query);
        fixture.detectChanges();

        expect(query.rawState.type).toBe(QueryStateType.Loading);
        expect(s.api.pending()).toHaveLength(1);
        expect(slotText(fixture, 'loading')).toBe('true');
        expect(slotText(fixture, 'name')).toBe('-');
        expect(slotText(fixture, 'progress')).toBe('-');

        s.tick(500);
        fixture.detectChanges();

        expect(slotText(fixture, 'name')).toBe('Ada');
        expect(slotText(fixture, 'loading')).toBe('false');
        expect(slotText(fixture, 'refreshing')).toBe('false');
        expect(slotText(fixture, 'error')).toBe('-');

        blurThenFocus(s);
        fixture.detectChanges();

        expect(query.rawState.meta.triggeredVia).toBe('auto');
        expect(slotText(fixture, 'refreshing')).toBe('true');
        expect(slotText(fixture, 'loading')).toBe('false');

        s.tick(500);
        fixture.detectChanges();

        expect(slotText(fixture, 'refreshing')).toBe('false');

        const broken = track(client.get({ route: '/broken', types: { response: def<User>() } }).prepare());

        fixture.componentRef.setInput('query', broken);
        fixture.detectChanges();
        s.tick();
        fixture.detectChanges();

        expect(slotText(fixture, 'error')).toBe('404');
        expect(slotText(fixture, 'name')).toBe('-');

        fixture.destroy();
      });
    });

    it('*etQuery exposes the request progress to its template', () => {
      const s = scenario();

      withLegacyClient(s, {}, (client, track) => {
        // The fake API emits its progress events in the same task as the response, so a progress
        // state never survives to a change-detection pass. The mock args space theirs out in time.
        const query = track(
          createGetUser(client).prepare({
            pathParams: { id: '1' },
            mock: {
              response: { id: '1', name: 'Ada' },
              delay: 100,
              progress: { eventType: 'download', eventCount: 2, fileSize: 100 },
            },
          }),
        );
        const fixture = TestBed.createComponent(QueryDirectiveHost);

        fixture.componentRef.setInput('query', query);
        fixture.detectChanges();

        expect(slotText(fixture, 'progress')).toBe('-');

        s.tick(200);
        fixture.detectChanges();

        expect(slotText(fixture, 'progress')).toBe('50');
        expect(slotText(fixture, 'name')).toBe('-');

        s.tick(100);
        fixture.detectChanges();

        expect(slotText(fixture, 'progress')).toBe('100');

        s.tick(100);
        fixture.detectChanges();

        expect(slotText(fixture, 'progress')).toBe('-');
        expect(slotText(fixture, 'name')).toBe('Ada');
        expect(s.api.requests).toHaveLength(0);

        fixture.destroy();
      });
    });

    it('an infinity query appends the next page to its items when the trigger fires', () => {
      const s = scenario();
      s.api.on('GET', '/users', ({ query }) => {
        const page = Number(query['page'] ?? '1');

        return { body: { items: [{ id: `${page}a` }, { id: `${page}b` }], totalPages: 2 } };
      });

      withLegacyClient(s, {}, (client) => {
        const getUsers = client.get({
          route: '/users',
          types: {
            args: def<{ queryParams: { page: number; limit: number } }>(),
            response: def<{ items: { id: string }[]; totalPages: number }>(),
          },
        });
        const config = createInfinityQueryConfig({
          queryCreator: getUsers,
          limitParam: { value: 2 },
          response: { arrayType: [] as { id: string }[], valueExtractor: (response) => response.items },
        });

        const fixture = TestBed.createComponent(InfinityQueryHost);

        fixture.componentRef.setInput('config', config);
        fixture.detectChanges();
        s.tick();
        fixture.detectChanges();

        expect(slotText(fixture, 'items')).toBe('1a,1b');
        expect(slotText(fixture, 'currentPage')).toBe('1');
        expect(slotText(fixture, 'totalPages')).toBe('2');
        expect(slotText(fixture, 'canLoadMore')).toBe('true');

        const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-slot="more"]');

        expect(trigger).not.toBeNull();
        trigger?.click();
        s.tick();
        fixture.detectChanges();

        expect(slotText(fixture, 'items')).toBe('1a,1b,2a,2b');
        expect(slotText(fixture, 'currentPage')).toBe('2');
        expect(slotText(fixture, 'canLoadMore')).toBe('false');
        expect(s.api.requests.map((request) => request.query['page'])).toEqual(['1', '2']);
        expect(s.api.requests.map((request) => request.query['limit'])).toEqual(['2', '2']);

        fixture.destroy();
      });
    });
  });
});
