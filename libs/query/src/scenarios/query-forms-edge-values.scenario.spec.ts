import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  booleanArrayQueryField,
  dateQueryField,
  defineQueryForm,
  numberArrayQueryField,
  queryField,
  searchQueryField,
  stringArrayQueryField,
  withArgs,
  withPageResetOnError,
} from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

type Items = { response: { items: unknown[] }; queryParams: Record<string, unknown> };

describe('query form edge values scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('a field patched to undefined commits its default, so the request and a reload agree', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);
    s.api.on('GET', '/items', () => ({ body: { items: [] } }));
    const getItems = s.get<Items>('/items');

    const fields = { region: queryField<string>(), status: queryField<string>({ defaultValue: 'all' }) };
    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields }).observe());
    c.run(() => getItems(withArgs(() => ({ queryParams: qf.value() }))));

    qf.patchValue({ region: 'eu', status: 'open' });
    await s.settle();
    qf.patchValue({ region: undefined, status: undefined } as never);
    await s.settle();

    expect(s.api.httpRequests('GET', '/items').at(-1)?.urlWithParams).toMatch(/\/items\?status=all$/);
    expect(qf.activeFilterCount()).toBe(0);

    const url = router.url;
    const committed = qf.value();
    c.destroy();
    await s.reloadAt(url);

    const restored = s.run(() => defineQueryForm({ fields }).observe());
    s.tick();

    expect(restored.value()).toEqual(committed);
  });

  it('a NaN or an invalid Date commits as the default instead of reaching the URL', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);

    const qf = s.run(() =>
      defineQueryForm({ fields: { from: dateQueryField(), size: queryField<number>({ defaultValue: 10 }) } }).observe(),
    );

    qf.patchValue({ from: new Date('nope'), size: Number.NaN });
    await s.settle();

    expect(qf.value()).toEqual({ from: null, size: 10 });
    expect(router.parseUrl(router.url).queryParams).toEqual({});
  });

  it('a hand-edited URL repeating a single-value param falls back to the default', async () => {
    const s = scenario();
    await s.reloadAt('/?page=2&page=3&flag=true&flag=false&name=a&name=b&size=Infinity');

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          page: queryField<number>({ defaultValue: 1 }),
          flag: queryField<boolean>({ defaultValue: false }),
          name: queryField<string>(),
          size: queryField<number>({ defaultValue: 10 }),
        },
      }).observe({ writeToQueryParams: false }),
    );
    s.tick();

    expect(qf.value()).toEqual({ page: 1, flag: false, name: null, size: 10 });
  });

  it('special characters, arrays, numbers, booleans and dates survive the URL round trip', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);
    const fields = {
      q: searchQueryField(),
      tags: stringArrayQueryField(),
      ids: numberArrayQueryField(),
      flags: booleanArrayQueryField(),
      when: dateQueryField(),
      size: queryField<number>({ defaultValue: 10 }),
      open: queryField<boolean>({ defaultValue: true }),
    };
    const value = {
      q: 'a&b=c?d#e /ü+%20;',
      tags: ['x,y', 'ET', ' sp '],
      ids: [0, -1.5, 1e21],
      flags: [true, false],
      when: new Date(Date.UTC(1999, 11, 31, 23, 59, 59, 123)),
      size: 0,
      open: false,
    };

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields }).observe());
    qf.setValue(value);
    await s.settle();

    const url = router.url;
    c.destroy();
    await s.reloadAt(url);

    const restored = s.run(() => defineQueryForm({ fields }).observe());
    s.tick();

    expect(restored.value()).toEqual(value);
  });

  it('destroying the form mid-debounce drops the edit, sends no request and leaves the URL alone', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);
    s.api.on('GET', '/items', () => ({ body: { items: [] } }));
    const getItems = s.get<Items>('/items');

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { search: searchQueryField() } }).observe());
    c.run(() => getItems(withArgs(() => ({ queryParams: qf.value() }))));
    s.tick();

    qf.patchValue({ search: 'shoes' }, { debounce: true });
    s.tick(100);
    c.destroy();
    await s.settle(1000);

    expect(s.api.requestCount('GET', '/items')).toBe(1);
    expect(router.parseUrl(router.url).queryParams).toEqual({});
  });

  it('withPageResetOnError on a page already at its default answers the error once, without a loop', () => {
    const s = scenario();
    s.api.on('GET', '/items', () => ({ status: 416, body: { message: 'out of range' } }));
    const getItems = s.get<Items>('/items');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({ fields: { page: queryField<number>({ defaultValue: 1 }) } }).observe({
        writeToQueryParams: false,
      }),
    );
    c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: qf.value() })),
        withPageResetOnError({ reset: () => qf.resetFieldToDefault('page') }),
      ),
    );

    s.flush();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 416);
    expect(s.api.requestCount('GET', '/items')).toBe(1);
    expect(qf.value().page).toBe(1);

    c.destroy();
  });

  it('withPageResetOnError keeps the page on an error that is not out of range', () => {
    const s = scenario();
    s.api.on('GET', '/items', ({ query }) =>
      Number(query['page']) > 1 ? { status: 500, body: { message: 'boom' } } : { body: { items: [] } },
    );
    const getItems = s.get<Items>('/items');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({ fields: { page: queryField<number>({ defaultValue: 1 }) } }).observe({
        writeToQueryParams: false,
      }),
    );
    c.run(() =>
      getItems(
        withArgs(() => ({ queryParams: qf.value() })),
        withPageResetOnError({ reset: () => qf.resetFieldToDefault('page') }),
      ),
    );

    qf.setValue({ page: 3 });
    s.flush();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    expect(qf.value().page).toBe(3);

    c.destroy();
  });
});
