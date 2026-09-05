import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject, signal, untracked } from '@angular/core';
import {
  createGetQuery,
  createQueryClient,
  createQueryFeature,
  nestedEffect,
  QueryArgs,
  QueryClientFeatureFn,
  QueryFeatureFlags,
  RequestArgs,
  withArgs,
  withAutoRefresh,
  withDefaultRetry,
  withErrorHandling,
  withLogging,
  withLongPolling,
  withPageResetOnError,
  withPolling,
  withSuccessHandling,
} from '../index';
import { describe, expect, it, vi } from 'vitest';
import { Scenario, sequence, useScenario } from './harness';

const CUSTOM_FEATURE_TYPE = 'withCustomScenarioFeature';

describe('features scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('withArgs sends nothing while null and sends one request once a non-null value is set', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);
    const enabled = signal(false);

    const c = s.consumer();
    const query = c.run(() => getUser(withArgs(() => (enabled() ? { pathParams: { id: '1' } } : null))));

    s.tick();
    expect(s.api.requests.length).toBe(0);
    expect(query.response()).toBeNull();
    expect(query.args()).toBeNull();

    enabled.set(true);
    s.tick();

    expect(s.api.requestCount('GET', '/users/1')).toBe(1);
    expect(query.response()).toEqual({ id: '1' });

    c.destroy();
  });

  it('re-executes on an args change and aborts the superseded request', () => {
    const s = scenario();
    s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 300 }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/items/${p.id}`);
    const id = signal('1');

    const c = s.consumer();
    const query = c.run(() => getItem(withArgs(() => ({ pathParams: { id: id() } }))));

    s.tick();
    expect(s.api.pending().length).toBe(1);

    id.set('2');
    s.tick();

    // apps/docs/query/caching.md: "A request unbound while still in flight ... is aborted immediately"
    expect(s.api.requests[0]?.aborted).toBe(true);
    expect(s.api.requestCount('GET', '/items/2')).toBe(1);

    s.tick(300);
    expect(query.response()).toEqual({ id: '2' });

    c.destroy();
  });

  it('withPolling fires on the documented interval and stops on destroy with no timer left', () => {
    const s = scenario();
    s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getItem = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/items/${p.id}`);

    const c = s.consumer();
    const query = c.run(() =>
      getItem(
        withArgs(() => ({ pathParams: { id: '1' } })),
        withPolling({ interval: 60_000 }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/items/1')).toBe(1);
    expect(query.response()).toEqual({ id: '1' });

    s.tick(60_000 * 2);
    expect(s.api.requestCount('GET', '/items/1')).toBe(3);

    c.destroy();
    s.tick(60_000 * 2);
    expect(s.api.requestCount('GET', '/items/1')).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('withLongPolling waits for the previous response before starting the next round', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => {
      cursor++;
      return { body: { cursor }, delay: 50 };
    });

    const getEvents = s.get<{ response: { cursor: number }; queryParams: { cursor: number | null } }>('/events');

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({
          nextArgs: (response) => (response ? { queryParams: { cursor: response.cursor } } : null),
        }),
      ),
    );

    s.tick(50);
    expect(query.response()).toEqual({ cursor: 1 });
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    // default `delay` is 250ms after the previous round settled - not before.
    s.tick(249);
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    s.tick(1);
    expect(s.api.pending().length).toBe(1);

    s.tick(50);
    expect(query.response()).toEqual({ cursor: 2 });

    c.destroy();
  });

  it('withAutoRefresh re-executes when its trigger signal changes', () => {
    const s = scenario();
    s.api.on('GET', '/status', () => ({ body: { ok: true } }));

    const getStatus = s.get<{ response: { ok: boolean } }>('/status');
    const trigger = signal(0);

    const c = s.consumer();
    c.run(() => getStatus(withAutoRefresh({ onSignalChanges: [trigger] })));

    s.tick();
    const before = s.api.requestCount('GET', '/status');

    trigger.set(1);
    s.tick();

    expect(s.api.requestCount('GET', '/status')).toBe(before + 1);

    c.destroy();
  });

  it('withErrorHandling and withSuccessHandling each run once per matching outcome', () => {
    const s = scenario();
    const errors: unknown[] = [];
    const successes: unknown[] = [];

    s.api.on('GET', '/flaky', sequence([{ status: 500, body: { message: 'boom' } }, { body: { ok: true } }]));

    const getFlaky = s.get<{ response: { ok: boolean } }>('/flaky');

    const c = s.consumer();
    const query = c.run(() =>
      getFlaky(
        withErrorHandling({ handler: (e) => errors.push(e) }),
        withSuccessHandling({ handler: (r) => successes.push(r) }),
      ),
    );

    s.tick();
    expect(errors.length).toBe(1);
    expect(successes.length).toBe(0);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    query.execute();
    s.tick();
    expect(errors.length).toBe(1);
    expect(successes.length).toBe(1);

    c.destroy();
  });

  it('withLogging observes every http event without throwing', () => {
    const s = scenario();
    const events: unknown[] = [];

    s.api.on('GET', '/ping', () => ({ body: { pong: true } }));
    const getPing = s.get<{ response: { pong: boolean } }>('/ping');

    const c = s.consumer();
    expect(() => {
      c.run(() => getPing(withLogging({ logFn: (event) => events.push(event) })));
    }).not.toThrow();

    s.tick();
    expect(events.length).toBeGreaterThan(0);

    c.destroy();
  });

  it('withPageResetOnError resets the page signal after a page-out-of-range error', () => {
    const s = scenario();

    s.api.on('GET', '/items', ({ query }) =>
      Number(query['page']) > 1 ? { status: 416, body: { message: 'out of range' } } : { body: { items: [] } },
    );

    const getItems = s.get<{ response: { items: unknown[] }; queryParams: { page: number } }>('/items');
    const page = signal(3);

    const c = s.consumer();
    const query = c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: { page: page() } })),
        withPageResetOnError({ page }),
      ),
    );

    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 416);
    expect(page()).toBe(1);

    s.flush();
    expect(query.response()).toEqual({ items: [] });

    c.destroy();
  });

  describe('authoring custom features', () => {
    const withArgsLog = <TArgs extends QueryArgs>(log: unknown[], calls: { fn: number; flags: QueryFeatureFlags[] }) =>
      createQueryFeature<TArgs>({
        type: CUSTOM_FEATURE_TYPE,
        fn: ({ state, flags }) => {
          calls.fn++;
          calls.flags.push(flags);
          nestedEffect(() => log.push(state.args()));
        },
      });

    it('runs fn once at creation with the state, the flags and a nestedEffect that tracks the args', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);
      const id = signal('1');
      const log: unknown[] = [];
      const calls = { fn: 0, flags: [] as QueryFeatureFlags[] };

      const c = s.consumer();
      const query = c.run(() =>
        getUser(
          withArgs(() => ({ pathParams: { id: id() } })),
          withArgsLog(log, calls),
        ),
      );
      s.tick();

      expect(calls.fn).toBe(1);
      expect(calls.flags[0]).toMatchObject({ hasWithArgsFeature: true, shouldAutoExecute: true });
      expect(log).toEqual([{ pathParams: { id: '1' } }]);
      expect(query.response()).toEqual({ id: '1' });

      id.set('2');
      s.tick();

      expect(calls.fn).toBe(1);
      expect(log).toEqual([{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }]);
      expect(query.response()).toEqual({ id: '2' });

      c.destroy();
    });

    it('lets a feature execute the query through the internal execute', () => {
      const s = scenario();
      s.api.on('POST', '/users/lookup', ({ body }) => ({ body: { id: (body as { id: string }).id } }));

      const lookupUser = s.post<{ response: { id: string }; body: { id: string } }>('/users/lookup');
      const trigger = signal<string | null>(null);

      const withExecuteOn = <TArgs extends QueryArgs>() =>
        createQueryFeature<TArgs>({
          type: CUSTOM_FEATURE_TYPE,
          fn: ({ execute, deps }) => {
            nestedEffect(
              () => {
                const id = trigger();

                if (id === null) return;

                untracked(() => execute({ args: { body: { id } } as RequestArgs<TArgs> }));
              },
              { injector: deps.injector },
            );
          },
        });

      const c = s.consumer();
      const query = c.run(() => lookupUser(withExecuteOn()));
      s.tick();

      expect(s.api.requests.length).toBe(0);

      trigger.set('7');
      s.tick();

      expect(s.api.requestCount('POST', '/users/lookup')).toBe(1);
      expect(query.response()).toEqual({ id: '7' });

      c.destroy();
    });

    it('never calls the devtools describer without provideQueryDevtools()', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);
      const describer = vi.fn(() => [{ label: 'prefix', value: 'x' }]);

      const withDescribed = <TArgs extends QueryArgs>() =>
        createQueryFeature<TArgs>({ type: CUSTOM_FEATURE_TYPE, devtools: describer, fn: () => undefined });

      const c = s.consumer();
      const query = c.run(() =>
        getUser(
          withArgs(() => ({ pathParams: { id: '1' } })),
          withDescribed(),
        ),
      );
      s.tick();

      expect(query.response()).toEqual({ id: '1' });
      expect(describer).not.toHaveBeenCalled();

      c.destroy();
    });

    it('throws when the same feature type is passed twice', () => {
      const s = scenario();
      s.api.on('GET', '/users', () => ({ body: [] }));

      const getUsers = s.get<{ response: unknown[] }>('/users');
      const log: unknown[] = [];
      const calls = { fn: 0, flags: [] as QueryFeatureFlags[] };

      const c = s.consumer();

      expect(() => c.run(() => getUsers(withArgsLog(log, calls), withArgsLog(log, calls)))).toThrow(
        /multiple times|twice|more than once/i,
      );

      c.destroy();
    });
  });
});

