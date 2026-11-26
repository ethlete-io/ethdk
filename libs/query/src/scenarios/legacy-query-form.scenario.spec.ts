import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import {
  BooleanArrayQueryField,
  DateArrayQueryField,
  DateQueryField,
  NumberArrayQueryField,
  QueryField,
  QueryForm,
  SearchQueryField,
  SortQueryField,
  StringArrayQueryField,
} from '../index';
import { useScenario } from './harness';

const createForm = () =>
  new QueryForm({
    page: new QueryField({ control: new FormControl<number | null>(1), defaultValue: 1 }),
    search: new QueryField({ control: new FormControl<string | null>(null) }),
  });

describe('legacy QueryForm scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('unobserving while a route change is in flight leaves the landing URL its own params', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => createForm().observe());

    qf.setValue({ page: 2, search: 'bar' });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '2', search: 'bar' });

    router.resetConfig([{ path: 'other', children: [] }]);

    const navigation = router.navigateByUrl('/other?page=3&search=foo');
    qf.unobserve();
    const didNavigate = await navigation;
    await s.settle();

    expect(didNavigate).toBe(true);
    expect(router.url).toBe('/other?page=3&search=foo');
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '3', search: 'foo' });

    c.destroy();
  });

  it('a form destroyed on a route change leaves the landing URL its own params', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => createForm().observe());

    qf.setValue({ page: 2, search: 'bar' });
    await s.settle();

    router.resetConfig([{ path: 'other', children: [] }]);

    const navigation = router.navigateByUrl('/other?page=3&search=foo');
    c.destroy();
    const didNavigate = await navigation;
    await s.settle();

    expect(didNavigate).toBe(true);
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '3', search: 'foo' });
  });

  it('unobserving without a route change removes the form params from the URL', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => createForm().observe());

    qf.setValue({ page: 2, search: 'bar' });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '2', search: 'bar' });

    qf.unobserve();
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({});

    c.destroy();
  });

  it('a value committed while a route change is in flight does not cancel the navigation', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => createForm().observe());

    qf.setValue({ page: 2, search: 'bar' });
    await s.settle();

    router.resetConfig([{ path: 'other', children: [] }]);

    const navigation = router.navigateByUrl('/other?page=3&search=foo');
    qf.setValue({ page: 5, search: 'baz' });
    s.tick();
    const didNavigate = await navigation;
    await s.settle();

    expect(didNavigate).toBe(true);
    expect(router.url).toBe('/other?page=3&search=foo');

    c.destroy();
  });
});

describe('legacy QueryForm without observe()', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('reports a control write on value', () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() => createForm());

    qf.controls.search.setValue('bar');
    s.tick();

    expect(qf.value).toEqual({ page: 1, search: 'bar' });

    c.destroy();
  });

  it('reports a setValue on value', () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() => createForm());

    qf.setValue({ page: 2, search: 'bar' });
    s.tick();

    expect(qf.value).toEqual({ page: 2, search: 'bar' });

    c.destroy();
  });

  it('emits a control write on changes$', () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() => createForm());

    const seen: (string | null)[] = [];
    const sub = qf.changes$.subscribe(({ currentValue }) => seen.push(currentValue.search));

    qf.controls.search.setValue('bar');
    s.tick();

    expect(seen).toEqual([null, 'bar']);

    sub.unsubscribe();
    c.destroy();
  });

  it('leaves the URL alone', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => createForm());

    qf.setValue({ page: 2, search: 'bar' });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({});

    c.destroy();
  });
});

