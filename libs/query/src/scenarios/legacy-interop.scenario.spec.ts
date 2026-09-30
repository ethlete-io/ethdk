import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  createEnvironmentInjector,
  EnvironmentInjector,
  inject,
  Injector,
  input,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AnyInfinityQueryConfig,
  AnyLegacyQuery,
  createGqlMutationViaPost,
  createGqlQueryViaPost,
  createInfinityQueryConfig,
  createLegacyQueryCreator,
  createQueryCollectionSignal,
  createSecureGetQuery,
  filterSuccess,
  gql,
  InfinityQueryDirective,
  InfinityQueryTriggerDirective,
  provideLegacyPrepareFallback,
  QueryDirective,
  queryComputed,
  QueryStateType,
  V2QueryState,
} from '../index';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { useScenario } from './harness';

type User = { id: string; name: string };
type GetUserArgs = { response: User; pathParams: { id: string } };

const recordStates = (query: AnyLegacyQuery) => {
  const states: V2QueryState[] = [];
  const subscription = query.state$.subscribe((state: V2QueryState) => states.push(state));

  return { states, stop: () => subscription.unsubscribe() };
};

@Component({
  imports: [InfinityQueryDirective, InfinityQueryTriggerDirective],
  template: `
    <div *etInfinityQuery="config(); let items; let canLoadMore = canLoadMore; let currentPage = currentPage">
      <span data-slot="items">{{ ids(items) }}</span>
      <span data-slot="canLoadMore">{{ canLoadMore }}</span>
      <span data-slot="currentPage">{{ currentPage }}</span>
      @if (canLoadMore) {
        <button data-slot="more" etInfinityQueryTrigger type="button">more</button>
      }
    </div>
  `,
})
class InteropInfinityQueryHost {
  config = input.required<AnyInfinityQueryConfig>();

  ids = (items: { id: string }[] | null) => (items ?? []).map((item) => item.id).join(',');
}

@Component({
  imports: [QueryDirective],
  template: `
    <div *etQuery="query(); let loading = loading; let refreshing = refreshing">
      <span data-slot="loading">{{ loading }}</span>
      <span data-slot="refreshing">{{ refreshing }}</span>
    </div>
  `,
})
class InteropQueryHost {
  query = input.required<AnyLegacyQuery | null>();
}

@Component({ template: '' })
class InteropOwnerHost {
  injector = inject(Injector);
}

const slotText = (fixture: { nativeElement: HTMLElement }, slot: string) =>
  (fixture.nativeElement.querySelector(`[data-slot="${slot}"]`)?.textContent ?? '').trim();

