import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { QueryDevtoolsFormHandle } from './query-devtools-form';

/**
 * The devtools registrar and `injectQueryParamChanges` are both module-scoped, so - like
 * `query-form-signals.spec.ts` - every test loads the library on a fresh graph.
 */
const load = async () => {
  vi.resetModules();

  return import('../../index');
};

const setup = async () => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }])],
  });

  await RouterTestingHarness.create();

  const mod = await load();

  mod.provideQueryDevtools();

  return {
    mod,
    injector: TestBed.inject(Injector),
    httpTesting: TestBed.inject(HttpTestingController),
    client: mod.createQueryClient({ baseUrl: 'https://api.example.com', name: 'form-test' }),
  };
};

type Mod = Awaited<ReturnType<typeof load>>;

const formEntries = (mod: Mod) => mod.queryDevtoolsEntries().filter((entry) => entry.kind === 'query-form');

const handleOf = (mod: Mod, name: string) => {
  const entry = formEntries(mod).find((candidate) => candidate.meta.name === name);

  if (!entry) throw new Error(`the form "${name}" was not registered`);

  return { entry, handle: entry.handle as QueryDevtoolsFormHandle };
};

describe('query form devtools instrumentation', () => {
  afterEach(() => TestBed.resetTestingModule());

  const makeForm = (mod: Mod, injector: Injector, name: string) =>
    runInInjectionContext(injector, () =>
      mod
        .defineQueryForm({
          name,
          fields: {
            search: mod.searchQueryField(),
            page: mod.queryField<number>({ defaultValue: 1, isResetBy: ['search'] }),
          },
        })
        .observe({ writeToQueryParams: false, syncOnNavigation: false }),
    );

  it('should register a form with its fields, defaults and URL params', async () => {
    const { mod, injector } = await setup();

    makeForm(mod, injector, 'users');

    const { handle } = handleOf(mod, 'users');

    expect(handle.isAtDefaults()).toBe(true);
    expect(handle.activeFilterCount()).toBe(0);
    expect(handle.fields().map((field) => field.key)).toEqual(['search', 'page']);
    expect(handle.fields()[1]).toMatchObject({
      key: 'page',
      paramKey: 'page',
      value: 1,
      defaultValue: 1,
      isDefault: true,
      // A field at its default writes nothing to the URL.
      queryParam: undefined,
      isResetBy: ['search'],
    });
  });

  it('should apply the query param prefix to the reported param key', async () => {
    const { mod, injector } = await setup();

    runInInjectionContext(injector, () =>
      mod.defineQueryForm({ name: 'teams', queryParamPrefix: 'teams', fields: { page: mod.queryField<number>({}) } }),
    );

    expect(handleOf(mod, 'teams').handle.fields()[0]?.paramKey).toBe('teams-page');
  });

  it('should report a changed field, what it writes to the URL and let the panel reset it', async () => {
    const { mod, injector } = await setup();

    const form = makeForm(mod, injector, 'users');

    form.patchValue({ page: 4 });
    TestBed.tick();

    const { handle } = handleOf(mod, 'users');

    expect(handle.fields()[1]).toMatchObject({ value: 4, isDefault: false, queryParam: 4 });
    expect(handle.isAtDefaults()).toBe(false);
    expect(handle.value()['page']).toBe(4);

    handle.resetField('page');
    TestBed.tick();

    expect(handle.fields()[1]).toMatchObject({ value: 1, isDefault: true });
    expect(handle.isAtDefaults()).toBe(true);
  });

  it('should unregister the form when its injection context is destroyed', async () => {
    const { mod, injector } = await setup();

    makeForm(mod, injector, 'users');
    expect(formEntries(mod)).toHaveLength(1);

    TestBed.resetTestingModule();

    expect(formEntries(mod)).toHaveLength(0);
  });

  it('should link a form to the query whose args read its value', async () => {
    const { mod, injector, client, httpTesting } = await setup();

    const form = makeForm(mod, injector, 'users');

    const query = runInInjectionContext(injector, () =>
      mod.createQuery({
        creatorInternals: { client, method: 'GET', route: '/users' },
        features: [mod.withArgs(() => ({ queryParams: { page: form.value().page ?? 1 } }))],
        queryConfig: {},
      }),
    );

    TestBed.tick();
    httpTesting.expectOne('https://api.example.com/users?page=1').flush([]);

    const entry = mod.queryDevtoolsEntries().find((candidate) => candidate.handle === query);

    expect(entry?.formLinks?.ids()).toEqual([handleOf(mod, 'users').entry.id]);
  });

  it('should leave a query whose args read no form unlinked', async () => {
    const { mod, injector, client, httpTesting } = await setup();

    makeForm(mod, injector, 'users');

    const query = runInInjectionContext(injector, () =>
      mod.createQuery({
        creatorInternals: { client, method: 'GET', route: '/users' },
        features: [mod.withArgs(() => ({ queryParams: { page: 1 } }))],
        queryConfig: {},
      }),
    );

    TestBed.tick();
    httpTesting.expectOne('https://api.example.com/users?page=1').flush([]);

    expect(
      mod
        .queryDevtoolsEntries()
        .find((candidate) => candidate.handle === query)
        ?.formLinks?.ids(),
    ).toEqual([]);
  });
});
