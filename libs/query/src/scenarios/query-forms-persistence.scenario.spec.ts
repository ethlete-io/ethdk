import {
  QueryFormPersistence,
  QueryFormStorage,
  dateQueryField,
  defineQueryForm,
  queryField,
  searchQueryField,
  sortQueryField,
  withArgs,
} from '../index';
import { beforeEach, describe, expect, it } from 'vitest';
import { useScenario } from './harness';

const createMemoryStorage = () => {
  const entries = new Map<string, string>();
  const storage: QueryFormStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };

  return { entries, storage };
};

const listFields = () => ({
  query: searchQueryField(),
  sort: sortQueryField(),
  from: dateQueryField(),
  wide: queryField<boolean>({ defaultValue: false }),
  page: queryField<number>({ defaultValue: 1, isResetBy: ['query', 'sort'] }),
});

describe('query form persistence scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  beforeEach(() => sessionStorage.clear());

  it('restores the stored state when the URL is empty, and the first request carries it', async () => {
    const s = scenario();
    const { storage } = createMemoryStorage();
    const persistence: QueryFormPersistence = { key: 'players', storage };

    const first = s.consumer();
    const qf = first.run(() => defineQueryForm({ fields: listFields() }).observe({ persistence }));

    qf.patchValue({ query: 'messi', sort: { active: 'name', direction: 'desc' }, from: new Date('2026-01-02') });
    qf.patchValue({ page: 3 });
    await s.settle();
    first.destroy();

    await s.reloadAt('/');
    s.api.on('GET', '/players', () => ({ body: [] }));
    const getPlayers = s.get<{ response: unknown[]; queryParams: { query: string | null; page: number | null } }>(
      '/players',
    );

    const second = s.consumer();
    const restored = second.run(() => defineQueryForm({ fields: listFields() }).observe({ persistence }));
    second.run(() =>
      getPlayers(withArgs(() => ({ queryParams: { query: restored.value().query, page: restored.value().page } }))),
    );
    await s.settle();

    expect(restored.value()).toEqual({
      query: 'messi',
      sort: { active: 'name', direction: 'desc' },
      from: new Date('2026-01-02'),
      wide: false,
      page: 3,
    });
    expect(s.api.requests.filter((request) => request.path === '/players').map((request) => request.query)).toEqual([
      { query: 'messi', page: '3' },
    ]);
  });

  it('keeps a seed written before observe() when the navigation that led here removed its params', async () => {
    const s = scenario();

    const earlier = s.consumer();
    earlier.run(() => defineQueryForm({ fields: listFields() }).observe()).patchValue({ query: 'messi' });
    await s.settle();
    earlier.destroy();

    await s.reloadAt('/');

    const qf = s.run(() => defineQueryForm({ fields: listFields() }));

    qf.patchValue({ query: 'kane' });
    s.run(() => qf.observe());
    await s.settle();

    expect(qf.value().query).toBe('kane');
  });

  it('lets a URL that carries a persisted field win, without merging the stored state into it', async () => {
    const s = scenario();
    const { storage } = createMemoryStorage();
    const persistence: QueryFormPersistence = { key: 'players', storage };

    const first = s.consumer();
    const qf = first.run(() => defineQueryForm({ fields: listFields() }).observe({ persistence }));

    qf.patchValue({ query: 'messi', page: 3 }, { skipResets: true });
    await s.settle();
    first.destroy();

    await s.reloadAt('/?page=2');

    const restored = s.run(() => defineQueryForm({ fields: listFields() }).observe({ persistence }));

    expect(restored.value()).toEqual({ query: null, sort: null, from: null, wide: false, page: 2 });
  });

  it('persists and checks only the listed fields', async () => {
    const s = scenario();
    const { entries, storage } = createMemoryStorage();
    const persistence: QueryFormPersistence = { key: 'players', storage, fields: ['query', 'page'] };

    const first = s.consumer();
    const qf = first.run(() => defineQueryForm({ fields: listFields() }).observe({ persistence }));

    qf.patchValue({ query: 'messi', page: 3, wide: true }, { skipResets: true });
    await s.settle();
    first.destroy();

    expect(JSON.parse(entries.get('players') ?? '')).toEqual({ query: 'messi', page: 3 });

    await s.reloadAt('/?wide=true');

    const restored = s.run(() => defineQueryForm({ fields: listFields() }).observe({ persistence }));

    expect(restored.value()).toEqual({ query: 'messi', sort: null, from: null, wide: true, page: 3 });
  });

  it("uses the browser's sessionStorage for 'session', and stores nothing without the option", async () => {
    const s = scenario();

    const unpersisted = s.consumer();
    unpersisted.run(() => defineQueryForm({ fields: listFields() }).observe()).patchValue({ query: 'kane' });
    await s.settle();
    unpersisted.destroy();

    expect(sessionStorage.length).toBe(0);

    await s.reloadAt('/');

    const qf = s.run(() =>
      defineQueryForm({ fields: listFields() }).observe({ persistence: { key: 'players', storage: 'session' } }),
    );

    qf.patchValue({ query: 'messi' });

    expect(JSON.parse(sessionStorage.getItem('players') ?? '')).toEqual({ query: 'messi' });
  });

  it('keeps working when the storage throws or holds garbage', async () => {
    const s = scenario();
    const throwing: QueryFormStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };

    const qf = s.run(() =>
      defineQueryForm({ fields: listFields() }).observe({ persistence: { key: 'players', storage: throwing } }),
    );

    qf.patchValue({ query: 'messi' });
    expect(qf.value().query).toBe('messi');

    const { entries, storage } = createMemoryStorage();
    entries.set('other', '{not json');

    const other = s.run(() =>
      defineQueryForm({ fields: listFields(), queryParamPrefix: 'other' }).observe({
        persistence: { key: 'other', storage },
      }),
    );

    expect(other.value().query).toBeNull();
    await s.settle();
  });
});
