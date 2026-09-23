import { defineQueryForm, queryField, searchQueryField, withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('query form writes from code scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const defineListForm = () =>
    defineQueryForm({
      fields: {
        search: searchQueryField(),
        region: queryField<string>({ debounce: 200 }),
        page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'region'] }),
      },
    });

  it('reflects setValue and patchValue in value() on the next line, resets included', () => {
    const s = scenario();
    const qf = s.run(() => defineListForm().observe({ writeToQueryParams: false }));

    qf.setValue({ search: null, region: null, page: 4 });
    expect(qf.value()).toEqual({ search: null, region: null, page: 4 });

    qf.patchValue({ search: 'shoes' });
    expect(qf.value()).toEqual({ search: 'shoes', region: null, page: 1 });
    expect(qf.previousValue()).toEqual({ search: null, region: null, page: 4 });

    qf.resetAllFieldsToDefault();
    expect(qf.value()).toEqual({ search: null, region: null, page: 1 });
  });

  it('a write before observe() is current at once and is what the first request carries', async () => {
    const s = scenario();
    s.api.on('GET', '/items', () => ({ body: [] }));
    const getItems = s.get<{ response: unknown[]; queryParams: { search: string | null; page: number | null } }>(
      '/items',
    );

    const c = s.consumer();
    const qf = c.run(() => defineListForm());

    qf.patchValue({ search: 'shoes', page: 3 }, { skipResets: true });
    expect(qf.value().search).toBe('shoes');

    c.run(() => qf.observe());
    c.run(() => getItems(withArgs(() => ({ queryParams: { search: qf.value().search, page: qf.value().page } }))));
    await s.settle();

    expect(s.api.requests.filter((request) => request.path === '/items').map((request) => request.query)).toEqual([
      { search: 'shoes', page: '3' },
    ]);
  });

  it('skips the field debounce for a write from code', async () => {
    const s = scenario();
    s.api.on('GET', '/items', () => ({ body: [] }));
    const getItems = s.get<{ response: unknown[]; queryParams: { search: string | null } }>('/items');

    const c = s.consumer();
    const qf = c.run(() => defineListForm().observe({ writeToQueryParams: false }));
    c.run(() => getItems(withArgs(() => ({ queryParams: { search: qf.value().search } }))));
    await s.settle();

    qf.patchValue({ search: 'shoes' });
    s.tick(1);

    expect(
      s.api.requests.filter((request) => request.path === '/items').map((request) => request.query['search']),
    ).toEqual([undefined, 'shoes']);
  });

  it('waits the field debounce when the write asks for it', () => {
    const s = scenario();
    const qf = s.run(() => defineListForm().observe({ writeToQueryParams: false }));

    qf.patchValue({ region: 'eu' }, { debounce: true });
    expect(qf.value().region).toBeNull();

    s.tick(150);
    qf.patchValue({ region: 'us' }, { debounce: true });
    s.tick(150);
    expect(qf.value().region).toBeNull();

    s.tick(50);
    expect(qf.value().region).toBe('us');
  });

  it('commits a branch write at once, and waits its debounce only when asked', () => {
    const s = scenario();
    const qf = s.run(() => defineListForm().observe({ writeToQueryParams: false }));
    const draft = s.run(() => qf.branch());

    draft.patchValue({ region: 'eu' });
    expect(draft.value().region).toBe('eu');

    draft.patchValue({ region: 'us' }, { debounce: true });
    s.tick(100);
    expect(draft.value().region).toBe('eu');

    s.tick(100);
    expect(draft.value().region).toBe('us');
  });
});
