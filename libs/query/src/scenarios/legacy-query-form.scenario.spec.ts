import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { QueryField, QueryForm } from '../index';
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
