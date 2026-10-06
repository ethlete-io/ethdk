import { beforeEach, describe, expect, it } from 'vitest';
import { provideQueryDevtools, withArgs } from '../index';
import {
  armQueryDevtoolsMock,
  armQueryDevtoolsOverrideTransfer,
  clearQueryDevtoolsArmedMocks,
  clearQueryDevtoolsMockStore,
  isQueryDevtoolsEnabled,
  loadQueryDevtoolsSchema,
  parseQueryDevtoolsOverrideTransfer,
  queryDevtoolsEntries,
  queryDevtoolsMockId,
  queryDevtoolsSchemaState,
  saveQueryDevtoolsMock,
  seedQueryDevtoolsSchemaBody,
} from '../../devtools-contract';
import { useScenario } from './harness';

const CLIENT_NAME = 'devtools-scan-2026-10-03';

const SCHEMA = {
  components: {
    schemas: {
      Penalty: {
        type: 'object',
        properties: {
          points: { type: 'integer', maximum: -3 },
          code: { type: 'string', maxLength: 2 },
          reason: { type: 'string', minLength: 12 },
        },
      },
    },
  },
};

describe('devtools scan 2026-10-03', () => {
  const scenario = useScenario({
    name: CLIENT_NAME,
    clientOptions: { keepUnusedFor: 0 },
    providers: () => [provideQueryDevtools({ schema: () => SCHEMA, responseHistory: Number.NaN })],
  });

  beforeEach(() => {
    clearQueryDevtoolsArmedMocks();
    clearQueryDevtoolsMockStore();
  });

  it('seeds a placeholder and a realistic body inside a maximum below zero and inside the declared lengths', async () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    loadQueryDevtoolsSchema(CLIENT_NAME);
    await s.settle();

    expect(queryDevtoolsSchemaState(CLIENT_NAME).status).toBe('ready');

    for (const style of ['placeholder', 'realistic'] as const) {
      const body = seedQueryDevtoolsSchemaBody(CLIENT_NAME, 'Penalty', style)?.body as {
        points: number;
        code: string;
        reason: string;
      };

      expect(body.points).toBeLessThanOrEqual(-3);
      expect(body.code.length).toBeLessThanOrEqual(2);
      expect(body.reason.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('serves a mock that declares one value of a query param the request repeats', async () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    const pattern = '/posts';
    const query = 'tag[]=b';
    const id = queryDevtoolsMockId({ clientName: CLIENT_NAME, method: 'GET', pattern, query });

    saveQueryDevtoolsMock({
      id,
      clientName: CLIENT_NAME,
      method: 'GET',
      pattern,
      query,
      status: 200,
      body: { title: 'designed' },
      latencyMs: 0,
      capturedAt: null,
    });
    armQueryDevtoolsMock(id, true);

    s.api.on('GET', '/posts', () => ({ body: { title: 'real' } }));

    const getPosts = s.get<{ response: { title: string }; queryParams: { tag: string[] } }>('/posts');
    const c = s.consumer();
    const posts = c.run(() => getPosts(withArgs(() => ({ queryParams: { tag: ['a', 'b'] } }))));
    await s.settle();

    expect(posts.response()).toEqual({ title: 'designed' });
    expect(s.api.requests).toHaveLength(0);

    c.destroy();
  });

  it('skips a pasted override that lacks a field its type replays with instead of arming it', async () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    s.api.on('GET', '/standings', () => ({
      body: { items: [{ id: 1 }, { id: 2 }], limit: 2, skip: 0, total: 2, live: false },
    }));

    const getStandings = s.get<{ response: { items: { id: number }[]; total: number; live: boolean } }>('/standings');
    const c = s.consumer();
    const standings = c.run(() => getStandings());
    await s.settle();

    const recorder = queryDevtoolsEntries().find((entry) => entry.handle === standings)?.overrides;

    if (!recorder) throw new Error('devtools scan 2026-10-03: the query registered no overrides recorder');

    const parsed = parseQueryDevtoolsOverrideTransfer(
      JSON.stringify([
        { type: 'paginationResize', path: [], mode: 'shrink' },
        { type: 'booleanFlip', path: ['live'] },
      ]),
    );

    if (!parsed.ok) throw new Error('devtools scan 2026-10-03: the replayable half of the paste was rejected');

    expect(parsed.skipped).toBe(1);

    armQueryDevtoolsOverrideTransfer(recorder, parsed.ops);

    expect(standings.response()).toMatchObject({ items: [{ id: 1 }, { id: 2 }], total: 2, live: true });

    recorder.clearAll();
    c.destroy();
  });

  it('keeps the default five bodies when responseHistory is not a number', async () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    let n = 0;

    s.api.on('GET', '/fixtures', () => ({ body: { run: ++n } }));

    const getFixtures = s.get<{ response: { run: number } }>('/fixtures');
    const c = s.consumer();
    const fixtures = c.run(() => getFixtures());
    await s.settle();

    fixtures.execute();
    await s.settle();

    const runs =
      queryDevtoolsEntries()
        .find((entry) => entry.handle === fixtures)
        ?.stats?.runs() ?? [];

    expect(runs.map((run) => run.response)).toEqual([{ run: 1 }, { run: 2 }]);

    c.destroy();
  });
});
