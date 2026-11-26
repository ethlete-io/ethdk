import { EnvironmentInjector, Injector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { transformToNumber } from '../query-form/query-form.utils';

const load = async () => {
  vi.resetModules();

  return import('./index');
};

const setup = async (url?: string) => {
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });

  const harness = await RouterTestingHarness.create(url);
  const injector = TestBed.inject(Injector);
  const router = TestBed.inject(Router);

  return { harness, injector, router, mod: await load() };
};

const currentParams = (router: Router) => router.parseUrl(router.url).queryParams;

const settle = async () => {
  await new Promise((r) => setTimeout(r));
  await new Promise((r) => setTimeout(r));
  TestBed.tick();
};

describe('defineQueryForm edge cases', () => {
  beforeAll(() => import('./index'), 30_000);

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('commits undefined as the default, so the count and the URL agree with a reload', async () => {
    const { injector, router, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            region: mod.queryField<string>(),
            status: mod.queryField<string>({ defaultValue: 'all' }),
            page: mod.queryField<number>({ defaultValue: 1 }),
          },
        })
        .observe(),
    );

    qf.patchValue({ region: 'eu', status: 'open', page: 3 });
    await settle();
    expect(qf.activeFilterCount()).toBe(2);

    qf.patchValue({ region: undefined, status: undefined, page: undefined } as never);
    await settle();

    expect(qf.value()).toEqual({ region: null, status: 'all', page: 1 });
    expect(qf.activeFilterCount()).toBe(0);
    expect(currentParams(router)).toEqual({});
  });

  it('commits NaN and an invalid Date as the default instead of writing them to the URL', async () => {
    const { injector, router, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            from: mod.dateQueryField(),
            limit: mod.queryField<number>({ defaultValue: 10 }),
            min: mod.queryField<number>({ queryParamToValue: transformToNumber }),
          },
        })
        .observe(),
    );

    qf.patchValue({ from: new Date('nope'), limit: Number.NaN, min: Number.NaN });
    await settle();

    expect(qf.value()).toEqual({ from: null, limit: 10, min: null });
    expect(qf.activeFilterCount()).toBe(0);
    expect(currentParams(router)).toEqual({});
  });

  it('falls back to the default when a hand-edited URL repeats a single-value param', async () => {
    const { injector, mod } = await setup('/?page=2&page=3&flag=true&flag=false&name=a&name=b&tags=x&tags=y');

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            page: mod.queryField<number>({ defaultValue: 1 }),
            flag: mod.queryField<boolean>({ defaultValue: false }),
            name: mod.queryField<string>(),
            tags: mod.queryField<string[]>({ defaultValue: [] }),
          },
        })
        .observe({ writeToQueryParams: false }),
    );

    expect(qf.value()).toEqual({ page: 1, flag: false, name: null, tags: ['x', 'y'] });
  });

  it('falls back to the default for a non-finite number in the URL', async () => {
    const { injector, mod } = await setup('/?page=Infinity&min=NaN');

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            page: mod.queryField<number>({ defaultValue: 1 }),
            min: mod.queryField<number>({ queryParamToValue: transformToNumber }),
          },
        })
        .observe({ writeToQueryParams: false }),
    );

    expect(qf.value()).toEqual({ page: 1, min: null });
  });

  it('reads an empty param into a nullable text field as null', async () => {
    const { injector, mod } = await setup('/?region=&search=');

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({ fields: { region: mod.queryField<string>(), search: mod.searchQueryField() } })
        .observe({ writeToQueryParams: false }),
    );

    expect(qf.value()).toEqual({ region: null, search: '' });
    expect(qf.activeFilterCount()).toBe(0);
  });

  it('lets a URL value win over a function default, and evaluates the default for the missing fields', async () => {
    const { injector, mod } = await setup('/?size=50');

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            size: mod.queryField<number>({ defaultValue: () => 25 }),
            order: mod.queryField<string>({ defaultValue: () => 'desc' }),
          },
        })
        .observe({ writeToQueryParams: false }),
    );

    expect(qf.value()).toEqual({ size: 50, order: 'desc' });
    expect(qf.defaultValue).toEqual({ size: 25, order: 'desc' });
    expect(qf.activeFilterCount()).toBe(1);
  });

  it('cancels a pending debounced edit when the field is reset before it commits', async () => {
    vi.useFakeTimers();
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({ fields: { search: mod.searchQueryField() } })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.patchValue({ search: 'abc' }, { debounce: true });
    TestBed.tick();
    vi.advanceTimersByTime(100);

    qf.resetFieldToDefault('search');
    TestBed.tick();
    vi.advanceTimersByTime(1000);
    TestBed.tick();

    expect(qf.value().search).toBe('');
    expect(qf.previousValue()).toBeNull();
  });

  it('resets a dependent page only once the debounced edit commits', async () => {
    vi.useFakeTimers();
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            search: mod.searchQueryField(),
            page: mod.queryField<number>({ defaultValue: 1, isResetBy: ['search'] }),
          },
        })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.setValue({ search: '', page: 4 });
    qf.patchValue({ search: 'a' }, { debounce: true });
    TestBed.tick();
    vi.advanceTimersByTime(299);

    expect(qf.value()).toEqual({ search: '', page: 4 });

    vi.advanceTimersByTime(1);

    expect(qf.value()).toEqual({ search: 'a', page: 1 });
  });

  it('drops a pending debounced edit and its timer when the form is destroyed mid-debounce', async () => {
    vi.useFakeTimers();
    const { router, mod } = await setup();
    const child = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));

    const qf = runInInjectionContext(child, () =>
      mod.defineQueryForm({ fields: { search: mod.searchQueryField() } }).observe(),
    );

    qf.patchValue({ search: 'abc' }, { debounce: true });
    TestBed.tick();
    expect(vi.getTimerCount()).toBe(1);

    child.destroy();

    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();

    expect(qf.value().search).toBe('');
    expect(currentParams(router)).toEqual({});
  });
});
