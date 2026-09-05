import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  booleanArrayQueryField,
  dateArrayQueryField,
  defineQueryForm,
  queryField,
  searchQueryField,
  sortQueryField,
} from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('query form fields scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('restores true and false from the URL as booleans', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { enabled: 'true', archived: 'false' } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({ fields: { enabled: queryField<boolean>(), archived: queryField<boolean>() } }).observe(),
    );
    s.tick();

    expect(qf.value()).toEqual({ enabled: true, archived: false });
  });

  it('commits a cleared search immediately instead of waiting out the debounce', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({ fields: { search: searchQueryField() } }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ search: 'shoes' });
    s.tick(50);
    expect(qf.value().search).toBeNull();

    s.tick(300);
    expect(qf.value().search).toBe('shoes');

    qf.setValue({ search: null });
    s.tick();

    expect(qf.value().search).toBeNull();
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

    await router.navigateByUrl(url);
    s.tick();

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

    await router.navigateByUrl(url);
    s.tick();

    const restored = s.run(() => defineQueryForm({ fields: { flags: booleanArrayQueryField() } }).observe());
    s.tick();

    expect(restored.value().flags).toEqual([true]);
  });

  it('a date array survives the URL round trip', async () => {
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

    await router.navigateByUrl(url);
    s.tick();

    const restored = s.run(() => defineQueryForm({ fields: { between: dateArrayQueryField() } }).observe());
    s.tick();

    expect(restored.value().between?.map((date) => date.getTime())).toEqual([from.getTime(), to.getTime()]);
  });

  it('waits out a per-field debounce before committing, and commits an undebounced field at once', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>({ debounce: 200 }), page: queryField<number>({ defaultValue: 1 }) },
      }).observe({ writeToQueryParams: false }),
    );

    qf.patchValue({ region: 'eu' });
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
        fields: { code: queryField<string>({ skipAutoTransform: true }), amount: queryField<number>() },
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
        fields: { amount: queryField<number>({ valueToQueryParam: (value) => (value === null ? null : `n${value}`) }) },
      }).observe(),
    );

    qf.setValue({ amount: 5 });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ amount: 'n5' });
  });
});
