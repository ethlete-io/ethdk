import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearQueryDevtoolsOverrideStore,
  isQueryDevtoolsEnabled,
  provideQueryDevtools,
  queryDevtoolsEntries,
  withArgs,
  withDefaultRetry,
  withPolling,
} from '../index';
import { sequence, useScenario } from './harness';

const FIRST = new Date('2026-01-02T03:04:05.000Z');
const SECOND = new Date('2026-02-03T04:05:06.000Z');
const INVALID = new Date('not a date');

const sentQuery = (url: string | undefined) => decodeURIComponent(url?.split('?')[1] ?? '');

describe.each([
  {
    objectNotation: 'bracket' as const,
    expected: `from=${FIRST.toISOString()}&dates[]=${FIRST.toISOString()}&dates[]=${SECOND.toISOString()}&filter[after]=${FIRST.toISOString()}`,
  },
  {
    objectNotation: 'dot' as const,
    expected: `from=${FIRST.toISOString()}&dates[]=${FIRST.toISOString()}&dates[]=${SECOND.toISOString()}&filter.after=${FIRST.toISOString()}`,
  },
  {
    objectNotation: 'json-stringify' as const,
    expected: `from=${FIRST.toISOString()}&dates=["${FIRST.toISOString()}",null,"${SECOND.toISOString()}"]&filter={"after":"${FIRST.toISOString()}"}`,
  },
])('a Date in queryParams with $objectNotation notation', ({ objectNotation, expected }) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0, queryString: { objectNotation } } });

  it('goes on the wire as its ISO string, and an invalid Date is dropped', () => {
    const s = scenario();
    s.api.on('GET', '/events', () => ({ body: [] }));

    const getEvents = s.get<{ response: unknown[]; queryParams: Record<string, unknown> }>('/events');
    const c = s.consumer();
    c.run(() =>
      getEvents(
        withArgs(() => ({
          queryParams: { from: FIRST, dates: [FIRST, INVALID, SECOND], filter: { after: FIRST }, until: INVALID },
        })),
      ),
    );
    s.tick();

    expect(sentQuery(s.api.requests[0]?.url)).toBe(expected);

    c.destroy();
  });
});

describe('http scan 2026-09-27 wave 3 scenario', () => {
  describe('a Date in queryParams and the cache key', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keys and sends one request per date value', () => {
      const s = scenario();
      s.api.on('GET', '/events', () => ({ body: [] }));

      const getEvents = s.get<{ response: unknown[]; queryParams: { from: Date } }>('/events');
      const from = signal(FIRST);
      const c = s.consumer();
      const query = c.run(() => getEvents(withArgs(() => ({ queryParams: { from: from() } }))));
      s.tick();
      const firstKey = query.id();

      from.set(SECOND);
      s.tick();
      const secondKey = query.id();

      from.set(new Date('2026-03-04T05:06:07.000Z'));
      s.tick();

      expect(s.api.requests.map((request) => sentQuery(request.url))).toEqual([
        `from=${FIRST.toISOString()}`,
        `from=${SECOND.toISOString()}`,
        'from=2026-03-04T05:06:07.000Z',
      ]);
      expect(new Set([firstKey, secondKey, query.id()]).size).toBe(3);

      c.destroy();
    });
  });

  describe('a retry resolves its headers again', () => {
    let tenant = 'first';

    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0, headers: () => ({ 'X-Tenant': tenant }) },
      clientFeatures: [withDefaultRetry({ jitter: 0 })],
    });

    beforeEach(() => {
      tenant = 'first';
    });

    it('sends the current header function result on every attempt', () => {
      const s = scenario();
      s.api.on('GET', '/flaky-tenant', sequence([{ status: 503 }, { status: 503 }, { body: { ok: true } }]));

      const getFlaky = s.get<{ response: { ok: boolean } }>('/flaky-tenant');
      const c = s.consumer();
      const query = c.run(() => getFlaky());
      s.tick();
      s.tick(1);

      tenant = 'second';
      s.tick(2_000);
      s.tick(1);

      tenant = 'third';
      s.tick(4_000);
      s.tick(1);

      expect(s.api.httpRequests('GET', '/flaky-tenant').map((request) => request.headers.get('X-Tenant'))).toEqual([
        'first',
        'second',
        'third',
      ]);
      expect(query.response()).toEqual({ ok: true });

      c.destroy();
    });
  });

  describe.each([
    {
      name: 'refreshQueriesInUse',
      refresh: (s: { client: { refreshQueriesInUse: () => void } }) => s.client.refreshQueriesInUse(),
    },
    {
      name: 'invalidateQueries',
      refresh: (s: { client: { invalidateQueries: (options?: { url?: string }) => void } }) =>
        s.client.invalidateQueries({ url: '/scores' }),
    },
  ])('triggeredBy() after $name', ({ refresh }) => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('is null on every bound query after a polling run', () => {
      const s = scenario();
      s.api.on('GET', '/scores', () => ({ body: { ok: true } }));

      const getScores = s.get<{ response: { ok: boolean } }>('/scores');
      const c = s.consumer();
      const polled = c.run(() => getScores(withPolling({ interval: 1_000 })));
      const plain = c.run(() => getScores());
      s.tick(1_000);
      s.tick(1);

      expect(polled.triggeredBy()).toBe('polling');

      refresh(s as never);
      s.tick();

      expect(polled.triggeredBy()).toBeNull();
      expect(plain.triggeredBy()).toBeNull();

      c.destroy();
    });
  });
});

describe('http scan 2026-09-27 wave 3 scenario with devtools', () => {
  const scenario = useScenario({
    name: 'http-scan-wave3-root-override',
    clientOptions: { keepUnusedFor: 0 },
    providers: () => [provideQueryDevtools()],
  });

  beforeEach(() => clearQueryDevtoolsOverrideStore());

  it('does not invent a response from a root-path override while nothing has settled', () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    s.api.on('GET', '/root-override', sequence([{ body: { title: 'Original' } }, { status: 404 }]));

    const getItem = s.get<{ response: { title: string } }>('/root-override');
    const c = s.consumer();
    const query = c.run(() => getItem());
    s.tick();

    const entry = queryDevtoolsEntries().find((candidate) => candidate.handle === query);

    if (!entry?.overrides) throw new Error('wave 3 scenario: the query registered no overrides recorder');

    entry.overrides.arm({ type: 'set', path: [], value: { title: 'Overridden' } });

    expect(query.response()).toEqual({ title: 'Overridden' });

    query.reset();
    expect(query.response()).toBeNull();

    query.execute();
    expect(query.loading()).not.toBeNull();
    expect(query.response()).toBeNull();

    s.tick();
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 404);

    expect(query.error()).not.toBeNull();
    expect(query.response()).toBeNull();

    entry.overrides.clearAll();
    c.destroy();
  });

  it('still applies a root-path override to a response that settled as null', () => {
    const s = scenario();
    s.api.on('GET', '/root-override-null', () => ({ body: null }));

    const getItem = s.get<{ response: { title: string } | null }>('/root-override-null');
    const c = s.consumer();
    const query = c.run(() => getItem());
    s.tick();

    expect(query.response()).toBeNull();

    const entry = queryDevtoolsEntries().find((candidate) => candidate.handle === query);

    if (!entry?.overrides) throw new Error('wave 3 scenario: the query registered no overrides recorder');

    entry.overrides.arm({ type: 'set', path: [], value: { title: 'Designed' } });

    expect(query.response()).toEqual({ title: 'Designed' });

    entry.overrides.clearAll();
    c.destroy();
  });
});
