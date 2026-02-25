import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  ErrorHandler,
  signal,
  ɵEffectScheduler,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QuerySnapshot } from './query';
import { createQueryClient, QueryClientRef } from './query-client';
import { createQueryContext } from './query-context';
import { QueryDependencies } from './query-dependencies';
import { createQuerySnapshotFn } from './query-snapshot';
import { QueryState, setupQueryState } from './query-state';

type MyQueryArgs = {
  response: { foo: boolean };
};

describe('createQuerySnapshotFn', () => {
  let snapshotFn: () => QuerySnapshot<MyQueryArgs>;
  let state: QueryState<MyQueryArgs>;
  let client: QueryClientRef;
  let deps: QueryDependencies;

  const expectStateToMatchSnapshot = (state: QueryState<MyQueryArgs>, snapshot: QuerySnapshot<MyQueryArgs>) => {
    expect(state.args()).toEqual(snapshot.args());
    expect(state.error()).toEqual(snapshot.error());
    expect(state.lastTimeExecutedAt()).toEqual(snapshot.lastTimeExecutedAt());
    expect(state.latestHttpEvent()).toEqual(snapshot.latestHttpEvent());
    expect(state.loading()).toEqual(snapshot.loading());
    expect(state.response()).toEqual(snapshot.response());
  };

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });
    const [, injectClient] = client;

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    // Create fresh environment injector and deps after reset
    const environmentInjector = TestBed.inject(EnvironmentInjector);
    const envInjector = createEnvironmentInjector([], environmentInjector);

    deps = {
      destroyRef: envInjector.get(DestroyRef),
      scopeDestroyRef: TestBed.inject(DestroyRef),
      client: TestBed.runInInjectionContext(() => injectClient()),
      injector: envInjector,
      effectScheduler: TestBed.inject(ɵEffectScheduler),
      ngErrorHandler: TestBed.inject(ErrorHandler),
      httpClient: TestBed.inject(HttpClient),
    };

    const [provideQueryContext] = createQueryContext({ deps });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ...provideQueryContext()],
    });

    // Create new environment injector from the reset TestBed
    const newEnvironmentInjector = TestBed.inject(EnvironmentInjector);
    const newEnvInjector = createEnvironmentInjector([], newEnvironmentInjector);

    // Update deps with new injector
    deps.injector = newEnvInjector;
    deps.destroyRef = newEnvInjector.get(DestroyRef);
    deps.scopeDestroyRef = TestBed.inject(DestroyRef);
    deps.effectScheduler = TestBed.inject(ɵEffectScheduler);
    deps.ngErrorHandler = TestBed.inject(ErrorHandler);
    deps.httpClient = TestBed.inject(HttpClient);

    TestBed.runInInjectionContext(() => {
      state = setupQueryState<MyQueryArgs>({});

      snapshotFn = createQuerySnapshotFn<MyQueryArgs>({
        state,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        execute: { currentRepositoryKey: signal(null) } as any,
        deps,
      });
    });
  });

  it('should create the function', () => {
    expect(snapshotFn).toBeTruthy();
  });

  it('should create the query snapshot if the function is called', () => {
    expect(snapshotFn()).toBeTruthy();
  });

  it('should be alive after creation', () => {
    const snap = snapshotFn();
    expect(snap.isAlive()).toBeTruthy();

    expectStateToMatchSnapshot(state, snap);
  });

  it('should no longer be alive after loading has ended once because a response was received', () => {
    const snap = snapshotFn();

    state.loading.set({ executeTime: Date.now(), progress: null });

    TestBed.tick();

    expect(snap.isAlive()).toBeTruthy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set(null);

    TestBed.tick();

    state.rawResponse.set({ foo: true });

    expect(snap.isAlive()).toBeTruthy();

    TestBed.tick();

    expect(snap.isAlive()).toBeFalsy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set({ executeTime: Date.now(), progress: null });

    TestBed.tick();

    expect(snap.isAlive()).toBeFalsy();
    expect(snap.loading()).toEqual(null);
  });

  it('should no longer be alive after loading has ended once because a error was received', () => {
    const snap = snapshotFn();

    state.loading.set({ executeTime: Date.now(), progress: null });

    TestBed.tick();

    expect(snap.isAlive()).toBeTruthy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set(null);

    TestBed.tick();

    state.error.set({
      raw: new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' }),
      isList: true,
      code: 500,
      errors: [],
      retryState: { delay: 1000, retry: true },
    });

    expect(snap.isAlive()).toBeTruthy();

    TestBed.tick();

    expect(snap.isAlive()).toBeFalsy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set({ executeTime: Date.now(), progress: null });

    TestBed.tick();

    expect(snap.isAlive()).toBeFalsy();
    expect(snap.loading()).toEqual(null);
  });

  describe('asObservable() on snapshot signals', () => {
    it('should expose asObservable on all QueryBase signals', () => {
      const snap = snapshotFn();

      expect(typeof snap.args.asObservable).toBe('function');
      expect(typeof snap.response.asObservable).toBe('function');
      expect(typeof snap.loading.asObservable).toBe('function');
      expect(typeof snap.error.asObservable).toBe('function');
      expect(typeof snap.latestHttpEvent.asObservable).toBe('function');
      expect(typeof snap.lastTimeExecutedAt.asObservable).toBe('function');
      expect(typeof snap.triggeredBy.asObservable).toBe('function');
      expect(typeof snap.isAlive.asObservable).toBe('function');
      expect(typeof snap.executionState.asObservable).toBe('function');
      expect(typeof snap.id.asObservable).toBe('function');
    });

    it('should emit loading state changes via loading.asObservable()', () => {
      const snap = snapshotFn();
      const emissions: unknown[] = [];

      snap.loading.asObservable().subscribe((v) => emissions.push(v));
      TestBed.tick();

      const loadingState = { executeTime: Date.now(), progress: null };
      state.loading.set(loadingState);
      TestBed.tick();

      expect(emissions).toEqual([null, loadingState]);
    });

    it('should emit executionState changes via executionState.asObservable()', () => {
      const snap = snapshotFn();
      const types: (string | null)[] = [];

      snap.executionState.asObservable().subscribe((s) => types.push(s?.type ?? null));
      TestBed.tick();

      state.loading.set({ executeTime: Date.now(), progress: null });
      TestBed.tick();

      expect(types).toEqual([null, 'loading']);
    });

    it('should emit final executionState as success before isAlive goes false', () => {
      const snap = snapshotFn();
      const executionTypes: (string | null)[] = [];
      const isAliveValues: boolean[] = [];

      snap.executionState.asObservable().subscribe((s) => executionTypes.push(s?.type ?? null));
      snap.isAlive.asObservable().subscribe((v) => isAliveValues.push(v));
      TestBed.tick();

      state.loading.set({ executeTime: Date.now(), progress: null });
      TestBed.tick();

      state.loading.set(null);
      TestBed.tick();

      state.rawResponse.set({ foo: true });
      TestBed.tick();

      expect(executionTypes).toContain('success');
      expect(isAliveValues).toContain(false);
    });

    it('should emit isAlive false via isAlive.asObservable() after request completes', () => {
      const snap = snapshotFn();
      const emissions: boolean[] = [];

      snap.isAlive.asObservable().subscribe((v) => emissions.push(v));
      TestBed.tick();

      state.loading.set({ executeTime: Date.now(), progress: null });
      TestBed.tick();
      state.loading.set(null);
      TestBed.tick();
      state.rawResponse.set({ foo: true });
      TestBed.tick();

      expect(emissions).toEqual([true, false]);
    });
  });
});
