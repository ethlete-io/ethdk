import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  createComponent,
  effect,
  EnvironmentInjector,
  EnvironmentProviders,
  inject,
  InjectionToken,
  input,
  OnInit,
  Provider,
  signal,
} from '@angular/core';
import {
  AnyLegacyQuery,
  AnyV2Query,
  createLegacyQueryCreator,
  createPagedQueryStack,
  createQueryStack,
  createSecurePostQuery,
  def,
  ethletePaginationAdapter,
  provideQueryDevtools,
  queryCreatedInReactiveContext,
  queryComputed,
  QueryStateType,
  V2QueryClient,
  withArgs,
} from '../index';
import { Paginated } from '@ethlete/types';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

const BASE_URL = 'https://api.test';

type User = { id: string; name: string };
type CreateUserArgs = { body: { name: string }; response: User };

const BUILD_QUERY = new InjectionToken<() => AnyLegacyQuery | AnyV2Query>('BUILD_QUERY');

@Component({ template: '' })
class SyncReadHost implements OnInit {
  private readonly buildQuery = inject(BUILD_QUERY);

  readonly query = queryComputed(() => this.buildQuery());
  readonly atConstruction = this.query();
  atInit: AnyLegacyQuery | AnyV2Query | null = null;

  ngOnInit() {
    this.atInit = this.query();
  }
}

const BUILD_USER_QUERY = new InjectionToken<(id: string) => AnyLegacyQuery | AnyV2Query>('BUILD_USER_QUERY');

@Component({ template: '' })
class RequiredInputHost {
  private readonly buildQuery = inject(BUILD_USER_QUERY);

  readonly id = input.required<string>();
  readonly query = queryComputed(() => this.buildQuery(this.id()));
}

const mountSyncReadHost = (injector: EnvironmentInjector) => {
  const ref = createComponent(SyncReadHost, { environmentInjector: injector });

  ref.changeDetectorRef.detectChanges();

  return ref;
};

