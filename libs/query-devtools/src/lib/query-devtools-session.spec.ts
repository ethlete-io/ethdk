import {
  buildQueryDevtoolsSessionExport,
  BuildSessionExportOptions,
  sessionAuthQueryKey,
  slimForReport,
} from './query-devtools-session';

const NOW = 1_700_000_000_000;

const build = (overrides: Partial<BuildSessionExportOptions> = {}) =>
  buildQueryDevtoolsSessionExport({
    now: NOW,
    location: 'https://app.example.com/posts',
    about: { ethlete: { query: '0.0.0-test' }, angular: '0.0.0-test', app: null },
    clients: [],
    entries: [],
    events: [],
    faults: [],
    mocks: [],
    ...overrides,
  });

describe('slimForReport', () => {
  it('should truncate a long string', () => {
    const slimmed = slimForReport('a'.repeat(500)) as string;

    expect(slimmed).toHaveLength(201);
    expect(slimmed.endsWith('…')).toBe(true);
  });

  it('should keep a short array whole and sample a long one', () => {
    expect(slimForReport([1, 2, 3])).toEqual([1, 2, 3]);
    expect(slimForReport([1, 2, 3, 4, 5])).toEqual([1, 2, '… (3 more)']);
  });

  it('should stop descending past the depth limit', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } };

    expect(slimForReport(deep)).toEqual({ a: { b: { c: { d: { e: { f: { g: '…' } } } } } } });
  });

  it('should keep a Date, a Map, a Set, an Error and a bigint legible', () => {
    const slimmed = slimForReport({
      at: new Date(NOW),
      counts: new Map([['a', 1]]),
      tags: new Set(['x', 'y']),
      total: 10n,
      failure: new Error('boom'),
    }) as Record<string, unknown>;

    expect(slimmed['at']).toBe(new Date(NOW).toISOString());
    expect(slimmed['counts']).toEqual([['a', 1]]);
    expect(slimmed['tags']).toEqual(['x', 'y']);
    expect(slimmed['total']).toBe('10');
    expect(slimmed['failure']).toMatchObject({ name: 'Error', message: 'boom' });
    expect(() => JSON.stringify(slimmed)).not.toThrow();
  });

  it('should survive a circular reference', () => {
    const circular: Record<string, unknown> = { name: 'root' };
    circular['self'] = circular;

    expect(() => JSON.stringify(slimForReport(circular))).not.toThrow();
  });
});

