import { Component, ComponentRef, inject, InjectionToken, Injector, signal, WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  QueryDirective,
  queryComputed,
  queryStateLoadingSignal,
  queryStateResponseSignal,
  QueryStateType,
} from '../index';
import { describe, expect, it } from 'vitest';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClientCreator, useScenario } from './harness';

type User = { id: string; name: string };
type GetUserArgs = { pathParams: { id: string } };
type CreateUserArgs = { body: { name: string } };

const GET_USER = new InjectionToken<LegacyClientCreator<GetUserArgs>>('GET_USER');
const CREATE_USER = new InjectionToken<LegacyClientCreator<CreateUserArgs>>('CREATE_USER');
const USER_ID = new InjectionToken<WritableSignal<string>>('USER_ID');
const PASS_INJECTOR = new InjectionToken<boolean>('PASS_INJECTOR');
const STOP_POLLING = new InjectionToken<Subject<void>>('STOP_POLLING');

const nameOf = (user: unknown) => (user as User | null)?.name ?? '-';

@Component({
  imports: [QueryDirective],
  template: `
    <p *etQuery="query() as user; loading as loading; error as error; cache: true">
      <span data-slot="name">{{ nameOf(user) }}</span>
      <span data-slot="loading">{{ loading }}</span>
      <span data-slot="error">{{ error?.status ?? '-' }}</span>
    </p>
  `,
})
class UserTemplateHost {
  private readonly getUser = inject(GET_USER);
  private readonly id = inject(USER_ID);

  readonly nameOf = nameOf;
  readonly query = queryComputed(() => this.getUser.prepare({ pathParams: { id: this.id() } }).execute());
}

@Component({ template: '' })
class UserSignalsHost {
  private readonly getUser = inject(GET_USER);
  private readonly id = inject(USER_ID);

  readonly query = queryComputed(() => this.getUser.prepare({ pathParams: { id: this.id() } }).execute());
  readonly response = queryStateResponseSignal(this.query, { cacheResponse: true });
  readonly loading = queryStateLoadingSignal(this.query);
}

@Component({
  imports: [QueryDirective],
  template: `
    <p *etQuery="query() as user; loading as loading">
      <span data-slot="name">{{ nameOf(user) }}</span>
      <span data-slot="loading">{{ loading }}</span>
    </p>
    <button (click)="create()" data-slot="create" type="button">create</button>
  `,
})
class CreateUserOnClickHost {
  private readonly createUser = inject(CREATE_USER);
  private readonly injector = inject(PASS_INJECTOR) ? inject(Injector) : undefined;
  private clicks = 0;

  readonly nameOf = nameOf;
  readonly query = this.createUser.createSignal();
  readonly response = queryStateResponseSignal(this.query);

  create() {
    this.clicks++;
    this.query.set(
      this.createUser
        .prepare({ body: { name: `User ${this.clicks}` }, ...(this.injector && { injector: this.injector }) })
        .execute(),
    );
  }
}

@Component({ template: '' })
class PollingUserHost {
  private readonly getUser = inject(GET_USER);
  private readonly id = inject(USER_ID);
  private readonly stop = inject(STOP_POLLING);

  readonly query = queryComputed(() =>
    this.getUser
      .prepare({ pathParams: { id: this.id() } })
      .execute()
      .poll({ interval: 1000, takeUntil: this.stop }),
  );
}

const slot = (ref: ComponentRef<unknown>, name: string) =>
  ((ref.location.nativeElement as HTMLElement).querySelector(`[data-slot="${name}"]`)?.textContent ?? '').trim();