describe('legacy QueryForm url write', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('does not re-parse its own url write, so a committed string stays a string', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() => createForm().observe());

    qf.setValue({ page: 1, search: '2024' });
    await s.settle();
    await s.settle();

    expect(typeof qf.value.search).toBe('string');
    expect(qf.value.search).toBe('2024');

    c.destroy();
  });

  it('leaves a param it mirrors with appendToUrl:false alone', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { page: '7' } });
    s.tick();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        page: new QueryField({ control: new FormControl<number | null>(1), defaultValue: 1, appendToUrl: false }),
        search: new QueryField({ control: new FormControl<string | null>(null) }),
      }).observe(),
    );
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '7' });

    qf.patchValue({ search: 'shoes' });
    await s.settle();
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '7', search: 'shoes' });

    qf.unobserve();
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '7' });

    c.destroy();
  });

  it('keeps a skipped field even when it is isResetBy one of the reset fields', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        region: new QueryField({ control: new FormControl<string | null>(null) }),
        tier: new QueryField({ control: new FormControl<string | null>(null), isResetBy: 'region' }),
      }).observe(),
    );

    qf.patchValue({ region: 'eu' });
    await s.settle();

    qf.patchValue({ tier: 'gold' });
    await s.settle();

    qf.resetAllFieldsToDefault({ skipFields: ['tier'] });
    await s.settle();

    expect(qf.controls.tier.value).toBe('gold');
    expect(qf.value).toEqual({ region: null, tier: 'gold' });

    c.destroy();
  });
});

describe('legacy QueryForm observed after a pre-observe write', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const createPaginatedForm = () =>
    new QueryForm({
      page: new QueryField({ control: new FormControl<number | null>(1), defaultValue: 1, isResetBy: 'search' }),
      search: new QueryField({ control: new FormControl<string | null>(null) }),
    });

  it('keeps a page seeded before observe() even though it is isResetBy search', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => createPaginatedForm());

    qf.controls.search.setValue('shoes');
    qf.controls.page.setValue(3);
    s.tick();

    qf.observe();
    await s.settle();
    await s.settle();

    expect(qf.controls.page.value).toBe(3);
    expect(qf.value).toEqual({ page: 3, search: 'shoes' });
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '3', search: 'shoes' });

    qf.unobserve();
    await s.settle();
    c.destroy();
  });

  it('keeps a page seeded by setValue before observe() when the writes and observe() share a tick', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => createPaginatedForm());

    qf.controls.search.setValue('shoes');
    qf.controls.page.setValue(3);
    qf.observe();
    await s.settle();
    await s.settle();

    expect(qf.controls.page.value).toBe(3);
    expect(qf.value).toEqual({ page: 3, search: 'shoes' });
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '3', search: 'shoes' });

    qf.unobserve();
    await s.settle();
    c.destroy();
  });
});

