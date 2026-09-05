import { Injector, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  AnyLegacyQuery,
  AnyV2Query,
  createLegacyQueryCreator,
  def,
  queryComputed,
  QueryStateType,
  V2QueryClient,
  V2QueryClientConfig,
} from '../index';
import { Scenario, useScenario } from './harness';

const BASE_URL = 'https://api.test';

type User = { id: string; name: string };
type GetUserArgs = { response: User; pathParams: { id: string } };
type CreateUserArgs = { response: User; body: { name: string } };

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

const createGetUser = (client: V2QueryClient) =>
  client.get({
    route: (p) => `/users/${p.id}`,
    types: {
      args: def<{ pathParams: { id: string } }>(),
      response: def<User>(),
    },
  });

const holdQuery = (injector: Injector, source: () => AnyV2Query | AnyLegacyQuery | null) =>
  queryComputed(source, { injector });

const isUnderlyingQueryDestroyed = (query: AnyLegacyQuery) =>
  (query.newQuery.subtle.injector as unknown as { destroyed: boolean }).destroyed;

describe('legacy query container scenario', () => {
  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  it('aborts the in-flight request when its only container is destroyed', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1_000 }));

    withLegacyClient(s, {}, (client, track) => {
      const query = track(
        createGetUser(client)
          .prepare({ pathParams: { id: '1' } })
          .execute(),
      );

      const consumer = s.consumer();
      holdQuery(consumer.injector, () => query);
      s.tick(100);

      expect(s.api.pending()).toHaveLength(1);

      consumer.destroy();
      s.tick();

      expect(s.api.requests[0]?.aborted).toBe(true);
      expect(query.rawState.type).toBe(QueryStateType.Cancelled);
    });
  });

  it('aborts the shared query only once both containers let go', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1_000 }));

    withLegacyClient(s, {}, (client, track) => {
      const query = track(
        createGetUser(client)
          .prepare({ pathParams: { id: '1' } })
          .execute(),
      );

      const first = s.consumer();
      const second = s.consumer();
      holdQuery(first.injector, () => query);
      holdQuery(second.injector, () => query);
      s.tick(100);

      first.destroy();
      s.tick();

      expect(s.api.requests[0]?.aborted).toBe(false);
      expect(query.rawState.type).toBe(QueryStateType.Loading);

      second.destroy();
      s.tick();

      expect(s.api.requests[0]?.aborted).toBe(true);
      expect(query.rawState.type).toBe(QueryStateType.Cancelled);
    });
  });

  it('keeps the shared query in flight when a container is destroyed before its first emission', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1_000 }));

    withLegacyClient(s, {}, (client, track) => {
      const query = track(
        createGetUser(client)
          .prepare({ pathParams: { id: '1' } })
          .execute(),
      );

      const holder = s.consumer();
      holdQuery(holder.injector, () => query);
      s.tick(100);

      const shortLived = s.consumer();
      holdQuery(shortLived.injector, () => query);
      shortLived.destroy();
      s.tick();

      expect(s.api.requests[0]?.aborted).toBe(false);
      expect(query.rawState.type).toBe(QueryStateType.Loading);

      s.tick(1_000);

      expect(query.rawState.type).toBe(QueryStateType.Success);

      holder.destroy();
    });
  });

  it('stops polling the previous query when its only container switches away', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

    withLegacyClient(s, {}, (client, track) => {
      const getUser = createGetUser(client);
      const polled = track(getUser.prepare({ pathParams: { id: '1' } }).execute());
      const next = track(getUser.prepare({ pathParams: { id: '2' } }));
      const selected = signal<AnyV2Query | null>(polled);

      const consumer = s.consumer();
      holdQuery(consumer.injector, () => selected());
      s.tick();

      const stopPolling$ = new Subject<void>();
      polled.poll({ interval: 1_000, takeUntil: stopPolling$ });
      s.tick(2_000);

      expect(polled.isPolling).toBe(true);

      const polledCount = s.api.requestCount('GET', '/users/1');

      selected.set(next);
      s.tick(5_000);

      expect(polled.isPolling).toBe(false);
      expect(s.api.requestCount('GET', '/users/1')).toBe(polledCount);

      consumer.destroy();
    });
  });

  it('keeps polling the shared query when only one of two containers switches away', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

    withLegacyClient(s, {}, (client, track) => {
      const getUser = createGetUser(client);
      const polled = track(getUser.prepare({ pathParams: { id: '1' } }).execute());
      const next = track(getUser.prepare({ pathParams: { id: '2' } }));
      const switched = signal<AnyV2Query | null>(polled);
      const kept = signal<AnyV2Query | null>(polled);

      const switching = s.consumer();
      const keeping = s.consumer();
      holdQuery(switching.injector, () => switched());
      holdQuery(keeping.injector, () => kept());
      s.tick();

      const stopPolling$ = new Subject<void>();
      polled.poll({ interval: 1_000, takeUntil: stopPolling$ });
      s.tick(2_000);

      switched.set(next);
      s.tick(2_000);

      expect(polled.isPolling).toBe(true);

      const polledCount = s.api.requestCount('GET', '/users/1');

      kept.set(next);
      s.tick(5_000);

      expect(polled.isPolling).toBe(false);
      expect(s.api.requestCount('GET', '/users/1')).toBe(polledCount);

      switching.destroy();
      keeping.destroy();
    });
  });
  it('stops polling when the last container of a polling query is destroyed', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

    withLegacyClient(s, {}, (client, track) => {
      const polled = track(
        createGetUser(client)
          .prepare({ pathParams: { id: '1' } })
          .execute(),
      );

      const consumer = s.consumer();
      holdQuery(consumer.injector, () => polled);
      s.tick();

      const stopPolling$ = new Subject<void>();
      polled.poll({ interval: 1_000, takeUntil: stopPolling$ });
      s.tick(2_000);

      expect(polled.isPolling).toBe(true);

      const polledCount = s.api.requestCount('GET', '/users/1');

      consumer.destroy();
      s.tick(3_000);

      expect(polled.isPolling).toBe(false);
      expect(s.api.requestCount('GET', '/users/1')).toBe(polledCount);
    });
  });

  it('keeps a shared query alive when one of two containers switches away', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

    const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
    const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

    const owner = s.consumer();
    const shared = owner.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());
    const other = owner.run(() => legacyGetUser.prepare({ pathParams: { id: '2' } }));
    const switched = signal<AnyLegacyQuery | null>(shared);

    const switching = s.consumer();
    const keeping = s.consumer();
    holdQuery(switching.injector, () => switched());
    holdQuery(keeping.injector, () => shared);
    s.tick();

    const stopPolling$ = new Subject<void>();
    shared.poll({ interval: 1_000, takeUntil: stopPolling$ });
    s.tick(2_000);

    switched.set(other);
    s.tick(2_000);

    expect(shared.isPolling).toBe(true);

    const polledCount = s.api.requestCount('GET', '/users/1');

    s.tick(2_000);

    expect(s.api.requestCount('GET', '/users/1')).toBeGreaterThan(polledCount);

    shared.stopPolling();
    s.tick(1);

    expect(shared.rawState.type).toBe(QueryStateType.Success);

    switching.destroy();
    keeping.destroy();
    owner.destroy();
  });

  it('destroys an interop POST query when its container is torn down', () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({ body: { id: '1', name: 'Ada' } }));

    const createUser = s.post<CreateUserArgs>('/users');
    const legacyCreateUser = createLegacyQueryCreator({ creator: createUser, name: 'legacyCreateUser' });

    const owner = s.consumer();
    const query = owner.run(() => legacyCreateUser.prepare({ body: { name: 'Ada' } }).execute());

    const container = s.consumer();
    container.run(() => legacyCreateUser.createSignal(query));
    s.tick();

    const stopPolling$ = new Subject<void>();
    query.poll({ interval: 1_000, takeUntil: stopPolling$ });
    s.tick(2_000);

    expect(query.isPolling).toBe(true);

    const polledCount = s.api.requestCount('POST', '/users');

    container.destroy();
    s.tick(3_000);

    expect(query.isPolling).toBe(false);
    expect(s.api.requestCount('POST', '/users')).toBe(polledCount);
    expect(isUnderlyingQueryDestroyed(query)).toBe(true);

    owner.destroy();
  });
});
