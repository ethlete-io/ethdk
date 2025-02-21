import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { createEnvironmentInjector, DestroyRef, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QuerySnapshot } from './query';
import { provideQueryClient } from './query-client';
import { createQueryClientConfig, QueryClientConfig } from './query-client-config';
import { createQuerySnapshotFn } from './query-snapshot';
import { QueryState, setupQueryState } from './query-state';

type MyQueryArgs = {
  response: { foo: boolean };
};

describe('createQuerySnapshotFn', () => {
  let snapshotFn: () => QuerySnapshot<MyQueryArgs>;
  let state: QueryState<MyQueryArgs>;
  let queryClientRef: QueryClientConfig;

  const expectStateToMatchSnapshot = (state: QueryState<MyQueryArgs>, snapshot: QuerySnapshot<MyQueryArgs>) => {
    expect(state.args()).toEqual(snapshot.args());
    expect(state.error()).toEqual(snapshot.error());
    expect(state.lastTimeExecutedAt()).toEqual(snapshot.lastTimeExecutedAt());
    expect(state.latestHttpEvent()).toEqual(snapshot.latestHttpEvent());
    expect(state.loading()).toEqual(snapshot.loading());
    expect(state.response()).toEqual(snapshot.response());
  };

  beforeEach(() => {
    queryClientRef = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideQueryClient(queryClientRef)],
    });

    const environmentInjector = TestBed.inject(EnvironmentInjector);
    const envInjector = createEnvironmentInjector([], environmentInjector);

    state = setupQueryState<MyQueryArgs>({});
    snapshotFn = createQuerySnapshotFn<MyQueryArgs>({
      state,
      deps: {
        client: TestBed.inject(queryClientRef.token),
        destroyRef: envInjector.get(DestroyRef),
        injector: envInjector,
        scopeDestroyRef: TestBed.inject(DestroyRef),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: jest.fn() as any,
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

    TestBed.flushEffects();

    expect(snap.isAlive()).toBeTruthy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set(null);

    TestBed.flushEffects();

    state.response.set({ foo: true });

    expect(snap.isAlive()).toBeTruthy();

    TestBed.flushEffects();

    expect(snap.isAlive()).toBeFalsy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set({ executeTime: Date.now(), progress: null });

    TestBed.flushEffects();

    expect(snap.isAlive()).toBeFalsy();
    expect(snap.loading()).toEqual(null);
  });

  it('should no longer be alive after loading has ended once because a error was received', () => {
    const snap = snapshotFn();

    state.loading.set({ executeTime: Date.now(), progress: null });

    TestBed.flushEffects();

    expect(snap.isAlive()).toBeTruthy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set(null);

    TestBed.flushEffects();

    state.error.set({
      raw: new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' }),
      isList: true,
      code: 500,
      errors: [],
      retryState: { delay: 1000, retry: true },
    });

    expect(snap.isAlive()).toBeTruthy();

    TestBed.flushEffects();

    expect(snap.isAlive()).toBeFalsy();
    expectStateToMatchSnapshot(state, snap);

    state.loading.set({ executeTime: Date.now(), progress: null });

    TestBed.flushEffects();

    expect(snap.isAlive()).toBeFalsy();
    expect(snap.loading()).toEqual(null);
  });
});