describe('legacy interop scenario', () => {
  describe('createLegacyQueryCreator', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('wraps a current creator in the prepare/execute/state$ surface', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }));
      const recorded = recordStates(query);
      const responses: User[] = [];

      query.state$.pipe(filterSuccess()).subscribe((state) => responses.push(state.response));

      expect(query.rawState).toMatchObject({ type: QueryStateType.Prepared });

      query.execute();
      s.tick();

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(recorded.states.map((state) => state.type)).toEqual([
        QueryStateType.Prepared,
        QueryStateType.Loading,
        QueryStateType.Success,
      ]);
      expect(responses).toEqual([{ id: '1', name: 'Ada' }]);
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });

      recorded.stop();
      c.destroy();
    });

    it('forwards variables to a wrapped gql creator', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '2', name: 'Grace' } } } }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{
        response: { user: User };
        variables: { userId: string };
      }>(gql`
        query GetUser($userId: ID!) {
          user(id: $userId) {
            id
            name
          }
        }
      `);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ variables: { userId: '2' } }).execute());
      s.tick();

      expect(s.api.requests[0]?.body).toMatchObject({ variables: { userId: '2' } });
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success });

      c.destroy();
    });

    it('maps a failed request to a Failure state that carries the status', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ status: 500, body: { message: 'boom' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());
      s.flush();

      expect(query.rawState).toMatchObject({
        type: QueryStateType.Failure,
        error: { status: 500, detail: { message: 'boom' } },
      });

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      c.destroy();
    });

    it('ignores a second execute() on an in-flight interop mutation unless cancelPrevious is set', () => {
      const s = scenario();
      s.api.on('POST', '/users', () => ({ body: { id: '1', name: 'Ada' }, delay: 1000 }));

      const createUser = s.post<{ response: User; body: { name: string } }>('/users');
      const legacyCreateUser = createLegacyQueryCreator({ creator: createUser, name: 'legacyCreateUser' });

      const c = s.consumer();
      const query = c.run(() => legacyCreateUser.prepare({ body: { name: 'Ada' } }).execute());

      s.tick(100);
      query.execute();
      s.tick(100);

      expect(s.api.requestCount('POST', '/users')).toBe(1);
      expect(s.api.requests[0]?.aborted).toBe(false);

      s.tick(1000);
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success });

      c.destroy();
    });

    it('cancels the in-flight interop mutation and re-sends it when cancelPrevious is set', () => {
      const s = scenario();
      s.api.on('POST', '/users-cancel', () => ({ body: { id: '1', name: 'Ada' }, delay: 1000 }));

      const createUser = s.post<{ response: User; body: { name: string } }>('/users-cancel');
      const legacyCreateUser = createLegacyQueryCreator({ creator: createUser, name: 'legacyCreateUser' });

      const c = s.consumer();
      const query = c.run(() => legacyCreateUser.prepare({ body: { name: 'Ada' } }).execute());

      s.tick(100);
      query.execute({ cancelPrevious: true });
      s.tick(100);

      expect(s.api.requestCount('POST', '/users-cancel')).toBe(2);
      expect(s.api.requests[0]?.aborted).toBe(true);

      s.tick(1000);
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success });

      c.destroy();
    });

    it('marks a polled interop query as refreshing rather than loading', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1_000 }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());

      const fixture = TestBed.createComponent(InteropQueryHost);

      fixture.componentRef.setInput('query', query);
      fixture.detectChanges();
      s.flush();
      fixture.detectChanges();

      expect(slotText(fixture, 'loading')).toBe('false');
      expect(slotText(fixture, 'refreshing')).toBe('false');

      const stopPolling$ = new Subject<void>();
      query.poll({ interval: 1_000, takeUntil: stopPolling$ });

      for (let step = 0; step < 40 && query.rawState.type !== QueryStateType.Loading; step++) {
        s.tick(100);
      }

      fixture.detectChanges();

      expect(query.rawState.type).toBe(QueryStateType.Loading);
      expect(slotText(fixture, 'refreshing')).toBe('true');
      expect(slotText(fixture, 'loading')).toBe('false');

      query.stopPolling();
      s.flush();
      fixture.destroy();
      c.destroy();
    });

    it('executes a polled interop query immediately when triggerImmediately is set', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());

      s.tick();

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);

      const stopPolling$ = new Subject<void>();
      query.poll({ interval: 1_000, triggerImmediately: true, takeUntil: stopPolling$ });
      s.tick(1);

      expect(s.api.requestCount('GET', '/users/1')).toBe(2);

      s.tick(1_000);

      expect(s.api.requestCount('GET', '/users/1')).toBe(3);

      query.stopPolling();
      c.destroy();
    });

    it('reports Cancelled after abort() on an interop query', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1_000 }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const c = s.consumer();
      const query = c.run(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute());
      const recorded = recordStates(query);

      s.tick(100);
      query.abort();
      s.tick();

      expect(query.rawState.type).toBe(QueryStateType.Cancelled);
      expect(recorded.states.map((state) => state.type)).toEqual([QueryStateType.Loading, QueryStateType.Cancelled]);
      expect(s.api.requests[0]?.aborted).toBe(true);

      query.execute();
      s.tick(1_000);

      expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });

      recorded.stop();
      c.destroy();
    });

    it('sends one request for a prepare().execute() inside queryComputed', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ body: { id: '1', name: 'Ada' }, delay: 100 }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const c = s.consumer();
      const query = queryComputed(() => legacyGetUser.prepare({ pathParams: { id: '1' } }).execute(), {
        injector: c.injector,
      });

      s.tick(1000);

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(query()?.rawState).toMatchObject({ type: QueryStateType.Success });

      c.destroy();
    });

    it('prepare() outside an injection context throws ET950 and names the creator', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ body: { id: '1', name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      expect(() => legacyGetUser.prepare({ pathParams: { id: '1' } })).toThrow(/950/);
      expect(() => legacyGetUser.prepare({ pathParams: { id: '1' } })).toThrow(/"legacyGetUser"/);
      expect(() => legacyGetUser.createSignal(null)).toThrow(/950/);

      expect(s.api.requests.length).toBe(0);
    });

    it('prepare() with a destroyed injector warns once and returns an inert query that never executes', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', () => ({ body: { id: '1', name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const gone = s.consumer();
        const injector = gone.injector;
        gone.destroy();

        const query = legacyGetUser.prepare({ pathParams: { id: '1' }, injector });
        const recorded = recordStates(query);

        query.execute();
        s.tick();

        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0]?.[0])).toContain('destroyed injector');
        expect(s.api.requests.length).toBe(0);
        expect(recorded.states.map((state) => state.type)).toEqual([QueryStateType.Prepared]);

        query.destroy();
        recorded.stop();
      } finally {
        warn.mockRestore();
      }
    });
    it('reports a secure load that waited for a login as the trigger it was started with', async () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/users/**');
      s.api.on('GET', '/users/me', () => ({ body: { id: 'me', name: 'Ada' }, delay: 20 }));

      const getUserMe = createSecureGetQuery(s.clientRef, auth.ref)<{ response: User }>('/users/me');
      const legacyGetUserMe = createLegacyQueryCreator({ creator: getUserMe, name: 'legacyGetUserMe' });

      const c = s.consumer();
      const query = c.run(() => legacyGetUserMe.prepare({}));
      const recorded = recordStates(query);

      query.execute({ _triggeredVia: 'program' });
      s.tick(10);
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();
      s.flush();

      expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: 'me' } });
      const loadingTriggers = recorded.states
        .filter((state) => state.type === QueryStateType.Loading)
        .map((state) => state.meta.triggeredVia);

      expect(loadingTriggers.length).toBeGreaterThan(1);
      expect(new Set(loadingTriggers)).toEqual(new Set(['program']));

      recorded.stop();
      c.destroy();
    });
    it('reports a refresh after an empty secure load as auto', async () => {
      const s = scenario();
      const auth = s.auth();
      s.api.protect('/users/**');
      s.api.on('GET', '/users/empty', () => ({ status: 204, delay: 20 }));

      const getEmpty = createSecureGetQuery(s.clientRef, auth.ref)<{ response: null }>('/users/empty');
      const legacyGetEmpty = createLegacyQueryCreator({ creator: getEmpty, name: 'legacyGetEmpty' });

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();
      s.flush();

      const query = c.run(() => legacyGetEmpty.prepare({}));
      const recorded = recordStates(query);

      query.execute({ _triggeredVia: 'program' });
      await s.settle();
      s.flush();

      expect(query.rawState.type).toBe(QueryStateType.Success);

      s.tick(5);
      recorded.states.length = 0;
      s.client.refreshQueriesInUse();
      s.flush();

      const loadingTriggers = recorded.states
        .filter((state) => state.type === QueryStateType.Loading)
        .map((state) => state.meta.triggeredVia);

      expect(loadingTriggers).not.toHaveLength(0);
      expect(new Set(loadingTriggers)).toEqual(new Set(['auto']));

      await s.settle();
      recorded.stop();
      c.destroy();
    });
  });

  describe('an owner destroyed while its request is in flight', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    const legacyCreateUserFor = (s: ReturnType<typeof scenario>) => {
      s.api.on('POST', '/users', ({ body }) => ({
        status: 201,
        body: { id: 'u1', ...(body as { name: string }) },
        delay: 1000,
      }));

      const createUser = s.post<{ response: User; body: { name: string } }>('/users');

      return createLegacyQueryCreator({ creator: createUser, name: 'legacyCreateUser' });
    };

    const renameUserFor = (s: ReturnType<typeof scenario>) => {
      s.api.on('POST', '/', () => ({ body: { data: { renameUser: { ok: true } } }, delay: 1000 }));

      const renameUser = createGqlMutationViaPost(s.clientRef)<{
        response: { renameUser: { ok: boolean } };
        variables: { name: string };
      }>(gql`
        mutation RenameUser($name: String!) {
          renameUser(name: $name) {
            ok
          }
        }
      `);

      return createLegacyQueryCreator({ creator: renameUser, name: 'legacyRenameUser' });
    };

    const postRequest = (s: ReturnType<typeof scenario>) => s.api.requests.find((r) => r.method === 'POST');

    const mountComponent = (s: ReturnType<typeof scenario>, parent?: EnvironmentInjector) => {
      const ref = s.mount(InteropOwnerHost, parent);

      return {
        injector: ref.instance.injector,
        run: <T>(fn: () => T) => runInInjectionContext(ref.instance.injector, fn),
        destroy: () => ref.destroy(),
      };
    };

    it('lets a POST prepared in a component finish, then destroys it', () => {
      const s = scenario();
      const legacyCreateUser = legacyCreateUserFor(s);

      const dialog = mountComponent(s);
      const query = dialog.run(() =>
        legacyCreateUser.prepare({ body: { name: 'Ada' }, injector: inject(Injector) }).execute(),
      );
      s.tick(100);

      dialog.destroy();
      s.flush();

      expect(postRequest(s)?.aborted).toBe(false);
      expect(query.rawState.type).toBe(QueryStateType.Success);
      expect(s.liveQueries()).toHaveLength(0);
    });

    it('lets a POST held by queryComputed finish after its component is destroyed', () => {
      const s = scenario();
      const legacyCreateUser = legacyCreateUserFor(s);
      const name = signal('Ada');

      const form = mountComponent(s);
      const held = form.run(() => queryComputed(() => legacyCreateUser.prepare({ body: { name: name() } })));
      s.tick();

      const query = held();
      query?.execute();
      s.tick(100);

      form.destroy();
      s.flush();

      expect(postRequest(s)?.aborted).toBe(false);
      expect(query?.rawState.type).toBe(QueryStateType.Success);
      expect(s.liveQueries()).toHaveLength(0);
    });

    it('lets an overlay that prepares a POST into its own collection close without cancelling it', () => {
      const s = scenario();
      const legacyCreateUser = legacyCreateUserFor(s);

      const overlay = mountComponent(s);
      const injector = overlay.injector;
      const collection = overlay.run(() => createQueryCollectionSignal({ createUser: legacyCreateUser as never }));
      const query = legacyCreateUser.prepare({ body: { name: 'Ada' }, injector }).execute();
      collection.set({ type: 'createUser', query } as never);
      s.tick(100);

      overlay.destroy();
      s.flush();

      expect(postRequest(s)?.aborted).toBe(false);
      expect(query.rawState.type).toBe(QueryStateType.Success);
      expect(s.liveQueries()).toHaveLength(0);
    });

    it('still aborts a GET prepared in a component when the component is destroyed', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 1000 }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const page = mountComponent(s);
      page.run(() => legacyGetUser.prepare({ pathParams: { id: '1' }, injector: inject(Injector) }).execute());
      s.tick(100);

      page.destroy();
      s.flush();

      expect(s.api.requests.find((r) => r.method === 'GET')?.aborted).toBe(true);
      expect(s.liveQueries()).toHaveLength(0);
    });

    it('lets a GQL mutation prepared in a component finish, then destroys it', () => {
      const s = scenario();
      const legacyRenameUser = renameUserFor(s);

      const form = mountComponent(s);
      const query = form.run(() =>
        legacyRenameUser.prepare({ variables: { name: 'Ada' }, injector: inject(Injector) }).execute(),
      );
      s.tick(100);

      form.destroy();
      s.flush();

      expect(postRequest(s)?.aborted).toBe(false);
      expect(query.rawState.type).toBe(QueryStateType.Success);
      expect(s.liveQueries()).toHaveLength(0);
    });

    it('still aborts a GQL query prepared in a component when the component is destroyed', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { user: { id: '1', name: 'Ada' } } }, delay: 1000 }));

      const getUser = createGqlQueryViaPost(s.clientRef)<{
        response: { user: User };
        variables: { userId: string };
      }>(gql`
        query GetUser($userId: ID!) {
          user(id: $userId) {
            id
            name
          }
        }
      `);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const page = mountComponent(s);
      page.run(() => legacyGetUser.prepare({ variables: { userId: '1' }, injector: inject(Injector) }).execute());
      s.tick(100);

      page.destroy();
      s.flush();

      expect(postRequest(s)?.aborted).toBe(true);
      expect(s.liveQueries()).toHaveLength(0);
    });

    describe('below a child environment injector that provides the client', () => {
      const childClient = (s: ReturnType<typeof scenario>) =>
        createEnvironmentInjector(
          s.clientRef.provide(),
          s.run(() => inject(EnvironmentInjector)),
        );

      it('lets a POST finish when its component is destroyed', () => {
        const s = scenario();
        const legacyCreateUser = legacyCreateUserFor(s);
        const lazyRoute = childClient(s);

        const dialog = mountComponent(s, lazyRoute);
        const query = dialog.run(() =>
          legacyCreateUser.prepare({ body: { name: 'Ada' }, injector: inject(Injector) }).execute(),
        );
        s.tick(100);

        dialog.destroy();
        s.flush();

        expect(postRequest(s)?.aborted).toBe(false);
        expect(query.rawState.type).toBe(QueryStateType.Success);
        expect(s.liveQueries()).toHaveLength(0);

        lazyRoute.destroy();
      });

      it('aborts a POST when the child environment injector is destroyed mid-flight', () => {
        const s = scenario();
        const legacyCreateUser = legacyCreateUserFor(s);
        const lazyRoute = childClient(s);

        const dialog = mountComponent(s, lazyRoute);
        dialog.run(() => legacyCreateUser.prepare({ body: { name: 'Ada' }, injector: inject(Injector) }).execute());
        s.tick(100);

        lazyRoute.destroy();
        s.flush();

        expect(postRequest(s)?.aborted).toBe(true);
        expect(s.liveQueries()).toHaveLength(0);
      });
    });
  });

  describe('infinity query', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('renders an infinity query built on an interop creator', () => {
      const s = scenario();
      s.api.on('GET', '/users', ({ query }) => {
        const page = Number(query['page'] ?? '1');

        return { body: { items: [{ id: `${page}a` }, { id: `${page}b` }], totalPages: 2 } };
      });

      const getUsers = s.get<{
        response: { items: { id: string }[]; totalPages: number };
        queryParams: { page: number; limit: number };
      }>('/users');
      const legacyGetUsers = createLegacyQueryCreator({ creator: getUsers, name: 'legacyGetUsers' });
      const config = createInfinityQueryConfig({
        queryCreator: legacyGetUsers,
        limitParam: { value: 2 },
        response: { arrayType: [] as { id: string }[], valueExtractor: (response) => response.items },
      });

      const fixture = TestBed.createComponent(InteropInfinityQueryHost);

      fixture.componentRef.setInput('config', config);
      fixture.detectChanges();
      s.tick();
      fixture.detectChanges();

      expect(slotText(fixture, 'items')).toBe('1a,1b');
      expect(slotText(fixture, 'currentPage')).toBe('1');
      expect(slotText(fixture, 'canLoadMore')).toBe('true');

      const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-slot="more"]');

      expect(trigger).not.toBeNull();
      trigger?.click();
      s.tick();
      fixture.detectChanges();

      expect(slotText(fixture, 'items')).toBe('1a,1b,2a,2b');
      expect(slotText(fixture, 'currentPage')).toBe('2');
      expect(slotText(fixture, 'canLoadMore')).toBe('false');
      expect(s.api.requests.map((request) => request.query['page'])).toEqual(['1', '2']);

      fixture.destroy();
    });
  });

  describe('provideLegacyPrepareFallback', () => {
    const scenario = useScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: [provideLegacyPrepareFallback()],
    });

    it('lets prepare() outside an injection context run against the root injector', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });

      const query = legacyGetUser.prepare({ pathParams: { id: '1' } }).execute();
      s.tick();

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(query.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });

      query.destroy();
    });
  });
  describe('provideLegacyPrepareFallback with two applications on one page', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keeps the first application answering after a second one boots and is destroyed', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const getUser = s.get<GetUserArgs>((p) => `/users/${p.id}`);
      const legacyGetUser = createLegacyQueryCreator({ creator: getUser, name: 'legacyGetUser' });
      const root = s.run(() => inject(EnvironmentInjector));

      const appOne = createEnvironmentInjector([provideLegacyPrepareFallback()], root);
      const appTwo = createEnvironmentInjector([provideLegacyPrepareFallback()], root);

      const fromAppOne = legacyGetUser.prepare({ pathParams: { id: '1' } }).execute();
      s.tick();

      expect(fromAppOne.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1', name: 'Ada' } });

      appTwo.destroy();

      const afterAppTwoIsGone = legacyGetUser.prepare({ pathParams: { id: '2' } }).execute();
      s.tick();

      expect(afterAppTwoIsGone.rawState).toMatchObject({
        type: QueryStateType.Success,
        response: { id: '2', name: 'Ada' },
      });

      fromAppOne.destroy();
      afterAppTwoIsGone.destroy();
      appOne.destroy();
    });
  });
});
