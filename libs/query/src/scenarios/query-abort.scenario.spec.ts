import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { executeUntilSettled, executeUntilSettled$, QuerySnapshot, withArgs, withLongPolling } from '../index';
import { sequence } from './harness/fake-api';
import { useScenario } from './harness';

type Item = { response: { v: number } };

describe('query abort scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('keeps the previous response and stops loading when an execution is aborted in flight', () => {
    const s = scenario();
    s.api.on('GET', '/items', sequence([{ body: { v: 1 } }, { body: { v: 2 }, delay: 500 }]));

    const getItems = s.get<Item>('/items');
    const c = s.consumer();
    const query = c.run(() => getItems());

    s.tick();
    expect(query.response()).toEqual({ v: 1 });

    query.execute();
    s.tick(50);
    expect(query.loading()).not.toBeNull();

    expect(query.abort()).toBe(true);

    expect(query.loading()).toBeNull();
    expect(query.response()).toEqual({ v: 1 });
    expect(query.error()).toBeNull();
    expect(query.executionState()).toEqual({ type: 'success', response: { v: 1 } });
    expect(s.api.pending()).toHaveLength(0);

    s.tick(1000);
    expect(query.response()).toEqual({ v: 1 });
    expect(query.executionState()).toEqual({ type: 'success', response: { v: 1 } });
  });

  it('keeps the previous error when an execution is aborted in flight', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/failing',
      sequence([
        { status: 500, body: { message: 'boom' } },
        { body: { v: 2 }, delay: 500 },
      ]),
    );

    const getFailing = s.get<Item>('/failing');
    const c = s.consumer();
    const query = c.run(() => getFailing());

    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    const previousError = query.error();
    expect(previousError?.code).toBe(500);

    query.execute();
    s.tick(50);
    expect(query.abort()).toBe(true);

    expect(query.loading()).toBeNull();
    expect(query.error()).toBe(previousError);
    expect(query.response()).toBeNull();
    expect(query.executionState()).toEqual({ type: 'failure', error: previousError, hasCachedResponse: false });

    s.tick(1000);
    expect(query.error()).toBe(previousError);
  });

  it('returns false and changes nothing when nothing is in flight', () => {
    const s = scenario();
    s.api.on('POST', '/idle', () => ({ body: { v: 1 } }));

    const createIdle = s.post<Item>('/idle');
    const c = s.consumer();
    const query = c.run(() => createIdle());

    expect(query.abort()).toBe(false);
    expect(query.executionState()).toBeNull();

    query.execute();
    s.tick();

    expect(query.abort()).toBe(false);
    expect(query.executionState()).toEqual({ type: 'success', response: { v: 1 } });
  });

  it('leaves a query that never settled in the never-executed state', () => {
    const s = scenario();
    s.api.on('GET', '/slow', () => ({ body: { v: 1 }, delay: 500 }));

    const getSlow = s.get<Item>('/slow');
    const c = s.consumer();
    const query = c.run(() => getSlow());

    s.tick(50);
    expect(query.abort()).toBe(true);

    expect(query.executionState()).toBeNull();
    expect(query.response()).toBeNull();
    expect(query.error()).toBeNull();
    expect(query.lastTimeExecutedAt()).not.toBeNull();

    s.tick(1000);
    expect(query.response()).toBeNull();
  });

  it('stops a retry the request is waiting out', () => {
    const s = scenario();
    s.api.on('GET', '/flaky', () => ({ status: 500, body: { message: 'down' } }));

    const getFlaky = s.get<Item>('/flaky', {
      retryFn: ({ retryCount }) => ({ retry: retryCount < 3, delay: 1000 }),
    });
    const c = s.consumer();
    const query = c.run(() => getFlaky());

    s.tick(10);
    expect(s.api.requestCount('GET', '/flaky')).toBe(1);
    expect(query.subtle.request()?.subtle.retryState()).not.toBeNull();

    expect(query.abort()).toBe(true);

    expect(query.loading()).toBeNull();
    expect(query.subtle.request()?.subtle.retryState()).toBeNull();

    s.tick(5000);
    expect(s.api.requestCount('GET', '/flaky')).toBe(1);
    expect(query.error()).toBeNull();
    expect(query.executionState()).toBeNull();
  });

  it('completes an executeUntilSettled$ in flight without a value', () => {
    const s = scenario();
    s.api.on('POST', '/things', () => ({ body: { v: 1 }, delay: 500 }));

    const createThing = s.post<Item & { body: { n: number } }>('/things');
    const c = s.consumer();
    const query = c.run(() => createThing());

    const emitted: unknown[] = [];
    let completed = false;

    executeUntilSettled$(query, { args: { body: { n: 1 } } }).subscribe({
      next: (snapshot) => emitted.push(snapshot),
      complete: () => (completed = true),
    });

    s.tick(50);
    expect(query.abort()).toBe(true);
    s.tick(1);

    expect(completed).toBe(true);
    expect(emitted).toEqual([]);

    s.tick(1000);
    expect(emitted).toEqual([]);
    expect(query.response()).toBeNull();
  });

  it('resolves executeUntilSettled with an empty snapshot marked as cancelled', async () => {
    const s = scenario();
    s.api.on('POST', '/things', () => ({ body: { v: 1 }, delay: 500 }));

    const createThing = s.post<Item & { body: { n: number } }>('/things');
    const c = s.consumer();
    const query = c.run(() => createThing());

    let snapshot: QuerySnapshot<Item & { body: { n: number } }> | undefined;
    void executeUntilSettled(query, { args: { body: { n: 1 } } }).then((settled) => (snapshot = settled));

    s.tick(50);
    query.abort();
    await s.settle(1);

    expect(snapshot?.isAlive()).toBe(false);
    expect(snapshot?.response()).toBeNull();
    expect(snapshot?.error()).toBeNull();
    expect(snapshot?.executionState()).toBeNull();
    expect(snapshot?.latestHttpEvent()).toEqual({ type: 'cancel' });
  });

  it('runs the next execute normally after an abort', () => {
    const s = scenario();
    s.api.on('GET', '/again', sequence([{ body: { v: 1 }, delay: 500 }, { body: { v: 2 } }]));

    const getAgain = s.get<Item>('/again');
    const c = s.consumer();
    const query = c.run(() => getAgain());

    s.tick(50);
    query.abort();

    query.execute();
    s.tick();

    expect(query.response()).toEqual({ v: 2 });
    expect(query.executionState()).toEqual({ type: 'success', response: { v: 2 } });
    expect(s.api.requestCount('GET', '/again')).toBe(2);
  });

  it('ends a long-polling chain until execute() or a new withArgs value starts it again', () => {
    const s = scenario();
    let cursor = 0;

    s.api.on('GET', '/events', () => ({ body: { cursor: ++cursor }, delay: 500 }));

    const getEvents = s.get<{ response: { cursor: number }; queryParams: { topic: string; cursor: number | null } }>(
      '/events',
    );
    const topic = signal('a');

    const c = s.consumer();
    const query = c.run(() =>
      getEvents(
        withArgs(() => ({ queryParams: { topic: topic(), cursor: null } })),
        withLongPolling({
          nextArgs: (response, args) =>
            response && args ? { queryParams: { ...args.queryParams, cursor: response.cursor } } : null,
          delay: 50,
        }),
      ),
    );

    s.tick(500);
    expect(query.response()).toEqual({ cursor: 1 });

    s.tick(100);
    expect(s.api.pending()).toHaveLength(1);

    expect(query.abort()).toBe(true);
    expect(query.response()).toEqual({ cursor: 1 });

    s.tick(5000);
    expect(s.api.requestCount('GET', '/events')).toBe(2);

    query.execute();
    s.tick(500);
    expect(query.response()).toEqual({ cursor: 3 });

    s.tick(50);
    expect(s.api.requestCount('GET', '/events')).toBe(4);

    expect(query.abort()).toBe(true);
    s.tick(5000);
    expect(s.api.requestCount('GET', '/events')).toBe(4);

    topic.set('b');
    s.tick(500);
    expect(query.response()).toEqual({ cursor: 5 });
    expect(query.args()?.queryParams.topic).toBe('b');

    c.destroy();
  });
});
