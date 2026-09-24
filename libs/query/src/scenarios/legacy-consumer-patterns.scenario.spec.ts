import {
  ApplicationRef,
  Component,
  createComponent,
  EnvironmentInjector,
  inject,
  InjectionToken,
  OnInit,
  signal,
  Type,
  WritableSignal,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { queryComputed, QueryField, QueryForm, QueryStateType } from '../index';
import { describe, expect, it } from 'vitest';
import {
  createLegacyClient,
  LEGACY_CLIENT_KINDS,
  LegacyClientCreator,
  LegacyClientQuery,
  useScenario,
} from './harness';

type GetUserArgs = { pathParams: { id: string } };
type CreateUserArgs = { body: { name: string } };
type SearchUsersArgs = { queryParams: Record<string, unknown> };

const GET_USER = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_USER');
const CREATE_USER = new InjectionToken<LegacyClientCreator<CreateUserArgs>>('CREATE_USER');
const SEARCH_USERS = new InjectionToken<LegacyClientCreator<SearchUsersArgs>>('SEARCH_USERS');
const USER_ID = new InjectionToken<WritableSignal<string | null>>('USER_ID');
const USER_NAME = new InjectionToken<WritableSignal<string>>('USER_NAME');

@Component({ template: '' })
class UserHost implements OnInit {
  private readonly getUser = inject(GET_USER);
  private readonly id = inject(USER_ID);

  readonly query = queryComputed(() => this.getUser.prepare({ pathParams: { id: this.id() ?? '' } }).execute());
  readonly atConstruction = this.query();
  atInit: LegacyClientQuery | null = null;

  ngOnInit() {
    this.atInit = this.query();
  }
}

@Component({ template: '' })
class GuardedUserHost {
  private readonly getUser = inject(GET_USER);
  private readonly id = inject(USER_ID);

  readonly query = queryComputed(() => {
    const id = this.id();

    if (!id) return null;

    return this.getUser.prepare({ pathParams: { id } }).execute();
  });
}

@Component({ template: '' })
class CreateUserHost {
  private readonly createUser = inject(CREATE_USER);
  private readonly name = inject(USER_NAME);

  readonly query = queryComputed(() => this.createUser.prepare({ body: { name: this.name() } }).execute());
}

@Component({ template: '' })
class SearchUsersHost {
  private readonly searchUsers = inject(SEARCH_USERS);

  readonly form = new QueryForm({
    search: new QueryField({ control: new FormControl<string | null>(null), debounce: 300 }),
  }).observe();

  readonly query = queryComputed(() =>
    this.searchUsers.prepare({ queryParams: { ...this.form.currentValue() } }).execute(),
  );
}

const mount = <T>(host: Type<T>, injector: EnvironmentInjector) => {
  const ref = createComponent(host, { environmentInjector: injector });

  injector.get(ApplicationRef).attachView(ref.hostView);
  ref.changeDetectorRef.detectChanges();

  return ref;
};

describe.each(LEGACY_CLIENT_KINDS)('legacy consumer patterns on the %s client', (kind) => {
  describe('queryComputed in a component field initializer', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends one GET per id change, aborts the superseded one and keeps one live query', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

      const id = signal<string | null>('1');
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: id },
      ]);
      const ref = mount(UserHost, c.injector);

      s.tick(10);

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);

        expect(legacy.liveQueries()).toEqual([ref.instance.query()]);
      }

      s.tick(1000);

      for (const done of ['1', '2', '3', '4']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false]);
      expect(legacy.prepared()).toHaveLength(4);
      expect(legacy.liveQueries()).toEqual([ref.instance.query()]);
      expect(ref.instance.query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '4' } });

      ref.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      c.destroy();
      legacy.destroy();
    });

    it('toggles a null-guarded GET between null and a value with one request per value', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

      const id = signal<string | null>(null);
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: id },
      ]);
      const ref = mount(GuardedUserHost, c.injector);

      s.tick(1000);
      expect(ref.instance.query()).toBeNull();
      expect(s.api.requests).toHaveLength(0);

      id.set('1');
      s.tick(10);
      id.set(null);
      s.tick(1000);

      expect(ref.instance.query()).toBeNull();
      expect(legacy.liveQueries()).toEqual([]);

      for (const next of ['2', '3']) {
        id.set(next);
        s.tick(1000);

        expect(ref.instance.query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: next } });
        expect(legacy.liveQueries()).toEqual([ref.instance.query()]);

        id.set(null);
        s.tick(1000);

        expect(ref.instance.query()).toBeNull();
        expect(legacy.liveQueries()).toEqual([]);
      }

      for (const done of ['1', '2', '3']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, false, false]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('sends exactly one POST per args change', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body, delay: 100 }));

      const name = signal('Ada');
      const c = s.consumer([
        { provide: CREATE_USER, useValue: legacy.post<CreateUserArgs>('/users') },
        { provide: USER_NAME, useValue: name },
      ]);
      const ref = mount(CreateUserHost, c.injector);

      s.tick(1000);
      expect(s.api.requestCount('POST', '/users')).toBe(1);

      for (const [index, next] of ['Grace', 'Linus', 'Barbara'].entries()) {
        name.set(next);
        s.tick(1000);

        expect(s.api.requestCount('POST', '/users')).toBe(index + 2);
        expect(ref.instance.query()?.rawState).toMatchObject({
          type: QueryStateType.Success,
          response: { name: next },
        });
        expect(legacy.liveQueries()).toEqual([ref.instance.query()]);
      }

      expect(s.api.requests.map((request) => request.body)).toEqual([
        { name: 'Ada' },
        { name: 'Grace' },
        { name: 'Linus' },
        { name: 'Barbara' },
      ]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('returns the executed query in the constructor and in ngOnInit', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' } }));

      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: signal('1') },
      ]);
      const ref = mount(UserHost, c.injector);

      expect(ref.instance.atConstruction).not.toBeNull();
      expect(ref.instance.atInit).toBe(ref.instance.atConstruction);

      s.tick();

      expect(ref.instance.query()).toBe(ref.instance.atConstruction);
      expect(s.api.requestCount('GET', '/users/1')).toBe(1);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('keeps a request alive when the component that started it is replaced mid-flight', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: signal('1') },
      ]);
      const first = mount(UserHost, c.injector);

      s.tick(10);

      const second = mount(UserHost, c.injector);
      first.destroy();
      s.tick(1000);

      expect(s.api.requests.map((request) => request.aborted)).not.toContain(true);
      expect(second.instance.query()?.rawState).toMatchObject({
        type: QueryStateType.Success,
        response: { id: '1' },
      });
      expect(legacy.liveQueries()).toEqual([second.instance.query()]);

      second.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('sends one request per debounced change of a legacy QueryForm feeding the args', async () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users', ({ query }) => ({ body: { search: query['search'] ?? null }, delay: 20 }));

      const c = s.consumer([{ provide: SEARCH_USERS, useValue: legacy.get<SearchUsersArgs>('/users') }]);
      const ref = mount(SearchUsersHost, c.injector);
      await s.settle(1000);

      const search = ref.instance.form.controls.search;

      for (const value of ['a', 'ad', 'ada']) {
        search.setValue(value);
        await s.settle(50);
      }

      await s.settle(1000);

      for (const value of ['adal', 'adala']) {
        search.setValue(value);
        await s.settle(1000);
      }

      expect(s.api.requests.map((request) => request.query['search'] ?? null)).toEqual([null, 'ada', 'adal', 'adala']);
      expect(ref.instance.form.changes()?.currentValue).toEqual({ search: 'adala' });
      expect(ref.instance.query()?.rawState).toMatchObject({
        type: QueryStateType.Success,
        response: { search: 'adala' },
      });
      expect(legacy.liveQueries()).toEqual([ref.instance.query()]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('navigating away and back with a cached response', () => {
    const scenario = useScenario();

    it('renders the cached response on re-mount without a new request', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: 'Ada' },
        headers: { 'cache-control': 'max-age=60' },
        delay: 100,
      }));

      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: signal('1') },
      ]);
      const first = mount(UserHost, c.injector);

      s.tick(1000);
      first.destroy();
      s.tick(10);

      const second = mount(UserHost, c.injector);

      expect(second.instance.query()?.rawState).toMatchObject({
        type: QueryStateType.Success,
        response: { id: '1' },
      });

      s.tick(1000);

      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(second.instance.query()?.rawState).toMatchObject({
        type: QueryStateType.Success,
        response: { id: '1' },
      });
      expect(legacy.liveQueries()).toEqual([second.instance.query()]);

      second.destroy();
      c.destroy();
      legacy.destroy();
    });
  });
});
