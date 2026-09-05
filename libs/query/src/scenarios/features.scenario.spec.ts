import { HttpErrorResponse } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject, signal, untracked } from '@angular/core';
import {
  FakeBroadcastChannelHandle,
  FakeWebLocksHandle,
  flushMultiTabSync,
  installFakeBroadcastChannel,
  installFakeWebLocks,
} from '@ethlete/query/testing';
import {
  createGetQuery,
  createQueryBatch,
  createQueryClient,
  createQueryFeature,
  createQuerySubmission,
  isPageOutOfRangeError,
  isQueryDevtoolsEnabled,
  nestedEffect,
  provideQueryDevtools,
  QueryArgs,
  QueryClientFeatureFn,
  QueryClientRef,
  QueryFeatureFlags,
  RequestArgs,
  withArgs,
  withAutoRefresh,
  withDefaultRetry,
  withErrorHandling,
  withLogging,
  withLongPolling,
  withMultiTabSync,
  withPageResetOnError,
  withPolling,
  withResponseUpdate,
  withSuccessHandling,
  validateWithQuery,
} from '../index';
import { form, schema, submit } from '@angular/forms/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scenario, sequence, useScenario } from './harness';

const CUSTOM_FEATURE_TYPE = 'withCustomScenarioFeature';

/**
 * Steps fake time in small slices so every round of a chain that arms its next timer from a settled
 * response gets its microtasks drained before the next timer is due.
 */
const advance = (s: Scenario, ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 50) s.tick(50);
};

/** How long the chain waited between a round failing and the next round being sent. */
const roundRepeatDelays = (s: Scenario, failedAt: number[]) =>
  failedAt.slice(0, -1).map((at, index) => (s.api.requests[index + 1]?.at ?? NaN) - at);