describe('reactive contract scenario', () => {
  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  describe('v3 execute() and reset() inside an effect', () => {
    it('sends one POST per signal change from execute({ args }) in an effect', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body, delay: 100 }));

      const createUser = s.post<CreateUserArgs>('/users');
      const name = signal('Ada');

      const c = s.consumer();
      const mutation = c.run(() => createUser());

      c.run(() => effect(() => mutation.execute({ args: { body: { name: name() } } })));

      s.tick(1000);
      expect(s.api.requestCount('POST', '/users')).toBe(1);

      for (const [index, next] of ['Grace', 'Linus', 'Barbara'].entries()) {
        name.set(next);
        s.tick(1000);

        expect(s.api.requestCount('POST', '/users')).toBe(index + 2);
        expect(mutation.response()).toMatchObject({ name: next });
      }

      c.destroy();
    });

    it('sends one secure POST per signal change from execute({ args }) in an effect', async () => {
      const s = scenario();
      const auth = s.auth();

      s.api.protect('/secure/**');
      s.api.on('POST', '/secure/users', ({ body }) => ({ status: 201, body, delay: 100 }));

      const createSecureUser = createSecurePostQuery(s.clientRef, auth.ref)<CreateUserArgs>('/secure/users');
      const name = signal('Ada');

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      const mutation = c.run(() => createSecureUser());

      c.run(() => effect(() => mutation.execute({ args: { body: { name: name() } } })));

      s.tick(1000);
      expect(s.api.requestCount('POST', '/secure/users')).toBe(1);

      for (const [index, next] of ['Grace', 'Linus', 'Barbara'].entries()) {
        name.set(next);
        s.tick(1000);

        expect(s.api.requestCount('POST', '/secure/users')).toBe(index + 2);
        expect(mutation.response()).toMatchObject({ name: next });
      }

      c.destroy();
    });

    it('aborts the superseded GET when an effect executes with new args', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

      const getUser = s.get<{ response: User; pathParams: { id: string } }>((p) => `/users/${p.id}`);
      const id = signal('1');

      const c = s.consumer();
      const query = c.run(() =>
        getUser(
          { onlyManualExecution: true },
          withArgs(() => ({ pathParams: { id: '1' } })),
        ),
      );

      c.run(() => effect(() => query.execute({ args: { pathParams: { id: id() } } })));

      s.tick(10);

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);
      }

      s.tick(1000);

      for (const done of ['1', '2', '3', '4']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false]);
      expect(query.response()).toMatchObject({ id: '4' });

      c.destroy();
    });

    it('re-executes a query without args from an effect exactly once per trigger', () => {
      const s = scenario();
      s.api.on('POST', '/refresh', () => ({ status: 201, body: { id: 'r', name: 'Refresh' } }));

      const refresh = s.post<CreateUserArgs>('/refresh');
      const trigger = signal(0);

      const c = s.consumer();
      const mutation = c.run(() => refresh());

      mutation.execute({ args: { body: { name: 'x' } } });
      s.tick();

      c.run(() =>
        effect(() => {
          trigger();
          mutation.execute();
        }),
      );

      s.tick();
      expect(s.api.requestCount('POST', '/refresh')).toBe(2);

      for (const count of [1, 2, 3]) {
        trigger.set(count);
        s.tick();

        expect(s.api.requestCount('POST', '/refresh')).toBe(count + 2);
      }

      c.destroy();
    });

    it('resets from an effect without re-running it', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

      const createUser = s.post<CreateUserArgs>('/users');
      const clear = signal(0);
      let runs = 0;

      const c = s.consumer();
      const mutation = c.run(() => createUser());

      c.run(() =>
        effect(() => {
          clear();
          runs++;
          mutation.reset();
        }),
      );

      s.tick();

      for (const [index, next] of ['Ada', 'Grace', 'Linus'].entries()) {
        mutation.execute({ args: { body: { name: next } } });
        s.tick();
        expect(mutation.response()).toMatchObject({ name: next });

        clear.set(index + 1);
        s.tick();

        expect(mutation.response()).toBeNull();
      }

      expect(runs).toBe(4);

      c.destroy();
    });
  });

  describe('queryComputed over the interop creator', () => {
    it('sends one POST per args change and keeps one live query', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body, delay: 100 }));

      const createUser = s.post<CreateUserArgs>('/users');
      const legacyCreateUser = createLegacyQueryCreator({ creator: createUser, name: 'legacyCreateUser' });
      const name = signal('Ada');

      const c = s.consumer();
      const query = queryComputed(() => legacyCreateUser.prepare({ body: { name: name() } }).execute(), {
        injector: c.injector,
      });

      s.tick(1000);
      expect(s.api.requestCount('POST', '/users')).toBe(1);
      expect(s.liveQueries()).toHaveLength(1);

      for (const [index, next] of ['Grace', 'Linus', 'Barbara'].entries()) {
        name.set(next);
        s.tick(1000);

        expect(s.api.requestCount('POST', '/users')).toBe(index + 2);
        expect(query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { name: next } });
      }

      c.destroy();
    });
  });

  describe('queryComputed read synchronously', () => {
    it('returns the executed interop query at construction and in ngOnInit', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

      const createUser = s.post<CreateUserArgs>('/users');
      const legacyCreateUser = createLegacyQueryCreator({ creator: createUser, name: 'legacyCreateUser' });

      const c = s.consumer([
        { provide: BUILD_QUERY, useValue: () => legacyCreateUser.prepare({ body: { name: 'Ada' } }).execute() },
      ]);
      const ref = mountSyncReadHost(c.injector);

      expect(ref.instance.atConstruction).not.toBeNull();
      expect(ref.instance.atInit).toBe(ref.instance.atConstruction);

      s.tick();

      expect(ref.instance.query()).toBe(ref.instance.atConstruction);
      expect(s.api.requestCount('POST', '/users')).toBe(1);

      ref.destroy();
      c.destroy();
    });

    it('returns the executed native query at construction and in ngOnInit', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

      const owner = s.consumer();
      const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL }));
      const createUser = client.post({
        route: '/users',
        types: { args: def<{ body: { name: string } }>(), response: def<User>() },
      });

      const c = s.consumer([
        { provide: BUILD_QUERY, useValue: () => createUser.prepare({ body: { name: 'Ada' } }).execute() },
      ]);
      const ref = mountSyncReadHost(c.injector);

      expect(ref.instance.atConstruction).not.toBeNull();
      expect(ref.instance.atInit).toBe(ref.instance.atConstruction);

      s.tick();

      expect(ref.instance.query()).toBe(ref.instance.atConstruction);
      expect(s.api.requestCount('POST', '/users')).toBe(1);

      ref.destroy();
      c.destroy();
      owner.destroy();
    });
  });

  it('runs a queryComputed that reads a required input once the input is set', () => {
    const s = scenario();
    s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

    const getUser = s.get<{ response: User; pathParams: { id: string } }>((p) => `/users/${p.id}`);
    const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

    const c = s.consumer([
      { provide: BUILD_USER_QUERY, useValue: (id: string) => legacyGetUser.prepare({ pathParams: { id } }).execute() },
    ]);
    const ref = createComponent(RequiredInputHost, { environmentInjector: c.injector });

    ref.setInput('id', '1');
    ref.changeDetectorRef.detectChanges();
    s.tick();

    expect(s.api.requestCount('GET', '/users/1')).toBe(1);
    expect(ref.instance.query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1' } });

    ref.destroy();
    c.destroy();
  });

  describe('queryComputed over the native V2QueryClient', () => {
    it('sends one POST per args change', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body, delay: 100 }));

      const owner = s.consumer();
      const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL }));
      const createUser = client.post({
        route: '/users',
        types: { args: def<{ body: { name: string } }>(), response: def<User>() },
      });
      const name = signal('Ada');

      const c = s.consumer();
      const query = queryComputed(() => createUser.prepare({ body: { name: name() } }).execute(), {
        injector: c.injector,
      });

      s.tick(1000);
      expect(s.api.requestCount('POST', '/users')).toBe(1);

      for (const [index, next] of ['Grace', 'Linus', 'Barbara'].entries()) {
        name.set(next);
        s.tick(1000);

        expect(s.api.requestCount('POST', '/users')).toBe(index + 2);
        expect(query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { name: next } });
      }

      c.destroy();
      owner.destroy();
    });

    it('sends one GET per args change and aborts the superseded one', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

      const owner = s.consumer();
      const client = owner.run(() => new V2QueryClient({ baseRoute: BASE_URL }));
      const getUser = client.get({
        route: (p) => `/users/${p.id}`,
        types: { args: def<{ pathParams: { id: string } }>(), response: def<User>() },
      });
      const id = signal('1');

      const c = s.consumer();
      const query = queryComputed(() => getUser.prepare({ pathParams: { id: id() } }).execute(), {
        injector: c.injector,
      });

      s.tick(10);

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);
      }

      s.tick(1000);

      for (const done of ['1', '2', '3', '4']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false]);

      expect(query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '4' } });

      c.destroy();
      client._store.forEach((stored, key) => {
        stored.abort();
        client._store.remove(key);
      });
      owner.destroy();
    });
  });
});