describe('client-scoped default retry', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  let clientCounter = 0;

  const createClient = (s: Scenario, features: QueryClientFeatureFn[]) => {
    const ref = createQueryClient({
      name: `retry-scope-client-${++clientCounter}`,
      baseUrl: 'https://api.test',
      keepUnusedFor: 0,
      features,
    });

    const injector = createEnvironmentInjector(
      ref.provide(),
      s.run(() => inject(EnvironmentInjector)),
    );

    return {
      get: createGetQuery(ref),
      run: <T>(fn: () => T) => injector.runInContext(fn),
      destroy: () => injector.destroy(),
    };
  };

  it('a client without withDefaultRetry does not retry while another client has it', () => {
    const s = scenario();
    s.api.on('GET', '/retrying', () => ({ status: 503, body: { message: 'down' } }));
    s.api.on('GET', '/plain', () => ({ status: 503, body: { message: 'down' } }));

    const retrying = createClient(s, [withDefaultRetry({ maxAttempts: 2, baseDelayMs: 10, jitter: 0 })]);
    const plain = createClient(s, []);

    const getRetrying = retrying.get<{ response: unknown }>('/retrying');
    const getPlain = plain.get<{ response: unknown }>('/plain');

    const retryingQuery = retrying.run(() => getRetrying());
    const plainQuery = plain.run(() => getPlain());

    s.flush();

    expect(s.api.requestCount('GET', '/retrying')).toBe(3);
    expect(s.api.requestCount('GET', '/plain')).toBe(1);
    expect(plainQuery.error()?.retryState).toEqual({ retry: false });
    expect(retryingQuery.error()?.code).toBe(503);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);

    retrying.destroy();
    plain.destroy();
  });

  it('two clients keep their own retry configs', () => {
    const s = scenario();
    s.api.on('GET', '/three', () => ({ status: 503, body: { message: 'down' } }));
    s.api.on('GET', '/one', () => ({ status: 503, body: { message: 'down' } }));

    const three = createClient(s, [withDefaultRetry({ maxAttempts: 3, baseDelayMs: 10, jitter: 0 })]);
    const one = createClient(s, [withDefaultRetry({ maxAttempts: 1, baseDelayMs: 10, jitter: 0 })]);

    const getThree = three.get<{ response: unknown }>('/three');
    const getOne = one.get<{ response: unknown }>('/one');

    three.run(() => getThree());
    one.run(() => getOne());

    s.flush();

    expect(s.api.requestCount('GET', '/three')).toBe(4);
    expect(s.api.requestCount('GET', '/one')).toBe(2);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);

    three.destroy();
    one.destroy();
  });
});