type EventsArgs = { response: { cursor: number }; queryParams: { cursor: number | null } };

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

  it('withAutoRefresh does not execute while args are parked and fires once they are set', () => {
    const s = scenario();
    s.api.on('GET', '/locales/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getLocale = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/locales/${p.id}`);
    const ready = signal(false);
    const trigger = signal(0);

    const c = s.consumer();
    const query = c.run(() =>
      getLocale(
        withArgs(() => (ready() ? { pathParams: { id: '1' } } : null)),
        withAutoRefresh({ onSignalChanges: [trigger] }),
      ),
    );

    s.tick();
    expect(s.api.requests.length).toBe(0);

    trigger.set(1);
    s.tick();
    expect(s.api.requests.length).toBe(0);

    ready.set(true);
    s.tick();
    expect(s.api.requestCount('GET', '/locales/1')).toBe(1);

    trigger.set(2);
    s.tick();
    expect(s.api.requestCount('GET', '/locales/1')).toBe(2);
    expect(query.response()).toEqual({ id: '1' });

    c.destroy();
  });

  it('throws when a function route is created without a withArgs feature', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();

    expect(() => c.run(() => getUser())).toThrow(/withArgs/);

    c.destroy();
  });

  it('creates a function-route query without withArgs when the error is silenced', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();
    const query = c.run(() => getUser({ silenceMissingWithArgsFeatureError: true }));

    s.tick();
    expect(s.api.requests.length).toBe(0);

    query.execute({ args: { pathParams: { id: '9' } } });
    s.tick();

    expect(s.api.requestCount('GET', '/users/9')).toBe(1);
    expect(query.response()).toEqual({ id: '9' });

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

  it('restarts the polling interval from zero when args change', () => {
    const s = scenario();
    s.api.on('GET', '/rooms/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getRoom = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/rooms/${p.id}`);
    const id = signal('1');

    const c = s.consumer();
    c.run(() =>
      getRoom(
        withArgs(() => ({ pathParams: { id: id() } })),
        withPolling({ interval: 1_000 }),
      ),
    );

    s.tick();
    expect(s.api.requests.length).toBe(1);

    s.tick(600);
    expect(s.api.requests.length).toBe(1);

    id.set('2');
    s.tick();
    expect(s.api.requests.length).toBe(2);

    // The interval armed at creation would have fired at 1000; the args change re-armed it at 600.
    s.tick(999);
    expect(s.api.requests.length).toBe(2);

    s.tick(2);
    expect(s.api.requests.length).toBe(3);

    c.destroy();
  });

  it('executes immediately only when executeInitially is set', () => {
    const s = scenario();
    s.api.on('GET', '/lazy', () => ({ body: { n: 1 } }));
    s.api.on('GET', '/eager', () => ({ body: { n: 1 } }));

    const getLazy = s.get<{ response: { n: number } }>('/lazy');
    const getEager = s.get<{ response: { n: number } }>('/eager');

    const c = s.consumer();
    c.run(() => getLazy({ onlyManualExecution: true }, withPolling({ interval: 1_000 })));
    c.run(() => getEager({ onlyManualExecution: true }, withPolling({ interval: 1_000, executeInitially: true })));

    s.tick();
    expect(s.api.requestCount('GET', '/lazy')).toBe(0);
    expect(s.api.requestCount('GET', '/eager')).toBe(1);

    s.tick(1_001);
    expect(s.api.requestCount('GET', '/lazy')).toBe(1);
    expect(s.api.requestCount('GET', '/eager')).toBe(2);

    c.destroy();
  });

  it('throws when withPolling is used on a POST query', () => {
    const s = scenario();
    s.api.on('POST', '/jobs', () => ({ body: { ok: true } }));

    const createJob = s.post<{ response: { ok: boolean } }>('/jobs');

    const c = s.consumer();

    expect(() => c.run(() => createJob(withPolling({ interval: 1_000 })))).toThrow(/withPolling/);

    c.destroy();
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

  it('ends the long-polling chain when nextArgs returns null, and restarts it on a new withArgs value', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => ({ body: { cursor: ++cursor } }));

    const getEvents = s.get<{ response: { cursor: number }; queryParams: { topic: string } }>('/events');
    const topic = signal('a');

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { topic: topic() } })),
        withLongPolling({ nextArgs: () => null, delay: 50 }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    advance(s, 5_000);
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    topic.set('b');
    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(2);

    advance(s, 5_000);
    expect(s.api.requestCount('GET', '/events')).toBe(2);

    query.execute();
    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(3);

    advance(s, 5_000);
    expect(s.api.requestCount('GET', '/events')).toBe(3);

    c.destroy();
  });

  it('waits the configured delay between long-polling rounds', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => ({ body: { cursor: ++cursor } }));

    const getEvents = s.get<EventsArgs>('/events');

    const c = s.consumer();
    c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({
          nextArgs: (response) => (response ? { queryParams: { cursor: response.cursor } } : null),
          delay: 1_000,
        }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    s.tick(999);
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    s.tick(2);
    expect(s.api.requestCount('GET', '/events')).toBe(2);

    c.destroy();
  });

  it('waits a doubling errorDelay before repeating a failed long-polling round', () => {
    const s = scenario();
    s.api.on('GET', '/events', () => ({ status: 400, body: { message: 'nope' } }));

    const getEvents = s.get<EventsArgs>('/events');
    const failedAt: number[] = [];

    const c = s.consumer();
    c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withErrorHandling({ handler: () => failedAt.push(Date.now()) }),
        withLongPolling({ nextArgs: (_, args) => args }),
      ),
    );

    s.tick();
    advance(s, 7_100);

    expect(s.api.requestCount('GET', '/events')).toBe(4);
    expect(roundRepeatDelays(s, failedAt)).toEqual([1_000, 2_000, 4_000]);

    c.destroy();

    for (let i = 0; i < 4; i++) {
      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    }
  });

  it('caps the long-polling error backoff at maxErrorDelay', () => {
    const s = scenario();
    s.api.on('GET', '/events', () => ({ status: 400, body: { message: 'nope' } }));

    const getEvents = s.get<EventsArgs>('/events');
    const failedAt: number[] = [];

    const c = s.consumer();
    c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withErrorHandling({ handler: () => failedAt.push(Date.now()) }),
        withLongPolling({ nextArgs: (_, args) => args, errorDelay: 1_000, maxErrorDelay: 1_500 }),
      ),
    );

    s.tick();
    advance(s, 4_100);

    expect(s.api.requestCount('GET', '/events')).toBe(4);
    expect(roundRepeatDelays(s, failedAt)).toEqual([1_000, 1_500, 1_500]);

    c.destroy();

    for (let i = 0; i < 4; i++) {
      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    }
  });

  it('stops the chain after stopAfterErrors consecutive failures and keeps the error', () => {
    const s = scenario();
    s.api.on('GET', '/events', () => ({ status: 400, body: { message: 'nope' } }));

    const getEvents = s.get<EventsArgs>('/events');

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({ nextArgs: (_, args) => args, errorDelay: 100, maxErrorDelay: 100, stopAfterErrors: 3 }),
      ),
    );

    s.tick();
    advance(s, 5_000);

    expect(s.api.requestCount('GET', '/events')).toBe(3);
    expect(query.error()?.code).toBe(400);

    c.destroy();

    for (let i = 0; i < 3; i++) {
      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    }
  });

  it('hands nextArgs a null response for a 204 round and re-asks with the same args', () => {
    const s = scenario();
    s.api.on('GET', '/events', sequence([{ body: { cursor: 7 } }, { status: 204 }]));

    const getEvents = s.get<EventsArgs>('/events');
    const seen: ({ cursor: number } | null)[] = [];

    const c = s.consumer();
    c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({
          nextArgs: (response, args) => {
            seen.push(response);

            return response ? { queryParams: { cursor: response.cursor } } : args;
          },
          delay: 100,
        }),
      ),
    );

    s.tick();
    expect(seen).toEqual([{ cursor: 7 }]);

    s.tick(101);
    expect(seen).toEqual([{ cursor: 7 }, null]);
    expect(s.api.requests[1]?.query['cursor']).toBe('7');

    s.tick(101);
    expect(s.api.requests[2]?.query['cursor']).toBe('7');
    expect(s.api.requestCount('GET', '/events')).toBe(3);

    c.destroy();
  });

  it('threads the settled round args into nextArgs even though withArgs never changes', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => ({ body: { cursor: ++cursor } }));

    const getEvents = s.get<EventsArgs>('/events');
    const seen: (EventsArgs['queryParams'] | null)[] = [];

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({
          nextArgs: (response, args) => {
            seen.push(args?.queryParams ?? null);

            return response ? { queryParams: { cursor: response.cursor } } : null;
          },
          delay: 100,
        }),
      ),
    );

    s.tick();
    s.tick(101);
    s.tick(101);

    expect(seen).toEqual([{ cursor: null }, { cursor: 1 }, { cursor: 2 }]);
    expect(query.args()).toEqual({ queryParams: { cursor: null } });

    c.destroy();
  });

  it('cancels the pending long-polling round on a new withArgs value', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => ({ body: { cursor: ++cursor } }));

    const getEvents = s.get<{ response: { cursor: number }; queryParams: { topic: string } }>('/events');
    const topic = signal('a');

    const c = s.consumer();
    c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { topic: topic() } })),
        withLongPolling({ nextArgs: (_, args) => args, delay: 1_000 }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    s.tick(500);
    topic.set('b');
    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(2);

    // The round the first chain armed for t=1000 must not fire.
    s.tick(510);
    expect(s.api.requestCount('GET', '/events')).toBe(2);

    c.destroy();
  });

  it('cancels the pending long-polling round on reset()', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => ({ body: { cursor: ++cursor } }));

    const getEvents = s.get<EventsArgs>('/events');

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({ nextArgs: (_, args) => args, delay: 1_000 }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/events')).toBe(1);

    query.reset();
    s.tick();

    advance(s, 3_000);
    expect(s.api.requestCount('GET', '/events')).toBe(1);
    expect(query.response()).toBeNull();

    c.destroy();
  });

  it('throws when withLongPolling is used on a POST query', () => {
    const s = scenario();
    s.api.on('POST', '/jobs', () => ({ body: { ok: true } }));

    const createJob = s.post<{ response: { ok: boolean } }>('/jobs');

    const c = s.consumer();

    expect(() => c.run(() => createJob(withLongPolling({ nextArgs: () => null })))).toThrow(/withLongPolling/);

    c.destroy();
  });

  it('throws when withLongPolling and withPolling are combined', () => {
    const s = scenario();
    s.api.on('GET', '/events', () => ({ body: { cursor: 1 } }));

    const getEvents = s.get<{ response: { cursor: number } }>('/events');

    const c = s.consumer();

    // The long polling feature is passed first so it throws before the interval feature arms a timer.
    expect(() =>
      c.run(() => getEvents(withLongPolling({ nextArgs: () => null }), withPolling({ interval: 1_000 }))),
    ).toThrow(/withLongPolling/);

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

  it('throws when withAutoRefresh meets onlyManualExecution, and runs with ignoreOnlyManualExecution', () => {
    const s = scenario();
    s.api.on('GET', '/status', () => ({ body: { ok: true } }));

    const getStatus = s.get<{ response: { ok: boolean } }>('/status');
    const trigger = signal(0);

    const c = s.consumer();

    expect(() =>
      c.run(() => getStatus({ onlyManualExecution: true }, withAutoRefresh({ onSignalChanges: [trigger] }))),
    ).toThrow(/onlyManualExecution/);

    const query = c.run(() =>
      getStatus(
        { onlyManualExecution: true },
        withAutoRefresh({ onSignalChanges: [trigger], ignoreOnlyManualExecution: true }),
      ),
    );

    s.tick();
    expect(s.api.requestCount('GET', '/status')).toBe(1);

    trigger.set(1);
    s.tick();

    expect(s.api.requestCount('GET', '/status')).toBe(2);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('throws when withAutoRefresh is used on a POST query', () => {
    const s = scenario();
    s.api.on('POST', '/jobs', () => ({ body: { ok: true } }));

    const createJob = s.post<{ response: { ok: boolean } }>('/jobs');
    const trigger = signal(0);

    const c = s.consumer();

    expect(() => c.run(() => createJob(withAutoRefresh({ onSignalChanges: [trigger] })))).toThrow(/withAutoRefresh/);

    c.destroy();
  });

  it('runs the success handler once per settled execution, even when the response value repeats', () => {
    const s = scenario();
    const successes: unknown[] = [];

    s.api.on('GET', '/heartbeat', () => ({ body: { ok: true } }));

    const getHeartbeat = s.get<{ response: { ok: boolean } }>('/heartbeat');

    const c = s.consumer();
    const query = c.run(() => getHeartbeat(withSuccessHandling({ handler: (r) => successes.push(r) })));

    s.tick();
    expect(successes.length).toBe(1);

    query.execute();
    s.tick();
    query.execute();
    s.tick();

    expect(s.api.requestCount('GET', '/heartbeat')).toBe(3);
    expect(successes.length).toBe(3);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('leaves response() untouched when the updater returns null', () => {
    const s = scenario();
    s.api.on('GET', '/matches/1', () => ({ body: { id: '1', score: 0 } }));

    const getMatch = s.get<{ response: { id: string; score: number } }>('/matches/1');
    const incoming = signal<{ score: number } | null>(null);

    const c = s.consumer();
    const query = c.run(() =>
      getMatch(
        withResponseUpdate({
          updater: ({ currentResponse }) => {
            const message = incoming();

            if (!message || !currentResponse || message.score < 0) return null;

            return { ...currentResponse, score: message.score };
          },
        }),
      ),
    );

    s.tick();
    expect(query.response()).toEqual({ id: '1', score: 0 });

    incoming.set({ score: -1 });
    s.tick();
    expect(query.response()).toEqual({ id: '1', score: 0 });

    incoming.set({ score: 5 });
    s.tick();
    expect(query.response()).toEqual({ id: '1', score: 5 });

    c.destroy();
  });

  it('overwrites a patched response with the next server response', () => {
    const s = scenario();
    s.api.on('GET', '/matches/1', sequence([{ body: { id: '1', score: 0 } }, { body: { id: '1', score: 9 } }]));

    const getMatch = s.get<{ response: { id: string; score: number } }>('/matches/1');
    const incoming = signal<{ score: number } | null>(null);

    const c = s.consumer();
    const query = c.run(() =>
      getMatch(
        withResponseUpdate({
          updater: ({ currentResponse }) => {
            const message = incoming();

            if (!message || !currentResponse) return null;

            return { ...currentResponse, score: message.score };
          },
        }),
      ),
    );

    s.tick();
    incoming.set({ score: 5 });
    s.tick();
    expect(query.response()).toEqual({ id: '1', score: 5 });

    query.execute();
    s.tick();

    expect(query.response()).toEqual({ id: '1', score: 9 });

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

  it('resets the page signal to the configured resetTo value', () => {
    const s = scenario();

    s.api.on('GET', '/items', ({ query }) =>
      Number(query['page']) > 2 ? { status: 416, body: { message: 'out of range' } } : { body: { items: [] } },
    );

    const getItems = s.get<{ response: { items: unknown[] }; queryParams: { page: number } }>('/items');
    const page = signal(7);

    const c = s.consumer();
    const query = c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: { page: page() } })),
        withPageResetOnError({ page, resetTo: 2 }),
      ),
    );

    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 416);
    expect(page()).toBe(2);

    s.flush();
    expect(query.response()).toEqual({ items: [] });

    c.destroy();
  });

  it('resets the page on a 500 carrying a Pagerfanta out-of-range detail', () => {
    const s = scenario();

    const pagerfantaError = {
      class: 'Pagerfanta\\Exception\\OutOfRangeCurrentPageException',
      detail: 'Page "4" does not exist. The currentPage must be inferior to "1"',
      status: 500,
      title: 'Internal Server Error',
      trace: [],
      type: 'https://tools.ietf.org/html/rfc2616#section-10',
    };

    s.api.on('GET', '/items', ({ query }) =>
      Number(query['page']) > 1 ? { status: 500, body: pagerfantaError } : { body: { items: [] } },
    );

    const getItems = s.get<{ response: { items: unknown[] }; queryParams: { page: number } }>('/items');
    const page = signal(4);

    const c = s.consumer();
    const query = c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: { page: page() } })),
        withPageResetOnError({ page }),
      ),
    );

    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    expect(page()).toBe(1);

    s.flush();
    expect(query.response()).toEqual({ items: [] });

    c.destroy();
  });

  it('resets only on the errors a custom when predicate accepts', () => {
    const s = scenario();

    s.api.on('GET', '/items', ({ query }) => {
      const page = Number(query['page']);

      if (page === 3) return { status: 404, body: { message: 'gone' } };
      if (page === 5) return { status: 400, body: { message: 'out of range' } };

      return { body: { items: [] } };
    });

    const getItems = s.get<{ response: { items: unknown[] }; queryParams: { page: number } }>('/items');
    const page = signal(3);

    const c = s.consumer();
    const query = c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: { page: page() } })),
        withPageResetOnError({ page, when: (error) => error.code === 400 }),
      ),
    );

    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 404);
    expect(page()).toBe(3);

    page.set(5);
    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    expect(page()).toBe(1);

    s.flush();
    expect(query.response()).toEqual({ items: [] });

    c.destroy();
  });

  it('recognizes a 416 through the exported isPageOutOfRangeError predicate in an error handler', () => {
    const s = scenario();

    s.api.on('GET', '/items', ({ query }) =>
      Number(query['page']) > 1 ? { status: 416, body: { message: 'out of range' } } : { body: { items: [] } },
    );

    const getItems = s.get<{ response: { items: unknown[] }; queryParams: { page: number } }>('/items');
    const page = signal(4);
    const recognized: boolean[] = [];

    const c = s.consumer();
    const query = c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: { page: page() } })),
        withErrorHandling({
          handler: (error) => {
            const outOfRange = isPageOutOfRangeError(error);

            recognized.push(outOfRange);

            if (outOfRange) page.set(1);
          },
        }),
      ),
    );

    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 416);

    expect(recognized).toEqual([true]);
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

      expect(isQueryDevtoolsEnabled()).toBe(false);
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