describe('reactive contract scenario: stacks and auth inside an effect', () => {
  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  type ItemArgs = { response: { id: string }; pathParams: { id: string } };

  it('re-executes every stack query once per trigger from execute() in an effect', () => {
    const s = scenario();
    s.api.on('GET', '/items/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 10 }));

    const getItem = s.get<ItemArgs>((p) => `/items/${p.id}`);
    const ids = signal(['1', '2']);
    const trigger = signal(0);

    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({ queryCreator: getItem, args: () => ids().map((id) => ({ pathParams: { id } })) }),
    );

    s.tick(100);

    c.run(() =>
      effect(() => {
        if (!trigger()) return;

        stack.execute({ allowCache: false });
      }),
    );

    for (const count of [1, 2, 3]) {
      trigger.set(count);
      s.tick(100);

      expect(s.api.requestCount('GET', '/items/1')).toBe(count + 1);
      expect(s.api.requestCount('GET', '/items/2')).toBe(count + 1);
    }

    for (const next of [['3'], ['4'], ['5']]) {
      ids.set(next);
      s.tick(100);

      expect(s.api.requestCount('GET', `/items/${next[0]}`)).toBe(1);
    }

    c.destroy();
  });

  it('retries the failed stack query once per trigger from retryFailed() in an effect', () => {
    const s = scenario();
    s.api.on('GET', '/failing/:id', ({ params }) =>
      params['id'] === '2' ? { status: 500, body: { message: 'boom' }, delay: 10 } : { body: { id: params['id'] } },
    );

    const getItem = s.get<ItemArgs>((p) => `/failing/${p.id}`);
    const trigger = signal(0);

    const c = s.consumer();
    const stack = c.run(() =>
      createQueryStack({
        queryCreator: getItem,
        args: () => [{ pathParams: { id: '1' } }, { pathParams: { id: '2' } }],
      }),
    );

    s.tick(100);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);

    c.run(() =>
      effect(() => {
        if (!trigger()) return;

        stack.retryFailed();
      }),
    );

    for (const count of [1, 2, 3]) {
      trigger.set(count);
      s.tick(100);

      expect(s.api.requestCount('GET', '/failing/2')).toBe(count + 1);
      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    }

    expect(s.api.requestCount('GET', '/failing/1')).toBe(1);

    c.destroy();
  });

  it('re-executes the matching page and its neighbours once per trigger from execute({ where }) in an effect', () => {
    const s = scenario();
    s.api.on('GET', '/pages', ({ query }) => ({
      body: {
        items: [{ id: Number(query['page']) }],
        currentPage: Number(query['page']),
        nextPage: Number(query['page']) < 5 ? Number(query['page']) + 1 : null,
        totalPageCount: 5,
        itemsPerPage: 1,
        totalHits: 5,
      },
      delay: 10,
    }));

    const getPages = s.get<{ response: Paginated<{ id: number }>; queryParams: { page: number } }>('/pages');
    const target = signal(0);

    const c = s.consumer();
    const pages = c.run(() =>
      createPagedQueryStack({
        queryCreator: getPages,
        responseNormalizer: ethletePaginationAdapter,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

    s.tick(100);

    for (let page = 2; page <= 5; page++) {
      pages.fetchNextPage();
      s.tick(100);
    }

    c.run(() =>
      effect(() => {
        const id = target();

        if (!id) return;

        pages.execute({ where: (item) => item.id === id });
      }),
    );

    const requestCount = (page: number) =>
      s.api.requests.filter((request) => request.query['page'] === String(page)).length;

    target.set(2);
    s.tick(100);
    expect([1, 2, 3, 4, 5].map(requestCount)).toEqual([2, 2, 2, 1, 1]);

    target.set(4);
    s.tick(100);
    expect([1, 2, 3, 4, 5].map(requestCount)).toEqual([2, 2, 3, 2, 2]);

    target.set(5);
    s.tick(100);
    expect([1, 2, 3, 4, 5].map(requestCount)).toEqual([2, 2, 3, 3, 3]);

    c.destroy();
  });

  it('sends one login per signal change from login.execute() in an effect', () => {
    const s = scenario();
    const auth = s.auth();
    const email = signal('a@test.com');

    const c = s.consumer();
    c.run(() => effect(() => auth.queries.login.execute({ body: { email: email() } })));

    s.tick(100);
    expect(s.api.requestCount('POST', '/auth/login')).toBe(1);

    for (const [index, next] of ['b@test.com', 'c@test.com', 'd@test.com'].entries()) {
      email.set(next);
      s.tick(100);

      expect(s.api.requestCount('POST', '/auth/login')).toBe(index + 2);
      expect(auth.isAuthenticated()).toBe(true);
    }

    c.destroy();
  });

  it('logs out once per trigger from logout() in an effect', () => {
    const s = scenario();
    const auth = s.auth();
    const logoutRequested = signal(0);
    let runs = 0;

    const c = s.consumer();

    c.run(() =>
      effect(() => {
        if (!logoutRequested()) return;

        runs++;
        auth.logout();
      }),
    );

    for (const count of [1, 2, 3]) {
      c.run(() => auth.queries.login.execute({ body: {} }));
      s.tick(100);
      expect(auth.isAuthenticated()).toBe(true);

      logoutRequested.set(count);
      s.tick(100);

      expect(auth.isAuthenticated()).toBe(false);
      expect(runs).toBe(count);
    }

    expect(s.api.requestCount('POST', '/auth/login')).toBe(3);

    c.destroy();
  });
});

const describeComputedContract = (label: string, providers?: () => (Provider | EnvironmentProviders)[]) =>
  describe(`reactive contract scenario: query objects inside a computed (${label})`, () => {
    const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 }, providers });

    type UserArgs = { response: User; pathParams: { id: string } };

    it('throws ET001 instead of NG0602 when a query is created inside a computed', () => {
      const s = scenario();
      const getUser = s.get<UserArgs>((p) => `/users/${p.id}`);

      const c = s.consumer();
      const query = computed(() =>
        getUser(
          { injector: c.injector },
          withArgs(() => ({ pathParams: { id: '1' } })),
        ),
      );

      expect(() => query()).toThrow(queryCreatedInReactiveContext().message);
      expect(s.liveQueries()).toEqual([]);

      c.destroy();
    });

    it('creates one snapshot per args change inside a computed', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

      const getUser = s.get<UserArgs>((p) => `/users/${p.id}`);
      const id = signal('1');

      const c = s.consumer();
      const query = c.run(() => getUser(withArgs(() => ({ pathParams: { id: id() } }))));
      const snapshot = computed(() => {
        query.args();

        return query.createSnapshot();
      });

      s.tick(10);
      snapshot();
      s.tick(10);
      expect(snapshot().args()).toMatchObject({ pathParams: { id: '1' } });

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);
        snapshot();
        s.tick(10);

        expect(snapshot().args()).toMatchObject({ pathParams: { id: next } });
      }

      s.tick(1000);

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false]);
      expect(snapshot().response()).toMatchObject({ id: '4' });
      expect(snapshot().isAlive()).toBe(false);

      c.destroy();
    });

    it('bridges a query signal with asObservable({ injector }) inside a computed', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<UserArgs>((p) => `/users/${p.id}`);
      const id = signal('1');

      const c = s.consumer();
      const query = c.run(() => getUser(withArgs(() => ({ pathParams: { id: id() } }))));
      const response$ = computed(() => query.response.asObservable({ injector: c.injector }));
      const seen: (string | undefined)[] = [];

      response$().subscribe((response) => seen.push(response?.id));
      s.tick();

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick();
      }

      expect(response$()).toBe(response$());
      expect(seen.filter((value) => value !== undefined)).toEqual(['1', '2', '3', '4']);

      c.destroy();
    });
  });

describeComputedContract('devtools off');
describeComputedContract('devtools on', () => [provideQueryDevtools()]);