describe('legacy QueryForm url read', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const field = <T>(
    defaultValue: T | null = null,
    extra: Partial<ConstructorParameters<typeof QueryField<T>>[0]> = {},
  ) => new QueryField<T | null>({ control: new FormControl<T | null>(defaultValue), defaultValue, ...extra });

  const commit = async (s: ReturnType<typeof scenario>) => {
    for (let i = 0; i < 3; i++) await s.settle(1);
  };

  const navigate = async (s: ReturnType<typeof scenario>, queryParams: Record<string, string | null>) => {
    await TestBed.inject(Router).navigate([], { queryParams, queryParamsHandling: 'merge' });
    await commit(s);
  };

  it('converts numbers and booleans, but keeps strings that only look like numbers', async () => {
    const s = scenario();

    await navigate(s, {
      page: '2',
      active: 'true',
      archived: 'false',
      code: '007',
      padded: ' 5',
      version: '1.',
      limit: 'abc',
      raw: '42',
    });

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        page: field<number>(1),
        active: field<boolean>(),
        archived: field<boolean>(),
        code: field<string>(),
        padded: field<string>(),
        version: field<string>(),
        limit: field<number>(10),
        raw: field<string>(null, { skipAutoTransform: true }),
      }).observe(),
    );
    await commit(s);

    expect(qf.value).toEqual({
      page: 2,
      active: true,
      archived: false,
      code: '007',
      padded: ' 5',
      version: '1.',
      limit: null,
      raw: '42',
    });

    c.destroy();
  });

  it('reads ET_NULL__ as null and writes null over a non-null default as ET_NULL__', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await navigate(s, { status: 'ET_NULL__' });

    const c = s.consumer();
    const qf = c.run(() => new QueryForm({ status: field<string>('open') }).observe());
    await commit(s);

    expect(qf.value).toEqual({ status: null });

    qf.setValue({ status: 'closed' });
    await commit(s);
    qf.setValue({ status: null });
    await commit(s);

    expect(router.parseUrl(router.url).queryParams).toEqual({ status: 'ET_NULL__' });

    c.destroy();
  });

  it('falls back to the default when a navigation removes the param', async () => {
    const s = scenario();

    await navigate(s, { page: '3', search: 'shoes' });

    const c = s.consumer();
    const qf = c.run(() => new QueryForm({ page: field<number>(1), search: field<string>() }).observe());
    await commit(s);

    expect(qf.value).toEqual({ page: 3, search: 'shoes' });

    await navigate(s, { page: null, search: null });
    await commit(s);

    expect(qf.value).toEqual({ page: 1, search: null });

    c.destroy();
  });

  it('resets a chain of isResetBy fields and commits the settled value once', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        country: field<string>(),
        league: field<string>(null, { isResetBy: 'country' }),
        team: field<string>(null, { isResetBy: 'league' }),
      }).observe(),
    );

    qf.setValue({ country: 'de', league: 'bl', team: 'fcb' }, { skipResets: true });
    await commit(s);

    const seen: unknown[] = [];
    const sub = qf.changes$.subscribe(({ currentValue }) => seen.push(currentValue));

    qf.patchValue({ country: 'es' });
    await commit(s);

    expect(qf.value).toEqual({ country: 'es', league: null, team: null });
    expect(seen).toEqual([
      { country: 'de', league: 'bl', team: 'fcb' },
      { country: 'es', league: null, team: null },
    ]);

    sub.unsubscribe();
    c.destroy();
  });

  it('resets an isResetBy field when a navigation changes its parent', async () => {
    const s = scenario();

    await navigate(s, { search: 'shoes', page: '4' });

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({ page: field<number>(1, { isResetBy: 'search' }), search: field<string>() }).observe(),
    );
    await commit(s);

    expect(qf.value).toEqual({ page: 4, search: 'shoes' });

    await navigate(s, { search: 'boots' });
    await commit(s);

    expect(qf.value).toEqual({ page: 1, search: 'boots' });

    c.destroy();
  });

  it('skipResets keeps an isResetBy field the same write changes the parent of', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({ page: field<number>(1, { isResetBy: 'search' }), search: field<string>() }).observe(),
    );

    qf.setValue({ page: 3, search: 'shoes' }, { skipResets: true });
    await commit(s);

    expect(qf.value).toEqual({ page: 3, search: 'shoes' });

    qf.patchValue({ search: 'boots' });
    await commit(s);

    expect(qf.value).toEqual({ page: 1, search: 'boots' });

    c.destroy();
  });

  it('debounces a typed search but commits a cleared one at once', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() => new QueryForm({ search: new SearchQueryField() }).observe({ writeToQueryParams: false }));

    qf.controls.search.setValue('shoes');
    s.tick(50);
    expect(qf.value.search).toBeNull();

    s.tick(300);
    expect(qf.value.search).toBe('shoes');

    qf.controls.search.setValue(null);
    s.tick(1);

    expect(qf.value.search).toBeNull();

    c.destroy();
  });

  it('applies a search from a navigation without waiting out the debounce', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() => new QueryForm({ search: new SearchQueryField() }).observe());
    await commit(s);

    await TestBed.inject(Router).navigate([], { queryParams: { search: 'boots' } });
    s.tick(1);

    expect(qf.value.search).toBe('boots');

    c.destroy();
  });
});