describe('long polling on a client with a retry policy', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ maxAttempts: 1, baseDelayMs: 10, jitter: 0 })],
  });

  it('repeats a failed long-polling round after its retries are exhausted instead of ending the chain', () => {
    const s = scenario();
    s.api.on('GET', '/events', () => ({ status: 503, body: { message: 'down' } }));

    const getEvents = s.get<EventsArgs>('/events');

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        withLongPolling({ nextArgs: (_, args) => args, errorDelay: 5_000, stopAfterErrors: 2 }),
      ),
    );

    s.tick();
    advance(s, 1_000);

    // One failed round is two HTTP attempts: the request plus its single retry.
    expect(s.api.requestCount('GET', '/events')).toBe(2);

    advance(s, 6_000);
    expect(s.api.requestCount('GET', '/events')).toBe(4);
    expect(query.error()?.code).toBe(503);

    advance(s, 20_000);
    expect(s.api.requestCount('GET', '/events')).toBe(4);

    c.destroy();

    for (let i = 0; i < 2; i++) {
      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
    }
  });
});

describe('long polling across tabs', () => {
  const CHANNEL = 'features-long-polling';

  let bus: FakeBroadcastChannelHandle;
  let locks: FakeWebLocksHandle;

  beforeEach(() => {
    bus = installFakeBroadcastChannel();
    locks = installFakeWebLocks();
  });

  afterEach(() => {
    bus.restore();
    locks.restore();
  });

  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withMultiTabSync({ channelName: CHANNEL })],
  });

  let tabCounter = 0;

  const createTab = (s: Scenario) => {
    const ref: QueryClientRef = createQueryClient({
      name: `features-long-polling-tab-${++tabCounter}`,
      baseUrl: 'https://api.test',
      keepUnusedFor: 0,
      features: [withMultiTabSync({ channelName: CHANNEL })],
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

  it('lets both tabs drive their own long-polling chain under multi-tab sync', async () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => ({ body: { cursor: ++cursor } }));

    const getEvents = s.get<EventsArgs>('/events');
    const tabB = createTab(s);
    const getEventsB = tabB.get<EventsArgs>('/events');

    const longPolling = () =>
      withLongPolling<EventsArgs>({
        nextArgs: (response) => (response ? { queryParams: { cursor: response.cursor } } : null),
        delay: 500,
      });

    const a = s.consumer();
    a.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { cursor: null } })),
        longPolling(),
      ),
    );
    tabB.run(() =>
      getEventsB(
        withArgs(() => ({ queryParams: { cursor: null } })),
        longPolling(),
      ),
    );

    await s.settle();
    await flushMultiTabSync();

    expect(s.api.requestCount('GET', '/events')).toBe(2);

    advance(s, 600);
    await flushMultiTabSync();

    expect(s.api.requestCount('GET', '/events')).toBe(4);

    a.destroy();
    tabB.destroy();
  });
});