describe('buildQueryDevtoolsSessionExport', () => {
  it('should stamp the envelope and count what it holds', () => {
    const result = build({
      clients: [
        {
          name: 'api',
          baseUrl: 'https://api.example.com',
          cacheEntries: 3,
          unusedCacheEntries: 1,
          cacheBytes: 2048,
          persistedEntries: null,
          features: ['multi tab sync'],
        },
      ],
      entries: [{ id: 'query|api|GET|/posts#0', kind: 'query' }],
      events: [{ timestamp: new Date(NOW).toISOString(), client: 'api', type: 'request-success' }],
      faults: [{ client: 'api', latencyMs: 500, failNext: 0, failRate: 0, status: 500 }],
      mocks: [{ client: 'api', method: 'GET', pattern: '/posts/:id', status: 200, latencyMs: 0, body: { a: 1 } }],
    });

    expect(result._type).toBe('ethlete.query:devtools-session');
    expect(result.exportedAt).toBe(new Date(NOW).toISOString());
    expect(result.location).toBe('https://app.example.com/posts');
    expect(result.counts).toEqual({
      clients: 1,
      entries: 1,
      events: 1,
      armedFaults: 1,
      armedOverrides: 0,
      armedMocks: 1,
    });
    expect(result.mocks[0]).toMatchObject({ method: 'GET', pattern: '/posts/:id' });
  });

  it('should count and slim armed overrides across every entry', () => {
    const result = build({
      entries: [
        {
          id: 'q1',
          kind: 'query',
          overrides: [
            { id: 'o1', op: { type: 'set', path: ['title'], value: 'x'.repeat(400) } },
            { id: 'o2', op: { type: 'booleanFlip', path: ['active'] } },
          ],
        },
        { id: 'q2', kind: 'query', overrides: [{ id: 'o3', op: { type: 'reset', path: ['name'] } }] },
      ],
    });

    expect(result.counts.armedOverrides).toBe(3);
    const [first] = result.entries;
    expect(first?.overrides?.[0]?.op['value']).toHaveLength(201);
  });

  it('should keep an empty overrides array as-is, like it does for runs/features', () => {
    const [entry] = build({ entries: [{ id: 'q', kind: 'query', overrides: [] }] }).entries;

    expect(entry?.overrides).toEqual([]);
  });

  it('should slim the values an entry carries', () => {
    const [entry] = build({
      entries: [
        {
          id: 'q',
          kind: 'query',
          args: { queryParams: { search: 'x'.repeat(400) } },
          response: { items: [1, 2, 3, 4, 5, 6] },
        },
      ],
    }).entries;

    expect((entry?.args as { queryParams: { search: string } }).queryParams.search).toHaveLength(201);
    expect((entry?.response as { items: unknown[] }).items).toEqual([1, 2, '… (4 more)']);
  });

  it('should leave a value field absent rather than writing null for a kind that has none', () => {
    const [entry] = build({ entries: [{ id: 'ws', kind: 'ws-client', name: 'live' }] }).entries;

    expect(entry).not.toHaveProperty('args');
    expect(entry).not.toHaveProperty('response');
  });

  it('should serialize to JSON', () => {
    const result = build({ entries: [{ id: 'q', kind: 'query', response: { ok: true } }] });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

describe('session export redaction', () => {
  it('should not put a credential-shaped field in a session export', () => {
    const result = build({
      entries: [
        {
          id: 'login',
          kind: 'query',
          client: 'https://api.example.com',
          method: 'POST',
          route: '/auth/login',
          args: { body: { email: 'dev@example.com', password: 'hunter2' } },
          response: { accessToken: 'LIVE.ACCESS.TOKEN', refreshToken: 'LIVE.REFRESH.TOKEN' },
        },
      ],
    });

    const json = JSON.stringify(result);

    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('LIVE.ACCESS.TOKEN');
    expect(json).not.toContain('LIVE.REFRESH.TOKEN');
    expect(json).toContain('dev@example.com');
  });

  it('should redact a credential in a header, at any depth and under any spelling', () => {
    const [entry] = build({
      entries: [
        {
          id: 'q',
          kind: 'query',
          args: {
            headers: { Authorization: 'Bearer LIVE.ACCESS.TOKEN', 'X-Api-Key': 'KEY', accept: 'application/json' },
            body: { nested: { deeper: { access_token: 'LIVE.ACCESS.TOKEN' } } },
          },
        },
      ],
    }).entries;

    expect(entry?.args).toEqual({
      headers: {
        Authorization: '[redacted: credential]',
        'X-Api-Key': '[redacted: credential]',
        accept: 'application/json',
      },
      body: { nested: { deeper: { access_token: '[redacted: credential]' } } },
    });
  });

  it('should keep a boolean or a number under a credential-named key', () => {
    const [entry] = build({
      entries: [
        { id: 'auth', kind: 'auth-provider', detail: { hasAccessToken: true, overriddenTokenTtlSeconds: 900 } },
      ],
    }).entries;

    expect(entry?.detail).toEqual({ hasAccessToken: true, overriddenTokenTtlSeconds: 900 });
  });

  it("should not put an auth query's tokens or credentials in a session export", () => {
    const client = 'https://api.example.com';
    const result = build({
      authQueryKeys: [
        sessionAuthQueryKey({ client, method: 'POST', route: '/auth/login' }),
        sessionAuthQueryKey({ client, method: 'POST', route: '/auth/refresh' }),
      ],
      entries: [
        {
          id: 'login',
          kind: 'query',
          client,
          method: 'POST',
          route: '/auth/login',
          args: { body: { email: 'dev@example.com', pwd: 'hunter2' } },
          response: { user: { id: 1 } },
          error: null,
        },
        {
          id: 'refresh',
          kind: 'query',
          client,
          method: 'POST',
          route: '/auth/refresh',
          args: { body: { refresh: 'LIVE.REFRESH.TOKEN' } },
          response: { access: 'LIVE.ACCESS.TOKEN', refresh: 'LIVE.REFRESH.TOKEN' },
        },
        { id: 'posts', kind: 'query', client, method: 'GET', route: '/posts', response: { items: [1, 2] } },
      ],
    });

    const [login, refresh, posts] = result.entries;

    expect(login).toMatchObject({
      args: '[redacted: auth query]',
      response: '[redacted: auth query]',
      error: '[redacted: auth query]',
    });
    expect(refresh).toMatchObject({ args: '[redacted: auth query]', response: '[redacted: auth query]' });
    expect(sessionAuthQueryKey({ client, method: 'GQL POST', route: '/graphql' })).toBe(
      sessionAuthQueryKey({ client, method: 'POST', route: '/graphql' }),
    );
    expect(posts?.response).toEqual({ items: [1, 2] });

    const json = JSON.stringify(result);

    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('LIVE.ACCESS.TOKEN');
    expect(json).not.toContain('LIVE.REFRESH.TOKEN');
  });
});
