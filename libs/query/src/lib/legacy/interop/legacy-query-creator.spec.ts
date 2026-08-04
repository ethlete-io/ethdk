import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, createEnvironmentInjector, EnvironmentInjector, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, NEVER } from 'rxjs';
import { createQueryClient, createQueryCreator, QueryClientRef, QueryRuntimeErrorCode } from '../../http';
import { EntityStore } from '../entity';
import { filterSuccess, QueryStateType } from '../query';
import { createLegacyQueryCreator } from './legacy-query-creator';

type Person = { id: number; name: string };

describe('LegacyQueryCreator.prepare', () => {
  let client: QueryClientRef;
  let httpTesting: HttpTestingController;

  const makeCreator = () =>
    createLegacyQueryCreator({
      name: 'legacyGetPerson',
      creator: createQueryCreator(undefined, { client, method: 'GET', route: '/person' }),
    });

  const makeMutationCreator = () =>
    createLegacyQueryCreator({
      name: 'legacyPostReport',
      creator: createQueryCreator(undefined, { client, method: 'POST', route: '/report' }),
    });

  /** Whether the query is still alive: `state$` completes when the query's injector is destroyed. */
  const trackAlive = (query: { state$: { subscribe: (observer: { complete: () => void }) => void } }) => {
    const alive = { current: true };

    query.state$.subscribe({ complete: () => (alive.current = false) });

    return alive;
  };

  const stable = () => TestBed.inject(ApplicationRef).whenStable();

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'legacy-test' });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('prepares a working query inside an injection context', () => {
    const query = TestBed.runInInjectionContext(() => makeCreator().prepare({}));

    query.execute();

    httpTesting.expectOne('https://api.example.com/person').flush({ id: 1 });
    expect(query.rawState.type).toBe(QueryStateType.Success);
  });

  it('calls onSuccess for a mutation answered with 204 no content', async () => {
    const query = TestBed.runInInjectionContext(() => makeMutationCreator().prepare({}));

    query.execute();

    let onSuccessCalls = 0;
    query.onSuccess(() => onSuccessCalls++);

    httpTesting.expectOne('https://api.example.com/report').flush(null, { status: 204, statusText: 'No Content' });
    await stable();

    expect(query.rawState.type).toBe(QueryStateType.Success);
    expect(onSuccessCalls).toBe(1);
  });

  it('throws a named error instead of NG0203 when called without an injection context', () => {
    const creator = makeCreator();

    expect(() => creator.prepare({})).toThrowError(
      new RegExp(`ET${QueryRuntimeErrorCode.LEGACY_PREPARE_WITHOUT_INJECTION_CONTEXT}.*legacyGetPerson`, 's'),
    );
  });

  it('names the endpoint when the creator has no name', () => {
    const creator = createLegacyQueryCreator({
      creator: createQueryCreator(undefined, { client, method: 'GET', route: '/person' }),
    });

    expect(() => creator.prepare({})).toThrowError(/GET \/person/);
  });

  describe('request args', () => {
    it.each([0, '', false, null])('sends a falsy body (%o) instead of dropping it', (body) => {
      const creator = createLegacyQueryCreator({
        creator: createQueryCreator<{ response: unknown; body: unknown }>(undefined, {
          client,
          method: 'POST',
          route: '/report',
        }),
      });

      const query = TestBed.runInInjectionContext(() => creator.prepare({ body }));

      query.execute();

      expect(httpTesting.expectOne('https://api.example.com/report').request.body).toBe(body);
    });

    it('sends an empty header value instead of dropping it', () => {
      const query = TestBed.runInInjectionContext(() => makeCreator().prepare({ headers: { 'x-trace': '' } }));

      query.execute();

      expect(httpTesting.expectOne('https://api.example.com/person').request.headers.get('x-trace')).toBe('');
    });
  });

  describe('destroyOnResponse', () => {
    const prepareSelfDestroying = () =>
      TestBed.runInInjectionContext(() => makeCreator().prepare({ config: { destroyOnResponse: true } }));

    it('destroys the query once it succeeds', async () => {
      const query = prepareSelfDestroying();
      const alive = trackAlive(query);

      query.execute();
      httpTesting.expectOne('https://api.example.com/person').flush({ id: 1 });
      await stable();

      expect(alive.current).toBe(false);
    });

    it('destroys the query once it fails', async () => {
      const query = prepareSelfDestroying();
      const alive = trackAlive(query);

      query.execute();
      httpTesting.expectOne('https://api.example.com/person').flush(null, { status: 500, statusText: 'Boom' });
      await stable();

      expect(alive.current).toBe(false);
    });

    it('calls onSuccess before destroying the query', async () => {
      const creator = createLegacyQueryCreator({
        name: 'legacyPostResolveUpdated',
        creator: createQueryCreator(undefined, { client, method: 'POST', route: '/resolve-updated' }),
      });
      const query = TestBed.runInInjectionContext(() => creator.prepare({ config: { destroyOnResponse: true } }));

      query.execute();

      let onSuccessCalls = 0;
      query.onSuccess(() => onSuccessCalls++);

      httpTesting
        .expectOne('https://api.example.com/resolve-updated')
        .flush(null, { status: 204, statusText: 'No Content' });
      await stable();

      expect(onSuccessCalls).toBe(1);
    });

    it('leaves a query that was only prepared alone', async () => {
      const query = prepareSelfDestroying();
      const alive = trackAlive(query);

      await stable();

      expect(alive.current).toBe(true);
      httpTesting.verify();
    });

    it('still destroys the query after an aborted execution', async () => {
      const query = prepareSelfDestroying();
      const alive = trackAlive(query);

      query.execute();
      query.abort();
      await stable();

      // `abort()` resets the state, so no terminal state ever arrived - the query has to stay alive and
      // keep watching, rather than being stranded with an effect that can no longer fire.
      expect(alive.current).toBe(true);

      query.execute();
      httpTesting.match('https://api.example.com/person').at(-1)?.flush({ id: 1 });
      await stable();

      expect(alive.current).toBe(false);
    });
  });

  describe('entity store', () => {
    let store: EntityStore<Person>;
    let responsesSeen: Person[];

    const makeEntityCreator = (options: { withGet?: boolean } = {}) =>
      createLegacyQueryCreator({
        name: 'legacyGetPerson',
        creator: createQueryCreator<{ response: Person }>(undefined, { client, method: 'GET', route: '/person' }),
        entity: {
          store,
          id: ({ response }) => {
            responsesSeen.push(response);

            return response.id;
          },
          set: ({ store: entityStore, id, response }) => entityStore.set(id, response),
          ...(options.withGet ? { get: ({ store: entityStore, id }) => entityStore.select(id) } : {}),
        },
      });

    beforeEach(() => {
      store = new EntityStore<Person>({ name: 'person' });
      responsesSeen = [];
    });

    it('does not run the entity config before a response arrives', async () => {
      // `id` and `set` are typed non-nullable, so this asserts more than "nothing was stored": calling
      // them at all on a fresh query hands a `null` response to a contract that promises otherwise.
      TestBed.runInInjectionContext(() => makeEntityCreator().prepare({}));
      await stable();

      expect(responsesSeen).toEqual([]);
      expect(store._dictionary.size).toBe(0);
    });

    it('writes the response to the store on success', async () => {
      const query = TestBed.runInInjectionContext(() => makeEntityCreator().prepare({}));

      query.execute();
      httpTesting.expectOne('https://api.example.com/person').flush({ id: 1, name: 'Ada' });
      await stable();

      expect(store._dictionary.get(1)).toEqual({ id: 1, name: 'Ada' });
    });

    it('does not overwrite a stored entity when a re-execution fails', async () => {
      const query = TestBed.runInInjectionContext(() => makeEntityCreator().prepare({}));

      query.execute();
      httpTesting.expectOne('https://api.example.com/person').flush({ id: 1, name: 'Ada' });
      await stable();

      responsesSeen = [];

      query.execute({ skipCache: true });
      httpTesting.match('https://api.example.com/person').at(-1)?.flush(null, { status: 500, statusText: 'Boom' });
      await stable();

      expect(responsesSeen).toEqual([]);
      expect(store._dictionary.get(1)).toEqual({ id: 1, name: 'Ada' });
    });

    it('still syncs a success whose body is empty', async () => {
      const creator = createLegacyQueryCreator({
        creator: createQueryCreator<{ response: Person }>(undefined, { client, method: 'POST', route: '/person' }),
        entity: { store, id: () => 7, set: ({ store: entityStore, id, response }) => entityStore.set(id, response) },
      });

      const query = TestBed.runInInjectionContext(() => creator.prepare({}));

      query.execute();
      httpTesting.expectOne('https://api.example.com/person').flush(null, { status: 204, statusText: 'No Content' });
      await stable();

      // A 204 is a success with a null body, which is exactly what the fix for the null-response write
      // must not swallow: gating on `response !== null` would have stopped syncing here.
      expect(store._dictionary.has(7)).toBe(true);
    });

    it('reads the response back through the store', async () => {
      const query = TestBed.runInInjectionContext(() => makeEntityCreator({ withGet: true }).prepare({}));
      const success = firstValueFrom(query.state$.pipe(filterSuccess()));

      query.execute();
      httpTesting.expectOne('https://api.example.com/person').flush({ id: 1, name: 'Ada' });

      store.set(1, { id: 1, name: 'Ada Lovelace' });

      await expect(success).resolves.toMatchObject({ response: { name: 'Ada Lovelace' } });
    });
  });

  describe('canBeCached', () => {
    it('follows the underlying method', () => {
      const query = TestBed.runInInjectionContext(() => makeCreator().prepare({}));
      const mutation = TestBed.runInInjectionContext(() => makeMutationCreator().prepare({}));

      expect(query.canBeCached).toBe(true);
      expect(mutation.canBeCached).toBe(false);
    });

    it('follows an explicit useQueryRepositoryCache over the method', () => {
      const cachedMutation = createLegacyQueryCreator({
        creator: createQueryCreator(
          { subtle: { useQueryRepositoryCache: true } },
          { client, method: 'POST', route: '/report' },
        ),
      });
      const uncachedGet = createLegacyQueryCreator({
        creator: createQueryCreator(
          { subtle: { useQueryRepositoryCache: false } },
          { client, method: 'GET', route: '/person' },
        ),
      });

      expect(TestBed.runInInjectionContext(() => cachedMutation.prepare({})).canBeCached).toBe(true);
      expect(TestBed.runInInjectionContext(() => uncachedGet.prepare({})).canBeCached).toBe(false);
    });

    it('re-enables the container cleanup defaults it used to make unreachable', () => {
      const creator = makeCreator();
      const injector = TestBed.inject(Injector);
      const subject = creator.createSubject(null, { injector });

      const first = creator.prepare({ injector });

      subject.next(first);
      first.poll({ interval: 10_000, takeUntil: NEVER });
      expect(first.isPolling).toBe(true);

      first.execute();
      subject.next(creator.prepare({ injector }));

      // `cleanQuery` gates both branches on `canBeCached`, so with the old hardcoded `false` a superseded
      // cacheable query kept polling and was never aborted.
      expect(first.isPolling).toBe(false);
      expect(first.rawState.type).toBe(QueryStateType.Prepared);
    });
  });

  describe('containers', () => {
    it('builds one outside an injection context when given an injector', () => {
      const creator = makeCreator();
      const injector = TestBed.inject(Injector);

      expect(creator.createSubject(null, { injector }).getValue()).toBeNull();
      expect(creator.createSignal(null, { injector })()).toBeNull();
      expect(creator.behaviorSubject(null, { injector }).getValue()).toBeNull();
    });

    it('throws a named error naming the entry point when built without an injector and without a context', () => {
      const creator = makeCreator();
      const et950 = `ET${QueryRuntimeErrorCode.LEGACY_PREPARE_WITHOUT_INJECTION_CONTEXT}`;

      expect(() => creator.createSubject()).toThrowError(
        new RegExp(`${et950}.*legacyGetPerson.*createSubject\\(\\)`, 's'),
      );
      expect(() => creator.createSignal()).toThrowError(
        new RegExp(`${et950}.*legacyGetPerson.*createSignal\\(\\)`, 's'),
      );
      expect(() => creator.behaviorSubject()).toThrowError(new RegExp(et950));
    });

    it('destroys a superseded query pushed into the container', async () => {
      const creator = makeCreator();
      const injector = TestBed.inject(Injector);
      const subject = creator.createSubject(null, { injector });

      const first = creator.prepare({ injector });
      const alive = trackAlive(first);

      subject.next(first);
      subject.next(creator.prepare({ injector }));
      await stable();

      expect(alive.current).toBe(false);
    });
  });

  describe('with a destroyed injector', () => {
    let injector: EnvironmentInjector;

    beforeEach(() => {
      injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
      injector.destroy();
    });

    it('returns an inert query rather than throwing NG0205', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
        // silence the dev-mode hint
      });

      const query = makeCreator().prepare({ injector });

      expect(query.rawState.type).toBe(QueryStateType.Prepared);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('legacyGetPerson'));

      warn.mockRestore();
    });

    it('does nothing when the inert query is used', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {
        // silence the dev-mode hint
      });

      const query = makeCreator().prepare({ injector });

      expect(() => {
        query.execute();
        query.abort();
        query.poll({ interval: 10, takeUntil: NEVER });
        query.stopPolling();
        query.destroy();
      }).not.toThrow();

      expect(query.isPolling).toBe(false);
      httpTesting.verify();

      vi.mocked(console.warn).mockRestore();
    });

    it('completes its state stream immediately', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {
        // silence the dev-mode hint
      });

      const states = await new Promise<unknown[]>((resolve) => {
        const seen: unknown[] = [];
        makeCreator()
          .prepare({ injector })
          .state$.subscribe({ next: (state) => seen.push(state), complete: () => resolve(seen) });
      });

      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({ type: QueryStateType.Prepared });

      vi.mocked(console.warn).mockRestore();
    });
  });
});
