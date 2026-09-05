import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import {
  QueryDevtoolsFormHandle,
  QueryField,
  QueryForm,
  SortQueryField,
  clearQueryDevtoolsTombstones,
  defineQueryForm,
  isQueryDevtoolsEnabled,
  numberArrayQueryField,
  provideQueryDevtools,
  queryDevtoolsEntries,
  queryField,
  searchQueryField,
  sortQueryField,
  withArgs,
  withPageResetOnError,
} from '../index';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScenario } from './harness';

const pagerfantaOutOfRange = {
  class: 'Pagerfanta\\Exception\\OutOfRangeCurrentPageException',
  detail: 'Page "5" does not exist. The currentPage must be inferior to "1"',
  status: 500,
  title: 'An error occurred',
  trace: [],
  type: 'https://tools.ietf.org/html/rfc2616#section-10',
};

describe('query forms scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('writes committed values to the URL and elides fields at their default', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() =>
      defineQueryForm({
        fields: { search: searchQueryField(), page: queryField<number>({ defaultValue: 1 }) },
      }).observe(),
    );

    qf.setValue({ search: 'shoes', page: 3 });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ search: 'shoes', page: '3' });

    qf.setValue({ search: null, page: 1 });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({});
  });

  it('applies a navigation-driven URL change back into the form', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() => defineQueryForm({ fields: { search: searchQueryField() } }).observe());

    await router.navigate([], { queryParams: { search: 'from-url' }, queryParamsHandling: 'merge' });
    s.tick();

    expect(qf.value().search).toBe('from-url');
  });

  it('cascades isResetBy transitively through a chain, but only on the commit that changes the root', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          country: queryField<string>(),
          league: queryField<string>({ isResetBy: 'country' }),
          team: queryField<string>({ isResetBy: 'league' }),
        },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ country: 'de', league: null, team: null });
    s.tick();
    expect(qf.value()).toEqual({ country: 'de', league: null, team: null });

    qf.setValue({ country: 'de', league: 'bundesliga', team: null });
    s.tick();
    expect(qf.value()).toEqual({ country: 'de', league: 'bundesliga', team: null });

    qf.setValue({ country: 'de', league: 'bundesliga', team: 'fcb' });
    s.tick();
    expect(qf.value()).toEqual({ country: 'de', league: 'bundesliga', team: 'fcb' });

    qf.setValue({ country: 'us', league: 'bundesliga', team: 'fcb' });
    s.tick();
    expect(qf.value()).toEqual({ country: 'us', league: null, team: null });
  });

  it('activeFilterCount counts only non-default, non-navigational fields', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          region: queryField<string>(),
          page: queryField<number>({ defaultValue: 1 }),
          sort: sortQueryField(),
        },
      }).observe({ writeToQueryParams: false }),
    );

    expect(qf.activeFilterCount()).toBe(0);

    qf.setValue({ region: null, page: 5, sort: { active: 'name', direction: 'asc' } });
    s.tick();
    expect(qf.activeFilterCount()).toBe(0);

    qf.setValue({ region: 'eu', page: 5, sort: { active: 'name', direction: 'asc' } });
    s.tick();
    expect(qf.activeFilterCount()).toBe(1);
  });

  it('withPageResetOnError resets a query-form page field on a 416 and the query re-executes', () => {
    const s = scenario();
    s.api.on('GET', '/items', ({ query }) =>
      Number(query['page']) > 1 ? { status: 416, body: { message: 'out of range' } } : { body: { items: [] } },
    );

    const getItems = s.get<{ response: { items: unknown[] }; queryParams: { page: number | null } }>('/items');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({ fields: { page: queryField<number>({ defaultValue: 1 }) } }).observe({
        writeToQueryParams: false,
      }),
    );

    const query = c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: qf.value() })),
        withPageResetOnError({ reset: () => qf.resetFieldToDefault('page') }),
      ),
    );

    qf.setValue({ page: 5 });
    s.tick();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 416);
    expect(qf.value().page).toBe(1);

    s.flush();
    expect(query.response()).toEqual({ items: [] });

    c.destroy();
  });

  it('branch() edits a detached copy that only reaches the source form via setValue', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({ fields: { region: queryField<string>() } }).observe({ writeToQueryParams: false }),
    );

    const draft = qf.branch();
    draft.patchValue({ region: 'eu' });
    s.tick();
    expect(qf.value().region).toBeNull();

    qf.setValue(draft.value());
    s.tick();
    expect(qf.value().region).toBe('eu');

    const discarded = qf.branch();
    discarded.patchValue({ region: 'us' });
    s.tick();
    expect(qf.value().region).toBe('eu');
  });

  it('keeps a child that the same commit also changed, while still resetting an untouched child', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { country: queryField<string>(), league: queryField<string>({ isResetBy: 'country' }) },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ country: 'de', league: 'bundesliga' });
    s.tick();

    const draft = qf.branch();
    draft.patchValue({ country: 'us' });
    s.tick();
    expect(draft.value()).toEqual({ country: 'us', league: null });

    draft.patchValue({ league: 'mls' });
    s.tick();

    qf.setValue(draft.value());
    s.tick();
    expect(qf.value()).toEqual({ country: 'us', league: 'mls' });
  });

  it('writes a field at its default to the URL when appendDefaultValueToUrl is set', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    s.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1, appendDefaultValueToUrl: true }) },
      }).observe(),
    );

    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '1' });
  });

  it('evaluates a function defaultValue fresh per form instance and per reset', () => {
    const s = scenario();
    let now = 1;

    const fields = { stamp: queryField<number>({ defaultValue: () => now }) };

    const qf1 = s.run(() => defineQueryForm({ fields }).observe({ writeToQueryParams: false }));
    expect(qf1.defaultValue.stamp).toBe(1);

    now = 2;

    const c = s.consumer();
    const qf2 = c.run(() => defineQueryForm({ fields }).observe({ writeToQueryParams: false }));
    expect(qf2.defaultValue.stamp).toBe(2);

    now = 3;
    qf2.setValue({ stamp: 999 });
    s.tick();
    expect(qf2.value().stamp).toBe(999);

    qf2.resetFieldToDefault('stamp');
    s.tick();
    expect(qf2.value().stamp).toBe(3);

    c.destroy();
  });

  it('commits a Date field away from its default', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({ fields: { stamp: queryField<Date>({ defaultValue: () => new Date(0) }) } }).observe({
        writeToQueryParams: false,
      }),
    );

    qf.setValue({ stamp: new Date(999) });
    s.tick();

    expect(qf.value().stamp?.getTime()).toBe(999);
  });

  it('numberArrayQueryField deserializes a one-item URL selection instead of dropping it', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { ids: '5' } });
    s.tick();

    const qf = s.run(() => defineQueryForm({ fields: { ids: numberArrayQueryField() } }).observe());
    s.tick();

    expect(qf.value().ids).toEqual([5]);
  });

  it("destroying a form consumer mid-navigation does not strip the next page's params", async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { page: queryField<number>({ defaultValue: 1 }) } }).observe());

    qf.setValue({ page: 3 });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '3' });

    c.destroy();

    await router.navigate([], { queryParams: { other: 'x' }, queryParamsHandling: 'merge' });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ other: 'x', page: '3' });
  });

  it('normalizes a Sort value whose valueToQueryParam returns null instead of committing it as a filter', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({ fields: { ordering: sortQueryField() } }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ ordering: { active: 'name', direction: '' } });
    s.tick();

    expect(qf.value().ordering).toBeNull();
    expect(qf.activeFilterCount()).toBe(0);
  });

  it('a no-op write with skipResets does not skip the resets of the next real change', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { search: queryField<string>(), page: queryField<number>({ defaultValue: 1, isResetBy: 'search' }) },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ search: null, page: 4 });
    s.tick();

    qf.resetFieldToDefault('search', { skipResets: true });
    s.tick();
    expect(qf.value()).toEqual({ search: null, page: 4 });

    qf.patchValue({ search: 'shoes' });
    s.tick();

    expect(qf.value()).toEqual({ search: 'shoes', page: 1 });
  });

  it('a navigation that lands during a skipResets write does not carry the skip over to the next change', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          search: searchQueryField(),
          page: queryField<number>({ defaultValue: 1, isResetBy: 'search' }),
        },
      }).observe(),
    );

    qf.setValue({ search: null, page: 4 });
    await s.settle();

    qf.patchValue({ search: 'a' }, { skipResets: true });
    s.tick(50);
    expect(qf.value()).toEqual({ search: null, page: 4 });

    await router.navigate([], { queryParams: { search: 'from-url' }, queryParamsHandling: 'merge' });
    await s.settle();
    expect(qf.value()).toEqual({ search: 'from-url', page: 4 });

    qf.patchValue({ search: 'next' });
    await s.settle(300);

    expect(qf.value()).toEqual({ search: 'next', page: 1 });
  });

  it('previousValue holds the committed value from before the latest change', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(false);

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>(), page: queryField<number>({ defaultValue: 1 }) },
      }).observe({ writeToQueryParams: false }),
    );

    expect(qf.previousValue()).toBeNull();

    qf.setValue({ region: 'eu', page: 1 });
    s.tick();
    expect(qf.previousValue()).toEqual({ region: null, page: 1 });

    qf.setValue({ region: 'us', page: 2 });
    s.tick();

    expect(qf.previousValue()).toEqual({ region: 'eu', page: 1 });
    expect(qf.value()).toEqual({ region: 'us', page: 2 });
  });

  it('changes reports the previous and current committed value of the latest commit', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>(), page: queryField<number>({ defaultValue: 1 }) },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ region: 'eu', page: 1 });
    s.tick();
    expect(qf.changes()).toEqual({
      previousValue: { region: null, page: 1 },
      currentValue: { region: 'eu', page: 1 },
    });

    qf.setValue({ region: 'us', page: 2 });
    s.tick();

    expect(qf.changes()).toEqual({
      previousValue: { region: 'eu', page: 1 },
      currentValue: { region: 'us', page: 2 },
    });
  });

  it('resetFieldsToDefault resets exactly the named fields in one commit', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>(), tier: queryField<string>(), sport: queryField<string>() },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ region: 'eu', tier: 'gold', sport: 'football' });
    s.tick();

    qf.resetFieldsToDefault(['region', 'tier']);
    s.tick();

    expect(qf.value()).toEqual({ region: null, tier: null, sport: 'football' });
    expect(qf.previousValue()).toEqual({ region: 'eu', tier: 'gold', sport: 'football' });
  });

  it('resetAllFieldsToDefault clears every field except the ones in skipFields', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          region: queryField<string>(),
          tier: queryField<string>(),
          page: queryField<number>({ defaultValue: 1 }),
        },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ region: 'eu', tier: 'gold', page: 3 });
    s.tick();

    qf.resetAllFieldsToDefault({ skipFields: ['tier'] });
    s.tick();
    expect(qf.value()).toEqual({ region: null, tier: 'gold', page: 1 });

    qf.resetAllFieldsToDefault();
    s.tick();

    expect(qf.value()).toEqual({ region: null, tier: null, page: 1 });
  });

  it('a three-hop isResetBy cascade drives exactly one query execution', () => {
    const s = scenario();
    s.api.on('GET', '/items', () => ({ body: { items: [] } }));

    const getItems = s.get<{
      response: { items: unknown[] };
      queryParams: { country: string | null; league: string | null; team: string | null };
    }>('/items');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        fields: {
          country: queryField<string>(),
          league: queryField<string>({ isResetBy: 'country' }),
          team: queryField<string>({ isResetBy: 'league' }),
        },
      }).observe({ writeToQueryParams: false }),
    );

    const query = c.run(() => getItems(withArgs(() => ({ queryParams: qf.value() }))));

    qf.setValue({ country: 'de', league: 'bundesliga', team: 'fcb' });
    s.flush();
    expect(query.response()).toEqual({ items: [] });

    const before = s.api.requestCount('GET', '/items');

    qf.patchValue({ country: 'us' });
    s.flush();

    expect(qf.value()).toEqual({ country: 'us', league: null, team: null });
    expect(s.api.requestCount('GET', '/items')).toBe(before + 1);

    c.destroy();
  });

  it.fails('a cyclic isResetBy graph stops after ten passes and warns once in dev mode', () => {
    // query-forms.md:118 - a cycle converges once both fields sit at their default, so the ten-pass
    // cap is never reached and no warning is logged.
    const s = scenario();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          region: queryField<string>({ isResetBy: 'tier' }),
          tier: queryField<string>({ isResetBy: 'region' }),
        },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ region: 'eu', tier: 'gold' });
    s.tick();

    qf.patchValue({ region: 'us' });
    s.tick();

    try {
      expect(warn.mock.calls.filter(([message]) => String(message).includes('isResetBy')).length).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('activeFilterCount ignores every documented navigation key, not just page and sort', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          page: queryField<number>({ defaultValue: 1 }),
          skip: queryField<number>({ defaultValue: 0 }),
          take: queryField<number>({ defaultValue: 10 }),
          limit: queryField<number>({ defaultValue: 10 }),
          sort: sortQueryField(),
          sortBy: queryField<string>(),
          sortOrder: queryField<string>(),
          query: queryField<string>(),
          search: queryField<string>(),
          region: queryField<string>(),
        },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({
      page: 5,
      skip: 20,
      take: 50,
      limit: 50,
      sort: { active: 'name', direction: 'asc' },
      sortBy: 'name',
      sortOrder: 'asc',
      query: 'shoes',
      search: 'shoes',
      region: null,
    });
    s.tick();
    expect(qf.activeFilterCount()).toBe(0);

    qf.patchValue({ region: 'eu' });
    s.tick();

    expect(qf.activeFilterCount()).toBe(1);
  });

  it('resets the page on a 500 carrying a Pagerfanta out-of-range detail', () => {
    const s = scenario();
    s.api.on('GET', '/items', ({ query }) =>
      Number(query['page']) > 1 ? { status: 500, body: pagerfantaOutOfRange } : { body: { items: [] } },
    );

    const getItems = s.get<{ response: { items: unknown[] }; queryParams: { page: number | null } }>('/items');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({ fields: { page: queryField<number>({ defaultValue: 1 }) } }).observe({
        writeToQueryParams: false,
      }),
    );

    const query = c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: qf.value() })),
        withPageResetOnError({ reset: () => qf.resetFieldToDefault('page') }),
      ),
    );

    qf.setValue({ page: 5 });
    s.tick();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    expect(qf.value().page).toBe(1);

    s.flush();
    expect(query.response()).toEqual({ items: [] });

    c.destroy();
  });

  it('a custom when predicate replaces the built-in out-of-range triggers', () => {
    const s = scenario();
    s.api.on('GET', '/custom', ({ query }) =>
      Number(query['page']) > 1 ? { status: 404, body: { message: 'no such page' } } : { body: { items: [] } },
    );
    s.api.on('GET', '/builtin', ({ query }) =>
      Number(query['page']) > 1 ? { status: 416, body: { message: 'out of range' } } : { body: { items: [] } },
    );

    type Listing = { response: { items: unknown[] }; queryParams: { page: number | null } };

    const getCustom = s.get<Listing>('/custom');
    const getBuiltin = s.get<Listing>('/builtin');
    const when = (error: { code: number }) => error.code === 404;

    const c = s.consumer();
    const customForm = c.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }) },
        queryParamPrefix: 'custom',
      }).observe({ writeToQueryParams: false }),
    );
    const builtinForm = c.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }) },
        queryParamPrefix: 'builtin',
      }).observe({ writeToQueryParams: false }),
    );

    const custom = c.run(() =>
      getCustom(
        withArgs(() => ({ queryParams: customForm.value() })),
        withPageResetOnError({ when, reset: () => customForm.resetFieldToDefault('page') }),
      ),
    );
    c.run(() =>
      getBuiltin(
        withArgs(() => ({ queryParams: builtinForm.value() })),
        withPageResetOnError({ when, reset: () => builtinForm.resetFieldToDefault('page') }),
      ),
    );

    customForm.setValue({ page: 5 });
    builtinForm.setValue({ page: 5 });
    s.flush();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 404);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 416);

    expect(customForm.value().page).toBe(1);
    expect(custom.response()).toEqual({ items: [] });
    expect(builtinForm.value().page).toBe(5);

    c.destroy();
  });

  it('a legacy QueryForm elides defaults and serializes a sort exactly like defineQueryForm', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const legacy = s.consumer();
    const legacyForm = legacy.run(() =>
      new QueryForm({
        page: new QueryField({ control: new FormControl<number | null>(1), defaultValue: 1 }),
        sort: new SortQueryField(),
      }).observe(),
    );

    legacyForm.setValue({ page: 1, sort: { active: 'name', direction: 'asc' } });
    await s.settle();

    const legacyParams = router.parseUrl(router.url).queryParams;

    legacy.destroy();
    await router.navigate([], { queryParams: {} });
    await s.settle();

    const signals = s.consumer();
    const signalsForm = signals.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }), sort: sortQueryField() },
      }).observe(),
    );

    signalsForm.setValue({ page: 1, sort: { active: 'name', direction: 'asc' } });
    await s.settle();

    expect(legacyParams).toEqual({ sort: 'name:asc' });
    expect(router.parseUrl(router.url).queryParams).toEqual(legacyParams);

    signals.destroy();
  });
});