describe('the silenceMissingWithArgsFeatureError guard', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('throws when a consumer sets silenceMissingWithArgsFeatureError next to a withArgs feature', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);

    const c = s.consumer();

    expect(() =>
      c.run(() =>
        getUser(
          { silenceMissingWithArgsFeatureError: true },
          withArgs(() => ({ pathParams: { id: '1' } })),
        ),
      ),
    ).toThrow(/silenceMissingWithArgsFeatureError/);

    c.destroy();
  });

  it('applies a batch feature to every silenced query without raising the guard', () => {
    const s = scenario();
    s.api.on('PATCH', '/posts/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const patchPost = s.patch<{ response: { id: string }; pathParams: { id: string } }>((p) => `/posts/${p.id}`);
    const successes: unknown[] = [];

    const c = s.consumer();
    const batch = c.run(() =>
      createQueryBatch({
        queryCreator: patchPost,
        args: (post: { id: string }) => ({ pathParams: { id: post.id } }),
        features: [withSuccessHandling({ handler: (response) => successes.push(response) })],
      }),
    );

    batch.run([{ id: '1' }, { id: '2' }]).subscribe();
    s.flush();

    expect(successes).toEqual([{ id: '1' }, { id: '2' }]);

    c.destroy();
  });

  it('creates a submission over a function-route creator without raising the guard', async () => {
    const s = scenario();
    s.api.on('POST', '/users/:org', ({ params }) => ({ status: 201, body: { id: params['org'] } }));

    const createUser = s.post<{ response: { id: string }; pathParams: { org: string }; body: { name: string } }>(
      (p) => `/users/${p.org}`,
    );

    const c = s.consumer();
    const submission = c.run(() =>
      createQuerySubmission({
        queryCreator: createUser,
        args: (value: { name: string }) => ({ pathParams: { org: 'acme' }, body: value }),
      }),
    );
    const testForm = c.run(() => form(signal({ name: 'ada' }), { submission: { action: submission.action } }));

    const submitted = submit(testForm);
    await s.settle();
    await submitted;

    expect(submission.query.response()).toEqual({ id: 'acme' });

    c.destroy();
  });

  it('creates a validateWithQuery validator over a function-route creator without raising the guard', async () => {
    const s = scenario();
    s.api.on('POST', '/validate/:org', () => ({ status: 204 }));

    const validate = s.post<{ response: null; pathParams: { org: string }; body: { name: string } }>(
      (p) => `/validate/${p.org}`,
    );

    const c = s.consumer();
    const testForm = c.run(() =>
      form(
        signal({ name: 'ada' }),
        schema<{ name: string }>((p) => {
          validateWithQuery(p, {
            queryCreator: validate,
            args: (ctx) => ({ pathParams: { org: 'acme' }, body: ctx.value() }),
          });
        }),
      ),
    );

    await s.settle();

    expect(s.api.requestCount('POST', '/validate/acme')).toBe(1);
    expect(testForm().errors()).toEqual([]);

    c.destroy();
  });
});

describe('features scenario with the devtools attached', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: () => [provideQueryDevtools()] });

  it('calls the devtools describer once per entry with provideQueryDevtools()', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    expect(isQueryDevtoolsEnabled()).toBe(true);

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
    expect(describer).toHaveBeenCalledTimes(1);

    query.execute();
    s.tick();

    expect(describer).toHaveBeenCalledTimes(1);

    c.destroy();
  });
});
