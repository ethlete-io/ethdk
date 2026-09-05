import { Location } from '@angular/common';
import { effect } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { dateQueryField, defineQueryForm, queryField, searchQueryField, stringArrayQueryField } from '../index';
import { describe, expect, it, vi } from 'vitest';
import { useScenario } from './harness';

describe('query forms URL sync scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('restores a numeric zero and a fraction below one from the URL as numbers', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { offset: '0', ratio: '0.5', negative: '-0.25' } });
    s.tick();

    const qf = s.run(() =>
      defineQueryForm({
        fields: { offset: queryField<number>(), ratio: queryField<number>(), negative: queryField<number>() },
      }).observe(),
    );
    s.tick();

    expect(qf.value()).toEqual({ offset: 0, ratio: 0.5, negative: -0.25 });
  });

  it('keeps a zero-padded code a string', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { zip: '01234' } });
    s.tick();

    const qf = s.run(() => defineQueryForm({ fields: { zip: queryField<string>() } }).observe());
    s.tick();

    expect(qf.value().zip).toBe('01234');
  });

  it('two prefixed forms committing in the same tick both reach the URL', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const users = s.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }) },
        queryParamPrefix: 'users',
      }).observe(),
    );
    const teams = s.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }) },
        queryParamPrefix: 'teams',
      }).observe(),
    );

    users.setValue({ page: 2 });
    teams.setValue({ page: 3 });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ 'users-page': '2', 'teams-page': '3' });
  });

  it('a Date survives the URL round trip', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);
    const from = new Date(2026, 0, 15, 10, 30, 0, 0);

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { from: dateQueryField() } }).observe());

    qf.setValue({ from });
    await s.settle();

    const url = router.url;
    c.destroy();

    await router.navigateByUrl(url);
    s.tick();

    const restored = s.run(() => defineQueryForm({ fields: { from: dateQueryField() } }).observe());
    s.tick();

    expect(restored.value().from?.getTime()).toBe(from.getTime());
  });

  it('a string array survives the URL round trip, including one item', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { tags: stringArrayQueryField() } }).observe());

    qf.setValue({ tags: ['a', 'b'] });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ tags: ['a', 'b'] });

    qf.setValue({ tags: ['a'] });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ tags: 'a' });

    const url = router.url;
    c.destroy();

    await router.navigateByUrl(url);
    s.tick();

    const restored = s.run(() => defineQueryForm({ fields: { tags: stringArrayQueryField() } }).observe());
    s.tick();

    expect(restored.value().tags).toEqual(['a']);
  });

  it('an emptied array is not an active filter and leaves the URL clean', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() => defineQueryForm({ fields: { tags: stringArrayQueryField() } }).observe());

    qf.setValue({ tags: ['a'] });
    await s.settle();
    expect(qf.activeFilterCount()).toBe(1);

    qf.setValue({ tags: [] });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({});
    expect(qf.activeFilterCount()).toBe(0);
  });

  it('unobserving while a route change is in flight leaves the landing URL its own params', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }), search: queryField<string>() },
      }).observe(),
    );

    qf.setValue({ page: 2, search: 'bar' });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '2', search: 'bar' });

    router.resetConfig([{ path: 'other', children: [] }]);

    const navigation = router.navigateByUrl('/other?page=3&search=foo');
    qf.unobserve();
    await navigation;
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '3', search: 'foo' });

    c.destroy();
  });

  it('a form destroyed on a route change leaves the landing URL its own params', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }), search: queryField<string>() },
      }).observe(),
    );

    qf.setValue({ page: 2, search: 'bar' });
    await s.settle();

    router.resetConfig([{ path: 'other', children: [] }]);

    const navigation = router.navigateByUrl('/other?page=3&search=foo');
    c.destroy();
    await navigation;
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '3', search: 'foo' });
  });

  it('unobserving without a route change removes the form params from the URL', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }), search: queryField<string>() },
      }).observe(),
    );

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
    const qf = c.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }), search: queryField<string>() },
      }).observe(),
    );

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

  it('a form observed with writeToQueryParams false commits without touching the URL', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() =>
      defineQueryForm({
        fields: { region: queryField<string>(), page: queryField<number>({ defaultValue: 1 }) },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ region: 'eu', page: 3 });
    await s.settle();

    expect(qf.value()).toEqual({ region: 'eu', page: 3 });
    expect(router.parseUrl(router.url).queryParams).toEqual({});
  });

  it('a form observed with syncOnNavigation false ignores a navigation-driven URL change', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() =>
      defineQueryForm({ fields: { region: queryField<string>() } }).observe({
        syncOnNavigation: false,
        writeToQueryParams: false,
      }),
    );

    await router.navigate([], { queryParams: { region: 'from-url' }, queryParamsHandling: 'merge' });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ region: 'from-url' });
    expect(qf.value().region).toBeNull();
  });

  it('replaceUrl replaces the history entry instead of pushing a new one', async () => {
    const s = scenario();
    const location = TestBed.inject(Location);
    const go = vi.spyOn(location, 'go');
    const replaceState = vi.spyOn(location, 'replaceState');

    const replacing = s.consumer();
    const replacingForm = replacing.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }) },
        queryParamPrefix: 'replacing',
      }).observe({ replaceUrl: true }),
    );

    replacingForm.setValue({ page: 2 });
    await s.settle();

    expect(replaceState).toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();

    replacing.destroy();
    go.mockClear();
    replaceState.mockClear();

    const pushing = s.consumer();
    const pushingForm = pushing.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }) },
        queryParamPrefix: 'pushing',
      }).observe(),
    );

    pushingForm.setValue({ page: 2 });
    await s.settle();

    expect(go).toHaveBeenCalled();

    pushing.destroy();
    go.mockRestore();
    replaceState.mockRestore();
  });

  it('a cleared text field commits as null and leaves the URL clean', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() => defineQueryForm({ fields: { label: queryField<string>() } }).observe());

    qf.setValue({ label: 'shoes' });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ label: 'shoes' });

    qf.setValue({ label: '' });
    await s.settle();

    expect(qf.value().label).toBeNull();
    expect(router.parseUrl(router.url).queryParams).toEqual({});
  });

  it('writes an explicit null as the ET_NULL__ sentinel and reads it back as null', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const fields = { status: queryField<string>({ defaultValue: 'all' }), region: queryField<string>() };

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields }).observe());

    qf.setValue({ status: null, region: null });
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ status: 'ET_NULL__' });

    const url = router.url;
    c.destroy();

    await router.navigateByUrl(url);
    s.tick();

    const restored = s.run(() => defineQueryForm({ fields }).observe());
    s.tick();

    expect(restored.value()).toEqual({ status: null, region: null });
  });

  it('a value committed while a same-route navigation is in flight is not lost', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1 }), search: queryField<string>() },
      }).observe(),
    );

    const navigation = router.navigateByUrl('/?other=1');
    qf.setValue({ page: 2, search: 'bar' });
    s.tick();
    await navigation;
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ other: '1', page: '2', search: 'bar' });

    c.destroy();
  });
  it('does not re-commit its own URL write as a different type', async () => {
    const s = scenario();
    const commits: string[] = [];

    const qf = s.run(() => defineQueryForm({ fields: { search: searchQueryField() } }).observe());

    s.run(() =>
      effect(() => {
        const { search } = qf.value();

        commits.push(`${typeof search}:${String(search)}`);
      }),
    );
    s.tick();

    qf.setValue({ search: '2024' });
    await s.settle(300);
    await s.settle();

    expect(commits).toEqual(['object:null', 'string:2024']);
    expect(qf.value().search).toBe('2024');
  });

  it('keeps the milliseconds of a Date through its own URL write', async () => {
    const s = scenario();
    const from = new Date(2026, 0, 15, 10, 30, 0, 123);

    const qf = s.run(() => defineQueryForm({ fields: { from: dateQueryField() } }).observe());

    qf.setValue({ from });
    await s.settle();
    await s.settle();

    expect(qf.value().from?.getTime()).toBe(from.getTime());
  });

  it('a foreign write to one of its own params in the same tick loses to the form', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        fields: { search: queryField<string>(), page: queryField<number>({ defaultValue: 1 }) },
      }).observe(),
    );

    const navigation = router.navigate([], { queryParams: { search: 'from-url' } });
    qf.setValue({ search: null, page: 2 });
    s.tick();
    await navigation;
    await s.settle();
    await s.settle();

    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '2' });
    expect(qf.value()).toEqual({ search: null, page: 2 });

    c.destroy();
  });
  it('leaves a foreign query param of the same name alone when the field has appendToUrl false', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    await router.navigate([], { queryParams: { page: '7' } });
    s.tick();

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({
        fields: {
          search: queryField<string>(),
          page: queryField<number>({ defaultValue: 1, appendToUrl: false }),
        },
      }).observe(),
    );
    await s.settle();

    qf.patchValue({ search: 'shoes' });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '7', search: 'shoes' });

    qf.unobserve();
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ page: '7' });

    c.destroy();
  });
});