describe('query forms scenario with the devtools attached', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    providers: () => [provideQueryDevtools()],
  });

  beforeEach(() => clearQueryDevtoolsTombstones());

  const liveFormEntries = () =>
    queryDevtoolsEntries().filter((entry) => entry.kind === 'query-form' && !entry.destroyedAt);

  const formEntry = (name: string) => {
    const entry = liveFormEntries().find((candidate) => candidate.meta.name === name);

    if (!entry) throw new Error(`query forms devtools scenario: no live form entry named "${name}"`);

    return entry;
  };

  it('registers its fields, committed and live values with the devtools bridge', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    s.api.on('GET', '/items', () => ({ body: { items: [] } }));

    const getItems = s.get<{
      response: { items: unknown[] };
      queryParams: { search: string | null; region: string | null };
    }>('/items');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        name: 'registered',
        queryParamPrefix: 'users',
        fields: {
          search: searchQueryField(),
          region: queryField<string>(),
          page: queryField<number>({ defaultValue: 1, isResetBy: 'search' }),
        },
      }).observe(),
    );

    const query = c.run(() =>
      getItems(withArgs(() => ({ queryParams: { search: qf.value().search, region: qf.value().region } }))),
    );

    await s.settle();
    expect(query.response()).toEqual({ items: [] });

    const entry = formEntry('registered');
    const handle = entry.handle as QueryDevtoolsFormHandle;

    expect(handle.isObserving()).toBe(true);
    expect(handle.isAtDefaults()).toBe(true);
    expect(handle.defaultValue).toEqual({ search: null, region: null, page: 1 });
    expect(handle.fields().map((field) => field.key)).toEqual(['search', 'region', 'page']);
    expect(handle.fields().map((field) => field.paramKey)).toEqual(['users-search', 'users-region', 'users-page']);
    expect(handle.fields().map((field) => field.countsAsFilter)).toEqual([false, true, false]);
    expect(handle.fields().map((field) => field.debounceMs)).toEqual([300, null, null]);
    expect(handle.fields().map((field) => field.isResetBy)).toEqual([[], [], ['search']]);

    qf.patchValue({ search: 'shoes' });
    s.tick(50);

    expect(handle.isCommitPending()).toBe(true);
    expect(handle.fields().find((field) => field.key === 'search')).toMatchObject({
      value: null,
      liveValue: 'shoes',
      isDefault: true,
      queryParam: undefined,
    });

    await s.settle(400);

    expect(handle.isCommitPending()).toBe(false);
    expect(handle.fields().find((field) => field.key === 'search')).toMatchObject({
      value: 'shoes',
      liveValue: 'shoes',
      isDefault: false,
      queryParam: 'shoes',
    });
    expect(handle.value()).toEqual({ search: 'shoes', region: null, page: 1 });
    expect(handle.previousValue()).toEqual({ search: null, region: null, page: 1 });
    expect(handle.isAtDefaults()).toBe(false);
    expect(handle.activeFilterCount()).toBe(0);

    expect(
      queryDevtoolsEntries()
        .find((candidate) => candidate.handle === query)
        ?.formLinks?.ids(),
    ).toEqual([entry.id]);

    c.destroy();
    s.tick();
    s.tick(600);
  });

  it('names a form after its string queryParamPrefix, and form without one', () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    const fields = { page: queryField<number>({ defaultValue: 1 }) };

    const c = s.consumer();
    c.run(() => defineQueryForm({ fields, queryParamPrefix: 'prefixed' }).observe({ writeToQueryParams: false }));
    c.run(() => defineQueryForm({ fields }).observe({ writeToQueryParams: false }));
    c.run(() => defineQueryForm({ fields, queryParamPrefix: () => 'dynamic' }).observe({ writeToQueryParams: false }));

    const names = liveFormEntries().map((entry) => entry.meta.name);

    expect(names).toEqual(['prefixed', 'form', 'form']);

    c.destroy();
    s.tick();
    s.tick(600);
  });
});