describe('legacy QueryForm field types and helpers', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const commit = async (s: ReturnType<typeof scenario>) => {
    for (let i = 0; i < 3; i++) await s.settle(1);
  };

  const urlParams = () => {
    const router = TestBed.inject(Router);

    return router.parseUrl(router.url).queryParams;
  };

  it('restores the array and date field types from the URL', async () => {
    const s = scenario();

    await TestBed.inject(Router).navigate([], {
      queryParams: {
        tags: ['a', 'b'],
        ids: ['1', 'x', '2'],
        flags: ['true', '0'],
        days: '2026-09-01',
        day: '2026-09-02',
      },
    });
    await commit(s);

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        tags: new StringArrayQueryField(),
        ids: new NumberArrayQueryField(),
        flags: new BooleanArrayQueryField(),
        days: new DateArrayQueryField(),
        day: new DateQueryField(),
      }).observe(),
    );
    await commit(s);

    expect(qf.value).toEqual({
      tags: ['a', 'b'],
      ids: [1, 2],
      flags: [true, false],
      days: [new Date(2026, 8, 1)],
      day: new Date(2026, 8, 2),
    });

    c.destroy();
  });

  it('counts the fields off their default in activeFilterCount$, comparing arrays, dates and objects by value', async () => {
    const s = scenario();
    const from = new Date('2026-01-01T00:00:00.000Z');

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        page: new QueryField({ control: new FormControl<number | null>(1), defaultValue: 1 }),
        status: new QueryField({ control: new FormControl<string | null>('open') }),
        tags: new StringArrayQueryField({ control: new FormControl<string[] | null>(['a']) }),
        from: new DateQueryField({ control: new FormControl<Date | null>(from) }),
        range: new QueryField({ control: new FormControl<{ min: number } | null>({ min: 0 }) }),
        hidden: new QueryField({ control: new FormControl<string | null>(null), skipInFilterCount: true }),
      }).observe({ writeToQueryParams: false }),
    );

    const counts: number[] = [];
    const subscription = qf.activeFilterCount$.subscribe((count) => counts.push(count));
    await commit(s);

    expect(qf.defaultFormValue).toEqual({
      page: 1,
      status: 'open',
      tags: ['a'],
      from,
      range: { min: 0 },
      hidden: null,
    });

    qf.setValue({ page: 4, status: 'closed', tags: ['b'], from: new Date(from), range: { min: 0 }, hidden: 'x' });
    await commit(s);
    qf.patchValue({ tags: ['a'], range: { min: 5 }, from: new Date('2026-02-01T00:00:00.000Z') });
    await commit(s);

    expect(counts.at(0)).toBe(0);
    expect(counts.at(-1)).toBe(3);
    expect(counts).toContain(2);

    subscription.unsubscribe();
    c.destroy();
  });

  it('warns and keeps the first observation when observe() is called twice', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(
      () => new QueryForm({ search: new QueryField({ control: new FormControl<string | null>(null) }) }),
    );

    expect(qf.observe({ writeToQueryParams: false })).toBe(qf);
    expect(qf.observe()).toBe(qf);
    s.expectWarning(/observe\(\) was called multiple times/);

    qf.setValue({ search: 'shoes' });
    await commit(s);

    expect(qf.value.search).toBe('shoes');
    expect(urlParams()).toEqual({});

    c.destroy();
  });

  it('reports a patchValue before observe() on value', () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(
      () =>
        new QueryForm({
          search: new QueryField({ control: new FormControl<string | null>(null) }),
          page: new QueryField({ control: new FormControl<number | null>(1) }),
        }),
    );

    qf.patchValue({ search: 'shoes' });

    expect(qf.value).toEqual({ search: 'shoes', page: 1 });

    c.destroy();
  });

  it('resets a field to its default, clearing its isResetBy children unless skipResets is passed', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        country: new QueryField({ control: new FormControl<string | null>(null) }),
        league: new QueryField({ control: new FormControl<string | null>(null), isResetBy: ['country'] }),
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ country: 'de', league: 'bl' }, { skipResets: true });
    await commit(s);

    qf.resetFieldToDefault('country', { skipResets: true });
    await commit(s);
    expect(qf.value).toEqual({ country: null, league: 'bl' });

    qf.setValue({ country: 'fr', league: 'l1' }, { skipResets: true });
    await commit(s);

    qf.resetFieldToDefault('country');
    await commit(s);
    expect(qf.value).toEqual({ country: null, league: null });

    qf.setValue({ country: 'es', league: 'll' }, { skipResets: true });
    await commit(s);

    qf.resetFieldsToDefault(['country'], { skipResets: true });
    await commit(s);
    expect(qf.value).toEqual({ country: null, league: 'll' });

    qf.patchValue({ country: 'it' }, { skipResets: true });
    await commit(s);
    expect(qf.value).toEqual({ country: 'it', league: 'll' });

    c.destroy();
  });

  it('warns about an isResetBy key that names no field', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        country: new QueryField({ control: new FormControl<string | null>(null) }),
        league: new QueryField({ control: new FormControl<string | null>('bl'), isResetBy: 'contry' }),
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ country: 'de', league: 'bl' });
    await commit(s);

    expect(qf.value).toEqual({ country: 'de', league: 'bl' });
    s.expectWarning(/"contry" is not defined in the QueryForm/);

    c.destroy();
  });

  it.each([
    { name: 'a string', queryParamPrefix: 'users' },
    { name: 'a function', queryParamPrefix: () => 'users' },
  ])('prefixes its URL params with $name prefix', async ({ queryParamPrefix }) => {
    const s = scenario();

    await TestBed.inject(Router).navigate([], { queryParams: { 'users-page': '3' } });
    await commit(s);

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm(
        { page: new QueryField({ control: new FormControl<number | null>(1), defaultValue: 1 }) },
        { queryParamPrefix },
      ).observe(),
    );
    await commit(s);

    expect(qf.value.page).toBe(3);

    qf.setValue({ page: 4 });
    await commit(s);

    expect(urlParams()).toEqual({ 'users-page': '4' });

    c.destroy();
  });

  it('writes a sort as active:direction and falls back to the default for a sort without a direction', async () => {
    const s = scenario();

    await TestBed.inject(Router).navigate([], { queryParams: { sort: 'name:desc' } });
    await commit(s);

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        sort: new SortQueryField(),
        search: new QueryField({ control: new FormControl<string | null>(null) }),
      }).observe(),
    );
    await commit(s);

    expect(qf.value.sort).toEqual({ active: 'name', direction: 'desc' });

    qf.patchValue({ sort: { active: 'age', direction: 'asc' } });
    await commit(s);
    expect(urlParams()).toEqual({ sort: 'age:asc' });

    qf.patchValue({ sort: { active: 'age', direction: '' } });
    await commit(s);

    expect(qf.value.sort).toBeNull();
    expect(urlParams()).toEqual({});

    qf.patchValue({ search: 'shoes' });
    await commit(s);

    expect(qf.value).toEqual({ sort: null, search: 'shoes' });
    expect(urlParams()).toEqual({ search: 'shoes' });

    c.destroy();
  });
});

describe('legacy QueryForm function defaults', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const commit = async (s: ReturnType<typeof scenario>) => {
    for (let i = 0; i < 3; i++) await s.settle(1);
  };

  const urlParams = () => {
    const router = TestBed.inject(Router);

    return router.parseUrl(router.url).queryParams;
  };

  it('treats a value equal to a function default as the default', async () => {
    const s = scenario();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({
        status: new QueryField({ control: new FormControl<string | null>('open'), defaultValue: () => 'open' }),
      }).observe(),
    );

    let count = -1;
    const subscription = qf.activeFilterCount$.subscribe((value) => (count = value));

    qf.setValue({ status: 'closed' });
    await commit(s);
    qf.setValue({ status: 'open' });
    await commit(s);

    expect(urlParams()).toEqual({});
    expect(count).toBe(0);
    expect(qf.defaultFormValue).toEqual({ status: 'open' });

    subscription.unsubscribe();
    c.destroy();
  });
});
