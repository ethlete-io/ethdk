import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef, Injector, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { config as rxjsConfig, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AnyBearerAuthProvider } from '../auth';
import { AnyQuerySnapshot, QueryArgs } from './query';
import { QueryDependencies } from './query-dependencies';
import { QueryErrorResponse } from './query-error-response';
import { QueryRepositoryEvent } from './query-repository';
import { QueryState } from './query-state';
import { createSecureExecuteFactory } from './secure-query-execute-factory';

describe('createSecureExecuteFactory', () => {
  let mockAuthProvider: AnyBearerAuthProvider;
  let mockDeps: QueryDependencies;
  let mockState: QueryState<QueryArgs>;
  let mockLatestExecutedQuery: WritableSignal<{ key: string; snapshot: AnyQuerySnapshot } | null>;
  let mockRepositoryEvents$: Subject<QueryRepositoryEvent>;

  /** A token refresh as the provider performs one: the token is applied, then the emission follows. */
  const refreshTokenWith = (token: string) => {
    (mockAuthProvider.accessToken as unknown as WritableSignal<string | null>).set(token);
    (mockAuthProvider.afterTokenRefresh$ as Subject<void>).next();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    mockLatestExecutedQuery = signal(null);

    mockAuthProvider = {
      accessToken: signal('test-token'),
      refreshToken: signal('refresh-token'),
      latestExecutedQuery: mockLatestExecutedQuery,
      executionState: signal(null),
      afterTokenRefresh$: new Subject<void>(),
      isAccessTokenExpired: () => false,
    } as unknown as AnyBearerAuthProvider;

    mockRepositoryEvents$ = new Subject<QueryRepositoryEvent>();

    mockDeps = {
      injector: TestBed.inject(Injector),
      destroyRef: TestBed.inject(DestroyRef),
      client: { repository: { events$: mockRepositoryEvents$, unbind: vi.fn() } },
    } as unknown as QueryDependencies;

    mockState = {
      args: signal(null),
      loading: signal(null),
      error: signal(null),
      rawResponse: signal(null),
      latestHttpEvent: signal(null),
      lastTimeExecutedAt: signal(null),
      lastTriggeredBy: signal(null),
    } as unknown as QueryState<QueryArgs>;
  });

  it('should create an execute function', () => {
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    expect(exec).toBeTruthy();
    expect(typeof exec).toBe('function');
  });

  it('should have reset method', () => {
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    expect(exec['reset']).toBeTruthy();
    expect(typeof exec['reset']).toBe('function');
  });

  it('should have currentRepositoryKey property', () => {
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    expect(exec['currentRepositoryKey']).toBeTruthy();
  });

  it('should drop its state when the repository unbinds all secure entries', () => {
    mockState.rawResponse.set({ name: 'logged in user' });
    mockState.error.set({ code: 401 } as unknown as QueryErrorResponse);

    createSecureExecuteFactory({
      authProvider: mockAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    // A logout: the repository tears the secure entries down, but the response the query object
    // holds is its own - without this the logged out user stays on screen.
    mockRepositoryEvents$.next({ type: 'unbind-all-secure' });

    expect(mockState.rawResponse()).toBeNull();
    expect(mockState.error()).toBeNull();
  });

  it('should inject bearer token in Authorization header', () => {
    const mockQuery = {
      response: () => ({}),
      error: () => null,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: transformSpy,
    });

    TestBed.runInInjectionContext(() => {
      exec({ args: { headers: new HttpHeaders() } });
    });

    expect(transformSpy).toHaveBeenCalled();
    const callArgs = transformSpy.mock.calls[0];
    const headers = (callArgs?.[0]?.args?.headers as () => HttpHeaders)();
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('should pass executeState to transformAuthAndExec', () => {
    const mockQuery = {
      response: () => ({}),
      error: () => null,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: transformSpy,
    });

    TestBed.runInInjectionContext(() => {
      exec({ args: {} });
    });

    expect(transformSpy).toHaveBeenCalled();
    const callArgs = transformSpy.mock.calls[0];
    const executeState = callArgs?.[1];
    expect(executeState).toBeTruthy();
    expect(executeState?.previousKey).toBeTruthy();
  });

  it('waits for the access token instead of throwing when the auth query is done but the token is not set yet', () => {
    const accessToken = signal<string | null>(null);
    (mockAuthProvider.accessToken as unknown as ReturnType<typeof signal>) = accessToken;

    const mockQuery = {
      response: () => ({}),
      error: () => null,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: transformSpy,
    });

    TestBed.runInInjectionContext(() => {
      // Previously this threw `tokensNotAvailableInsideAuthAndExec`; the auth query already
      // has a response, but the token is populated on a separate reactive timeline.
      expect(() => exec({})).not.toThrow();
    });

    TestBed.tick();
    expect(transformSpy).not.toHaveBeenCalled();

    // Token populated a tick later (e.g. by the token-extraction effect).
    accessToken.set('late-token');
    TestBed.tick();

    expect(transformSpy).toHaveBeenCalledTimes(1);
  });

  it('should set loading state when auth query is pending', () => {
    const mockQuery = {
      response: () => null,
      error: () => null,
      loading: () => true,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(true),
    } as unknown as AnyQuerySnapshot;

    mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    TestBed.runInInjectionContext(() => {
      exec({});
    });

    expect(mockState.loading()).toBeTruthy();
    expect(mockState.loading()?.executeTime).toBeTruthy();
  });

  it('should handle auth query errors', () => {
    const mockError = { message: 'Auth failed' };
    const mockQuery = {
      response: () => null,
      error: () => mockError,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      autoExecutes: true,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: transformSpy,
    });

    TestBed.runInInjectionContext(() => {
      exec({});
    });

    expect(mockState.error()).toBe(mockError);
    expect(transformSpy).not.toHaveBeenCalled();
  });

  describe('401 Auto-Retry with Token Refresh', () => {
    it('should re-execute query when afterTokenRefresh$ emits and query had 401 error', () => {
      const mockQuery = {
        response: () => ({}),
        error: () => null,
        loading: () => false,
        lastTimeExecutedAt: () => Date.now(),
        isAlive: signal(false),
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        // First execution
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // Simulate 401 error
        mockState.error.set({ code: 401 } as unknown as QueryErrorResponse);

        // Trigger token refresh
        refreshTokenWith('new-token');

        // Should have re-executed
        expect(transformSpy).toHaveBeenCalledTimes(2);
      });
    });

    it('should NOT re-execute a 401 when the refresh left the access token unchanged', () => {
      const mockQuery = {
        response: () => ({}),
        error: () => null,
        loading: () => false,
        lastTimeExecutedAt: () => Date.now(),
        isAlive: signal(false),
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        mockState.error.set({ code: 401 } as unknown as QueryErrorResponse);

        // A refresh that hands back the very same access token - retrying would 401 again, and that
        // 401 would ask for another refresh, forever.
        refreshTokenWith('test-token');
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // The subscription is still armed, so the next refresh that does change the token retries.
        refreshTokenWith('new-token');
        expect(transformSpy).toHaveBeenCalledTimes(2);
      });
    });

    it('should NOT re-execute query when afterTokenRefresh$ emits but query had no 401 error', () => {
      const mockQuery = {
        response: () => ({}),
        error: () => null,
        loading: () => false,
        lastTimeExecutedAt: () => Date.now(),
        isAlive: signal(false),
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        // First execution
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // Simulate non-401 error
        mockState.error.set({ code: 500 } as unknown as QueryErrorResponse);

        // Trigger token refresh
        refreshTokenWith('new-token');

        // Should NOT have re-executed
        expect(transformSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('should only retry once per exec call due to take(1)', () => {
      const mockQuery = {
        response: () => ({}),
        error: () => null,
        loading: () => false,
        lastTimeExecutedAt: () => Date.now(),
        isAlive: signal(false),
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        // First execution
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // Simulate 401 error
        mockState.error.set({ code: 401 } as unknown as QueryErrorResponse);

        // Trigger token refresh - should retry once
        refreshTokenWith('new-token');
        expect(transformSpy).toHaveBeenCalledTimes(2);

        // Clear error for second refresh
        mockState.error.set(null);

        // Second token refresh - should NOT retry because take(1) completed
        refreshTokenWith('even-newer-token');
        expect(transformSpy).toHaveBeenCalledTimes(2);
      });
    });

    it('re-executes when the 401 lands after the refresh already completed', () => {
      const mockQuery = {
        response: () => ({}),
        error: () => null,
        loading: () => false,
        lastTimeExecutedAt: () => Date.now(),
        isAlive: signal(false),
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // The refresh settles while this query's request is still in flight - no error yet, so the
        // emission alone retries nothing.
        refreshTokenWith('new-token');
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // The 401 the old token earned lands afterwards - it asks for no new refresh, so the error
        // arriving is the only trigger left.
        mockState.error.set({ code: 401 } as unknown as QueryErrorResponse);
        TestBed.tick();

        expect(transformSpy).toHaveBeenCalledTimes(2);
      });
    });

    it('does not re-execute a late 401 when no refresh happened since the request went out', () => {
      const mockQuery = {
        response: () => ({}),
        error: () => null,
        loading: () => false,
        lastTimeExecutedAt: () => Date.now(),
        isAlive: signal(false),
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        mockState.error.set({ code: 401 } as unknown as QueryErrorResponse);
        TestBed.tick();

        expect(transformSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('should pass header provider function to transformAuthAndExec', () => {
      const mockQuery = {
        response: () => ({}),
        error: () => null,
        loading: () => false,
        lastTimeExecutedAt: () => Date.now(),
        isAlive: signal(false),
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({ args: { headers: new HttpHeaders({ 'X-Custom': 'value' }) } });
      });

      expect(transformSpy).toHaveBeenCalled();
      const callArgs = transformSpy.mock.calls[0];
      const executeArgs = callArgs?.[0];

      // Should receive a function, not HttpHeaders
      expect(typeof executeArgs?.args?.headers).toBe('function');

      // Calling the function should return HttpHeaders with auth token
      const headers = executeArgs?.args?.headers();
      expect(headers).toBeInstanceOf(HttpHeaders);
      expect(headers?.get('Authorization')).toBe('Bearer test-token');
      expect(headers?.get('X-Custom')).toBe('value');
    });
  });

  /**
   * Regression coverage for the auth provider edge case with two query clients ("main" + "external"):
   *
   * - The auth/login query is a SECURE query (it lives on another client and needs that client's
   *   token to run). Its completion is driven through several nested toObservable/effect layers.
   * - The access token is only populated by a SEPARATE Angular `effect` in
   *   `setupBearerQueryRegistry` that reads the login response and calls `setTokens`.
   *
   * Previously `exec` called `authAndExec` purely because the auth query was "done"
   * (`isAlive` -> false / `response()` present), racing the token: when the response became
   * observable before the token-extraction effect had run, `authAndExec` threw
   * `tokensNotAvailableInsideAuthAndExec` and never recovered.
   *
   * The fix gates `authAndExec` on `accessToken()` itself, so it waits for the token instead.
   */
  describe('Effect race condition: token populated after the auth query completes', () => {
    it('does not fire authAndExec prematurely and proceeds once the token is populated (in-flight auth query)', async () => {
      const accessToken = signal<string | null>(null);
      (mockAuthProvider.accessToken as unknown as ReturnType<typeof signal>) = accessToken;

      // Login query is in-flight when the secure query executes (the common case).
      const response = signal<unknown>(null);
      const loading = signal(true);
      const isAlive = signal(true);

      const authQuery = {
        response: () => response(),
        error: () => null,
        loading: () => loading(),
        lastTimeExecutedAt: () => null,
        isAlive,
      } as unknown as AnyQuerySnapshot;

      mockLatestExecutedQuery.set({ key: 'login', snapshot: authQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      // A premature authAndExec would throw inside the wait subscription; RxJS reports such
      // errors asynchronously via this hook, so we can assert none occurred.
      const unhandled: unknown[] = [];
      const originalOnUnhandledError = rxjsConfig.onUnhandledError;
      rxjsConfig.onUnhandledError = (err) => unhandled.push(err);

      try {
        TestBed.runInInjectionContext(() => {
          exec({});
        });

        TestBed.tick();
        // Still waiting on the in-flight login query.
        expect(transformSpy).not.toHaveBeenCalled();

        // The login query resolves: response is observable and the query dies.
        // BUT the token-extraction effect has NOT run yet -> accessToken still null.
        response.set({ accessToken: 'tok', refreshToken: 'ref' });
        loading.set(false);
        isAlive.set(false);
        TestBed.tick();
        await new Promise((resolve) => setTimeout(resolve, 1));

        // It must NOT have fired authAndExec on completion alone -> no thrown error.
        expect(transformSpy).not.toHaveBeenCalled();
        expect(unhandled).toHaveLength(0);

        // The token-extraction effect runs one tick later and sets the token...
        accessToken.set('tok');
        TestBed.tick();

        // ...and now the secure query proceeds with the available token.
        expect(transformSpy).toHaveBeenCalledTimes(1);
      } finally {
        rxjsConfig.onUnhandledError = originalOnUnhandledError;
      }
    });
  });

  /**
   * Regression coverage for `setTokens()` (SSO/OIDC callbacks, native shells): it seeds tokens
   * without ever running a query, so `latestExecutedQuery` stays `null` forever on that path.
   * Gating solely on `latestExecutedQuery` left every secure query waiting indefinitely.
   */
  describe('Token seed (setTokens())', () => {
    it('executes immediately when executionState is already a successful token seed', () => {
      const executionState = signal<{ type: string; state: string } | null>({
        type: 'tokenSeed',
        state: 'success',
      });
      (mockAuthProvider.executionState as unknown as ReturnType<typeof signal>) = executionState;

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
      });

      expect(transformSpy).toHaveBeenCalledTimes(1);
    });

    it('wakes a query that is waiting on no auth query at all once executionState becomes a token seed', () => {
      const executionState = signal<{ type: string; state: string } | null>(null);
      (mockAuthProvider.executionState as unknown as ReturnType<typeof signal>) = executionState;

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
      });

      TestBed.tick();
      expect(transformSpy).not.toHaveBeenCalled();

      // The SSO/OIDC redirect resolves and seeds tokens outside the query registry.
      executionState.set({ type: 'tokenSeed', state: 'success' });
      TestBed.tick();

      expect(transformSpy).toHaveBeenCalledTimes(1);
    });

    it('does not treat a stale logout state as a token seed', () => {
      const executionState = signal<{ type: string; state: string } | null>({
        type: 'logout',
        state: 'success',
      });
      (mockAuthProvider.executionState as unknown as ReturnType<typeof signal>) = executionState;

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
      });
      TestBed.tick();

      expect(transformSpy).not.toHaveBeenCalled();
    });
  });

  /**
   * Regression coverage for a logout that does not end the page load: it unbinds every secure entry
   * in the repository, but a self-executing query only ever runs once, at creation - so without a
   * restart anything still mounted across it (an app shell's `/user/me`) stays idle for good, even
   * after the user logs back in.
   */
  describe('Session restart after a logout', () => {
    const signIn = () => {
      mockLatestExecutedQuery.set({
        key: 'test',
        snapshot: {
          response: () => ({}),
          error: () => null,
          loading: () => false,
          lastTimeExecutedAt: () => Date.now(),
          isAlive: signal(false),
        } as unknown as AnyQuerySnapshot,
      });
    };

    const logout = (accessToken: WritableSignal<string | null>) => {
      accessToken.set(null);
      mockRepositoryEvents$.next({ type: 'unbind-all-secure' });
      mockLatestExecutedQuery.set(null);
    };

    beforeEach(() => signIn());

    it('re-runs a self-executing query once the next session starts', () => {
      const accessToken = mockAuthProvider.accessToken as WritableSignal<string | null>;
      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
      });
      expect(transformSpy).toHaveBeenCalledTimes(1);

      logout(accessToken);
      TestBed.tick();
      expect(transformSpy).toHaveBeenCalledTimes(1);

      signIn();
      accessToken.set('next-session-token');
      TestBed.tick();

      expect(transformSpy).toHaveBeenCalledTimes(2);
    });

    it('leaves a manually executed query alone', () => {
      const accessToken = mockAuthProvider.accessToken as WritableSignal<string | null>;
      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider,
        autoExecutes: false,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        exec({});
      });
      expect(transformSpy).toHaveBeenCalledTimes(1);

      logout(accessToken);
      TestBed.tick();

      signIn();
      accessToken.set('next-session-token');
      TestBed.tick();

      expect(transformSpy).toHaveBeenCalledTimes(1);
    });

    it('leaves a query that never ran alone', () => {
      const accessToken = mockAuthProvider.accessToken as WritableSignal<string | null>;
      const transformSpy = vi.fn();

      createSecureExecuteFactory({
        authProvider: mockAuthProvider,
        autoExecutes: true,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      logout(accessToken);
      TestBed.tick();

      signIn();
      accessToken.set('next-session-token');
      TestBed.tick();

      expect(transformSpy).not.toHaveBeenCalled();
    });
  });
});
