import { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import {
  booleanArrayQueryField,
  dateArrayQueryField,
  dateQueryField,
  DateQueryField,
  defineQueryForm,
  QueryFieldDef,
  QueryForm,
  queryField,
  searchQueryField,
  sortQueryField,
  transformToNumber,
} from '../index';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { useScenario } from './harness';

describe('query form fields scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('restores true and false from the URL as booleans', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { enabled: 'true', archived: 'false' } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          enabled: queryField<boolean>({ defaultValue: false }),
          archived: queryField<boolean>({ defaultValue: true }),
        },
      }).observe(),
    );
    s.tick();

    expect(qf.value()).toEqual({ enabled: true, archived: false });
  });

  it('commits a cleared search immediately instead of waiting out the debounce', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({ fields: { search: searchQueryField() } }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ search: 'shoes' }, { debounce: true });
    s.tick(50);
    expect(qf.value().search).toBe('');

    s.tick(300);
    expect(qf.value().search).toBe('shoes');

    qf.setValue({ search: '' });
    s.tick();

    expect(qf.value().search).toBe('');
  });

  it('writes a sort to the URL as active:direction and restores it', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { sort: sortQueryField() } }).observe());

    qf.setValue({ sort: { active: 'name', direction: 'asc' } });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ sort: 'name:asc' });

    const url = router.url;
    c.destroy();

    await s.reloadAt(url);

    const restored = s.run(() => defineQueryForm({ fields: { sort: sortQueryField() } }).observe());
    s.tick();

    expect(restored.value().sort).toEqual({ active: 'name', direction: 'asc' });
  });

  it('a boolean array survives the URL round trip, including one item', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { flags: booleanArrayQueryField() } }).observe());

    qf.setValue({ flags: [true, false] });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ flags: ['true', 'false'] });

    qf.setValue({ flags: [true] });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ flags: 'true' });

    const url = router.url;
    c.destroy();

    await s.reloadAt(url);

    const restored = s.run(() => defineQueryForm({ fields: { flags: booleanArrayQueryField() } }).observe());
    s.tick();

    expect(restored.value().flags).toEqual([true]);
  });

  it('a date array survives the URL round trip, including one item', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);
    const from = new Date(2026, 0, 15, 10, 30, 0, 0);
    const to = new Date(2026, 1, 2, 8, 0, 0, 0);

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { between: dateArrayQueryField() } }).observe());

    qf.setValue({ between: [from, to] });
    await s.settle();

    const url = router.url;
    c.destroy();

    await s.reloadAt(url);

    const restored = s.run(() => defineQueryForm({ fields: { between: dateArrayQueryField() } }).observe());
    s.tick();

    expect(restored.value().between?.map((date) => date.getTime())).toEqual([from.getTime(), to.getTime()]);

    restored.setValue({ between: [from] });
    await s.settle();
    expect(Array.isArray(router.parseUrl(router.url).queryParams['between'])).toBe(false);

    const oneItemUrl = router.url;

    await s.reloadAt(oneItemUrl);

    const restoredOne = s.run(() => defineQueryForm({ fields: { between: dateArrayQueryField() } }).observe());
    s.tick();

    expect(restoredOne.value().between?.map((date) => date.getTime())).toEqual([from.getTime()]);
  });

  it('waits out a per-field debounce before committing, and commits an undebounced field at once', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>({ debounce: 200 }), page: queryField<number>({ defaultValue: 1 }) },
      }).observe({ writeToQueryParams: false }),
    );

    qf.patchValue({ region: 'eu' }, { debounce: true });
    s.tick(100);
    expect(qf.value().region).toBeNull();

    s.tick(150);
    expect(qf.value().region).toBe('eu');

    qf.patchValue({ page: 4 });
    s.tick();

    expect(qf.value().page).toBe(4);
  });

  it('keeps a field with appendToUrl false out of the URL but still in the committed value', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>({ appendToUrl: false }), page: queryField<number>({ defaultValue: 1 }) },
      }).observe(),
    );

    qf.setValue({ region: 'eu', page: 2 });
    await s.settle();

    expect(qf.value()).toEqual({ region: 'eu', page: 2 });
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '2' });
  });

  it('excludes a skipInFilterCount field from activeFilterCount while still committing it', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>(), tier: queryField<string>({ skipInFilterCount: true }) },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ region: 'eu', tier: 'gold' });
    s.tick();

    expect(qf.value()).toEqual({ region: 'eu', tier: 'gold' });
    expect(qf.activeFilterCount()).toBe(1);
  });

  it('keeps a skipAutoTransform field a raw string instead of coercing it to a number', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { code: '42', amount: '42' } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          code: queryField<string>({ skipAutoTransform: true }),
          amount: queryField<number>({ defaultValue: 0 }),
        },
      }).observe(),
    );
    s.tick();

    expect(qf.value()).toEqual({ code: '42', amount: 42 });
  });

  it('reads a field through a custom queryParamToValue instead of the auto transform', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { amount: '42' } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { amount: queryField<string>({ queryParamToValue: (raw) => `amount-${String(raw)}` }) },
      }).observe({ writeToQueryParams: false }),
    );
    s.tick();

    expect(qf.value().amount).toBe('amount-42');
  });

  it('writes a field to the URL through a custom valueToQueryParam', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          amount: queryField<number>({
            queryParamToValue: transformToNumber,
            valueToQueryParam: (value) => (value === null ? null : `n${value}`),
          }),
        },
      }).observe(),
    );

    qf.setValue({ amount: 5 });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ amount: 'n5' });
  });

  it.each(['2024', 'true', '0x10'])('keeps the search %s from the URL a string', async (search) => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { search } });
    s.tick();

    const qf = s.run(() => defineQueryForm({ fields: { search: searchQueryField() } }).observe());
    s.tick();

    expect(qf.value().search).toBe(search);
  });

  it('types a search field as a string that is empty at the default and writes no param while empty', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { search: searchQueryField() } }).observe());
    s.tick();

    expectTypeOf(qf.fields.search().value).toEqualTypeOf<WritableSignal<string>>();
    expectTypeOf(qf.value().search).toEqualTypeOf<string>();
    expect(qf.value().search).toBe('');

    qf.fields.search().value.set('shoes');
    await s.settle(300);
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ search: 'shoes' });

    qf.fields.search().value.set('');
    await s.settle();
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({});
    expect(qf.value().search).toBe('');
    c.destroy();

    await s.reloadAt('/');
    const restored = s.run(() => defineQueryForm({ fields: { search: searchQueryField() } }).observe());
    s.tick();

    expect(restored.value().search).toBe('');
    expect(router.parseUrl(router.url).queryParams).toEqual({});
  });

  it.each([
    ['a', ['a']],
    ['5', ['5']],
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
  ])('a field with an array default restores %j from the URL as %j', async (param, tags) => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { tags: param } });
    s.tick();

    const qf = s.run(() => defineQueryForm({ fields: { tags: queryField<string[]>({ defaultValue: [] }) } }).observe());
    s.tick();

    expect(qf.value().tags).toEqual(tags);
  });

  it('types a field with a default as non-null and keeps it non-null through a reset and an unreadable URL', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { page: 'abc', wide: '1' } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          page: queryField<number>({ defaultValue: 1 }),
          wide: queryField<boolean>({ defaultValue: false }),
          status: queryField<string>({ defaultValue: 'all' }),
          label: queryField<string>(),
        },
      }).observe(),
    );
    s.tick();

    expectTypeOf(qf.value().page).toEqualTypeOf<number>();
    expectTypeOf(qf.fields.page().value).toEqualTypeOf<WritableSignal<number>>();
    expectTypeOf(qf.value().status).toEqualTypeOf<string>();
    expectTypeOf(qf.value().label).toEqualTypeOf<string | null>();
    expectTypeOf(queryField<string | null>({ defaultValue: 'all' })).toEqualTypeOf<QueryFieldDef<string | null>>();
    expect(qf.value()).toEqual({ page: 1, wide: false, status: 'all', label: null });

    qf.patchValue({ page: 4 });
    qf.resetFieldToDefault('page');
    expect(qf.value().page).toBe(1);

    // @ts-expect-error a field with a non-null default does not hold null
    qf.patchValue({ page: null });
    // @ts-expect-error only a string field reads the URL back without a queryParamToValue
    queryField<number>();
    // @ts-expect-error a Date default needs a queryParamToValue
    queryField<Date>({ defaultValue: () => new Date(0) });
  });

  it('keeps a numeric URL value a string in a string field, with and without a default', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { tournament: '123', status: '7', flag: 'true' } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          tournament: queryField<string>(),
          status: queryField<string>({ defaultValue: 'all' }),
          flag: queryField<string>(),
        },
      }).observe(),
    );
    s.tick();

    expect(qf.value()).toEqual({ tournament: '123', status: '7', flag: 'true' });
  });

  it('does not count a search or sort field as a filter, whatever its key', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { q: searchQueryField(), order: sortQueryField(), region: queryField<string>() },
      }).observe({ writeToQueryParams: false }),
    );

    qf.patchValue({ q: 'shoes', order: { active: 'name', direction: 'asc' } });
    expect(qf.activeFilterCount()).toBe(0);

    qf.patchValue({ region: 'eu' });
    expect(qf.activeFilterCount()).toBe(1);
  });
});

describe('query form date-only URL values', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const localMidnight = (day: number) => new Date(2026, 8, day).getTime();

  it('reads a date-only URL value as local midnight of that day', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { day: '2026-09-01', days: ['2026-09-01', '2026-09-02'] } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({ fields: { day: dateQueryField(), days: dateArrayQueryField() } }).observe(),
    );
    s.tick();

    expect(qf.value().day?.getTime()).toBe(localMidnight(1));
    expect(qf.value().days?.map((date) => date.getTime())).toEqual([localMidnight(1), localMidnight(2)]);
  });

  it('the legacy DateQueryField reads a date-only URL value as local midnight of that day', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { day: '2026-09-01' } });
    s.tick();

    const c = s.consumer();
    const qf = c.run(() =>
      new QueryForm({ day: new DateQueryField({ control: new FormControl<Date | null>(null) }) }).observe(),
    );
    await s.settle();

    expect(qf.form.value.day?.getTime()).toBe(localMidnight(1));

    c.destroy();
  });
});
