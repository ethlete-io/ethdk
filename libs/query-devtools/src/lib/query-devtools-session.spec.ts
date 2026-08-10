import { buildQueryDevtoolsSessionExport, BuildSessionExportOptions, slimForReport } from './query-devtools-session';

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
