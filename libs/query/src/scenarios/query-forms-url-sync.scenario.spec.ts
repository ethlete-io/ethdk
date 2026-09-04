import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { dateQueryField, defineQueryForm, queryField, stringArrayQueryField } from '../index';
import { describe, expect, it } from 'vitest';
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
});