describe.each(LEGACY_CLIENT_KINDS)('legacy template patterns on the %s client', (kind) => {
  describe('*etQuery over a queryComputed whose args change', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('renders the latest query only, with loading during every switch and the cache in between', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: `User ${params['id']}` },
        delay: params['id'] === '1' ? 500 : 100,
      }));

      const id = signal('1');
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: id },
      ]);
      const ref = s.mount(UserTemplateHost, c.injector);

      s.tick(10);
      expect(slot(ref, 'loading')).toBe('true');

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);

        expect(slot(ref, 'loading')).toBe('true');
        expect(slot(ref, 'name')).toBe('-');
      }

      s.tick(1000);

      expect(slot(ref, 'name')).toBe('User 4');
      expect(slot(ref, 'loading')).toBe('false');

      id.set('5');
      s.tick(10);

      expect(slot(ref, 'loading')).toBe('true');
      expect(slot(ref, 'name')).toBe('User 4');

      s.tick(1000);

      expect(slot(ref, 'name')).toBe('User 5');
      expect(slot(ref, 'loading')).toBe('false');

      for (const done of ['1', '2', '3', '4', '5']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false, false]);
      expect(legacy.liveQueries()).toEqual([ref.instance.query()]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('reports a failure once and clears the error once the next query succeeds', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) =>
        params['id'] === 'missing'
          ? { status: 404, body: { message: 'not found' }, delay: 50 }
          : { body: { id: params['id'], name: `User ${params['id']}` }, delay: 50 },
      );

      const id = signal('missing');
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: id },
      ]);
      const ref = s.mount(UserTemplateHost, c.injector);

      s.tick(1000);

      expect(slot(ref, 'error')).toBe('404');
      expect(slot(ref, 'loading')).toBe('false');
      expect(s.errors).toHaveLength(kind === 'interop' ? 1 : 0);
      if (kind === 'interop') s.expectError((entry) => (entry.error as { status?: number }).status === 404);

      id.set('1');
      s.tick(10);

      expect(slot(ref, 'loading')).toBe('true');
      expect(slot(ref, 'error')).toBe('-');

      s.tick(1000);

      expect(slot(ref, 'name')).toBe('User 1');
      expect(slot(ref, 'error')).toBe('-');
      expect(ref.instance.query()?.rawState).toMatchObject({ type: QueryStateType.Success });

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('queryStateResponseSignal with cacheResponse over a switching source', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('keeps the last response while the next query loads and never shows a superseded one', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: `User ${params['id']}` },
        delay: params['id'] === '2' ? 500 : 100,
      }));

      const id = signal('1');
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: id },
      ]);
      const ref = s.mount(UserSignalsHost, c.injector);

      s.tick(10);
      expect(ref.instance.loading()).not.toBeNull();
      expect(ref.instance.response()).toBeNull();

      s.tick(1000);
      expect(ref.instance.response()).toMatchObject({ id: '1' });
      expect(ref.instance.loading()).toBeNull();

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);

        expect(ref.instance.loading()).not.toBeNull();
        expect(ref.instance.response()).toMatchObject({ id: '1' });
      }

      s.tick(150);
      expect(ref.instance.response()).toMatchObject({ id: '4' });
      expect(ref.instance.loading()).toBeNull();

      s.tick(1000);
      expect(ref.instance.response()).toMatchObject({ id: '4' });

      for (const done of ['1', '2', '3', '4']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([false, true, true, false]);
      expect(legacy.liveQueries()).toEqual([ref.instance.query()]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });

  describe('creator.createSignal() set from a click handler', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends one request per click and releases the previous query', () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body, delay: 50 }));

      const c = s.consumer([
        { provide: CREATE_USER, useValue: legacy.post<CreateUserArgs>('/users') },
        { provide: PASS_INJECTOR, useValue: kind === 'interop' },
      ]);
      const ref = s.mount(CreateUserOnClickHost, c.injector);
      const button = (ref.location.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '[data-slot="create"]',
      );

      s.tick(100);
      expect(s.api.requests).toHaveLength(0);
      expect(slot(ref, 'name')).toBe('-');

      for (const click of [1, 2, 3]) {
        button?.click();
        s.tick(10);

        expect(slot(ref, 'loading')).toBe('true');

        s.tick(1000);

        expect(s.api.requestCount('POST', '/users')).toBe(click);
        expect(slot(ref, 'name')).toBe(`User ${click}`);
        expect(slot(ref, 'loading')).toBe('false');
        expect(ref.instance.response()).toEqual({ name: `User ${click}` });
        expect(legacy.liveQueries()).toEqual([ref.instance.query()]);
      }

      expect(legacy.prepared()).toHaveLength(3);
      expect(s.api.requests.map((request) => request.body)).toEqual([
        { name: 'User 1' },
        { name: 'User 2' },
        { name: 'User 3' },
      ]);

      ref.destroy();
      expect(legacy.liveQueries()).toEqual([]);

      c.destroy();
      legacy.destroy();
    });
  });

  describe('poll() inside queryComputed', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    const setup = () => {
      const s = scenario();
      const legacy = createLegacyClient(s, kind);
      s.api.on('GET', '/users/:id', ({ params }) => ({
        body: { id: params['id'], name: `User ${params['id']}` },
        delay: 50,
      }));

      const id = signal('1');
      const stop = new Subject<void>();
      const c = s.consumer([
        { provide: GET_USER, useValue: legacy.get<GetUserArgs>((p) => `/users/${p.id}`) },
        { provide: USER_ID, useValue: id },
        { provide: STOP_POLLING, useValue: stop },
      ]);
      const ref = s.mount(PollingUserHost, c.injector);

      return { s, legacy, id, stop, c, ref };
    };

    it('polls on one interval and stops the old poll when the args change', () => {
      const { s, legacy, id, c, ref } = setup();

      s.tick(3500);
      expect(s.api.requestCount('GET', '/users/1')).toBe(4);

      for (const [index, next] of ['2', '3', '4'].entries()) {
        const previous = index === 0 ? '1' : ['2', '3', '4'][index - 1];
        const previousCount = s.api.requestCount('GET', `/users/${previous}`);

        id.set(next);
        s.tick(2500);

        expect(s.api.requestCount('GET', `/users/${previous}`)).toBe(previousCount);
        expect(s.api.requestCount('GET', `/users/${next}`)).toBe(3);
        expect(ref.instance.query()?.isPolling).toBe(true);
      }

      const polled = legacy.prepared().filter((query) => query.isPolling);
      expect(polled).toEqual([ref.instance.query()]);

      ref.destroy();

      const total = s.api.requests.length;
      s.tick(5000);
      expect(s.api.requests.length).toBe(total);
      expect(legacy.prepared().filter((query) => query.isPolling)).toEqual([]);

      c.destroy();
      legacy.destroy();
    });

    it('stops polling when takeUntil fires', () => {
      const { s, legacy, stop, c, ref } = setup();

      s.tick(2500);
      expect(s.api.requestCount('GET', '/users/1')).toBe(3);

      stop.next();
      s.tick(5000);

      expect(s.api.requestCount('GET', '/users/1')).toBe(3);
      expect(ref.instance.query()?.isPolling).toBe(false);
      expect(ref.instance.query()?.rawState).toMatchObject({ type: QueryStateType.Success, response: { id: '1' } });

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });
  });
});
