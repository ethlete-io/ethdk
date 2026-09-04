import { Component, Injector, model, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, FormValueControl } from '@angular/forms/signals';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

/**
 * `injectQueryParamChanges` (via `@ethlete/core`) is memoized at module scope and
 * binds to the first injector that reads it, so - like `router.spec.ts` - every
 * test loads the module on a fresh graph to avoid leaking a dead-injector signal.
 */
const load = async () => {
  vi.resetModules();

  return import('./index');
};

const setup = async () => {
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });

  const harness = await RouterTestingHarness.create();
  const injector = TestBed.inject(Injector);
  const router = TestBed.inject(Router);

  return { harness, injector, router, mod: await load() };
};

/** Let the microtask-scheduled `router.navigate()` run and the route settle. */
const settle = async () => {
  // Two macrotask turns: the first lets the queued microtask invoke navigate(),
  // the second lets the navigation promise chain resolve.
  await new Promise((r) => setTimeout(r));
  await new Promise((r) => setTimeout(r));
  TestBed.tick();
};

const currentParams = (router: Router) => router.parseUrl(router.url).queryParams;

describe('defineQueryForm', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('starts at the field defaults', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: { search: mod.searchQueryField(), page: mod.queryField<number>({ defaultValue: 1 }) },
        })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    expect(qf.value()).toEqual({ search: null, page: 1 });
    expect(qf.activeFilterCount()).toBe(0);
  });

  it('debounces a search field and applies clearing immediately (disableDebounceIfFalsy)', async () => {
    vi.useFakeTimers();
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({ fields: { search: mod.searchQueryField() } })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.setValue({ search: 'ab' });
    TestBed.tick();
    expect(qf.value().search).toBeNull(); // still debouncing

    vi.advanceTimersByTime(299);
    expect(qf.value().search).toBeNull();

    vi.advanceTimersByTime(1);
    expect(qf.value().search).toBe('ab');

    // Clearing a search bypasses the debounce.
    qf.setValue({ search: null });
    TestBed.tick();
    expect(qf.value().search).toBeNull();
  });

  it('commits an undebounced field immediately', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({ fields: { limit: mod.queryField<number>({ defaultValue: 10 }) } })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.setValue({ limit: 50 });
    TestBed.tick();

    expect(qf.value().limit).toBe(50);
  });

  it('resets a dependent field when its isResetBy source changes', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            search: mod.queryField<string>(),
            page: mod.queryField<number>({ defaultValue: 1, isResetBy: 'search' }),
          },
        })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.setValue({ search: null, page: 5 });
    TestBed.tick();
    expect(qf.value().page).toBe(5);

    qf.patchValue({ search: 'hello' });
    TestBed.tick();
    expect(qf.value()).toEqual({ search: 'hello', page: 1 });
  });

  it('cascades a reset through the chain that depends on the reset field', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            country: mod.queryField<string>(),
            league: mod.queryField<string>({ isResetBy: 'country' }),
            team: mod.queryField<string>({ isResetBy: 'league' }),
          },
        })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.setValue({ country: 'de', league: 'bl', team: 'bvb' }, { skipResets: true });
    TestBed.tick();
    expect(qf.value()).toEqual({ country: 'de', league: 'bl', team: 'bvb' });

    qf.patchValue({ country: 'en' });
    TestBed.tick();

    expect(qf.value()).toEqual({ country: 'en', league: null, team: null });
  });

  it('skips resets when skipResets is set', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            search: mod.queryField<string>(),
            page: mod.queryField<number>({ defaultValue: 1, isResetBy: 'search' }),
          },
        })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.setValue({ search: null, page: 5 });
    TestBed.tick();

    qf.patchValue({ search: 'hello' }, { skipResets: true });
    TestBed.tick();
    expect(qf.value()).toEqual({ search: 'hello', page: 5 });
  });

  it('counts only non-default, non-ignored fields as active filters', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: {
            page: mod.queryField<number>({ defaultValue: 1 }), // ignored key
            region: mod.queryField<string>(),
            hidden: mod.queryField<string>({ skipInFilterCount: true }),
          },
        })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    expect(qf.activeFilterCount()).toBe(0);

    qf.setValue({ page: 5, region: 'eu', hidden: 'x' });
    TestBed.tick();

    expect(qf.activeFilterCount()).toBe(1); // only `region`
  });

  it('branch() is detached and can be written back via setValue', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({ fields: { region: mod.queryField<string>() } })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    qf.setValue({ region: 'eu' });
    TestBed.tick();

    const branch = qf.branch();
    expect(branch.value()).toEqual({ region: 'eu' });

    branch.setValue({ region: 'us' });
    TestBed.tick();
    expect(branch.value()).toEqual({ region: 'us' });
    expect(qf.value()).toEqual({ region: 'eu' }); // source untouched

    qf.setValue(branch.value());
    TestBed.tick();
    expect(qf.value()).toEqual({ region: 'us' });
  });

  it('writes committed values to the URL, eliding defaults', async () => {
    const { injector, router, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: { region: mod.queryField<string>(), page: mod.queryField<number>({ defaultValue: 1 }) },
        })
        .observe(),
    );

    qf.setValue({ region: 'eu', page: 1 });
    TestBed.tick();
    await settle();

    expect(currentParams(router)['region']).toBe('eu');
    expect(currentParams(router)['page']).toBeUndefined(); // default elided
  });

  it('serializes null with the ET_NULL__ sentinel when the default is not null', async () => {
    const { injector, router, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod.defineQueryForm({ fields: { region: mod.queryField<string>({ defaultValue: 'all' }) } }).observe(),
    );

    qf.setValue({ region: null });
    TestBed.tick();
    await settle();

    expect(currentParams(router)['region']).toBe('ET_NULL__');
  });

  it('serializes a sort field as active:direction', async () => {
    const { injector, router, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod.defineQueryForm({ fields: { sort: mod.sortQueryField() } }).observe(),
    );

    qf.setValue({ sort: { active: 'name', direction: 'asc' } });
    TestBed.tick();
    await settle();

    expect(currentParams(router)['sort']).toBe('name:asc');
  });

  it('restores form state from the URL on observe()', async () => {
    const { harness, injector, mod } = await setup();

    await harness.navigateByUrl('/?region=eu&page=3');

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          fields: { region: mod.queryField<string>(), page: mod.queryField<number>({ defaultValue: 1 }) },
        })
        .observe(),
    );

    expect(qf.value()).toEqual({ region: 'eu', page: 3 });
  });

  it('keeps a value patched before observe() where the URL does not name it', async () => {
    const { harness, injector, mod } = await setup();

    await harness.navigateByUrl('/?region=eu');

    const qf = runInInjectionContext(injector, () => {
      const form = mod.defineQueryForm({
        fields: { region: mod.queryField<string>(), page: mod.queryField<number>({ defaultValue: 1 }) },
      });

      form.patchValue({ region: 'us', page: 3 });

      return form.observe();
    });

    expect(qf.value()).toEqual({ region: 'eu', page: 3 });
  });

  it('re-applies the URL on navigation (back/forward)', async () => {
    const { harness, injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod.defineQueryForm({ fields: { region: mod.queryField<string>() } }).observe(),
    );

    await harness.navigateByUrl('/?region=us');
    TestBed.tick();

    expect(qf.value().region).toBe('us');
  });

  it('namespaces params with a prefix so two forms coexist', async () => {
    const { injector, router, mod } = await setup();

    runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({ fields: { region: mod.queryField<string>() }, queryParamPrefix: 'users' })
        .observe()
        .setValue({ region: 'eu' }),
    );

    TestBed.tick();
    await settle();

    expect(currentParams(router)['users-region']).toBe('eu');
    expect(currentParams(router)['region']).toBeUndefined();
  });

  it('binds a field to a FormValueControl via [formField]', async () => {
    const { injector, mod } = await setup();

    const qf = runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({ fields: { search: mod.queryField<string>() } })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

    @Component({
      selector: 'et-test-control',
      template: '',
      standalone: true,
    })
    class TestControl implements FormValueControl<string | null> {
      readonly value = model<string | null>(null);
    }

    @Component({
      template: `<et-test-control [formField]="qf.fields.search" />`,
      imports: [TestControl, FormField],
      standalone: true,
    })
    class Host {
      readonly qf = qf;
    }

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const control = fixture.debugElement.children[0]!.componentInstance as TestControl;
    control.value.set('typed');
    TestBed.tick();

    expect(qf.value().search).toBe('typed');
  });
});
