import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  defineQueryForm,
  numberArrayQueryField,
  queryField,
  searchQueryField,
  sortQueryField,
  withArgs,
  withPageResetOnError,
} from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

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
});
