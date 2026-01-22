import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AnyBearerAuthProvider } from '../auth';
import { AnyQuerySnapshot, QueryArgs } from './query';
import { QueryDependencies } from './query-dependencies';
import { QueryState } from './query-state';
import { createSecureExecuteFactory } from './secure-query-execute-factory';

describe('createSecureExecuteFactory', () => {
  let mockAuthProvider: AnyBearerAuthProvider;
  let mockDeps: QueryDependencies;
  let mockState: QueryState<QueryArgs>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    mockAuthProvider = {
      accessToken: signal('test-token'),
      refreshToken: signal('refresh-token'),
      latestExecutedQuery: signal(null),
      afterTokenRefresh$: new Subject<void>(),
    } as unknown as AnyBearerAuthProvider;

    mockDeps = {
      effectScheduler: { flush: vi.fn() },
      injector: TestBed.inject(Injector),
    } as unknown as QueryDependencies;

    mockState = {
      args: signal(null),
      loading: signal(null),
      error: signal(null),
      rawResponse: signal(null),
      latestHttpEvent: signal(null),
    } as unknown as QueryState<QueryArgs>;
  });

  it('should create an execute function', () => {
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
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
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    expect(exec['currentRepositoryKey']).toBeTruthy();
  });

  it('should inject bearer token in Authorization header', () => {
    const mockQuery = {
      response: () => ({}),
      error: () => null,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: transformSpy,
    });

    TestBed.runInInjectionContext(() => {
      exec({ args: { headers: new HttpHeaders() } });
    });

    expect(transformSpy).toHaveBeenCalled();
    const callArgs = transformSpy.mock.calls[0];
    const headers = callArgs?.[2] as HttpHeaders;
    expect(headers?.get('Authorization')).toBe('Bearer test-token');
  });

  it('should pass executeState to transformAuthAndExec', () => {
    const mockQuery = {
      response: () => ({}),
      error: () => null,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: transformSpy,
    });

    TestBed.runInInjectionContext(() => {
      exec({ args: {} });
    });

    expect(transformSpy).toHaveBeenCalled();
    const callArgs = transformSpy.mock.calls[0];
    const executeState = callArgs?.[3];
    expect(executeState).toBeTruthy();
    expect(executeState?.previousKey).toBeTruthy();
  });

  it('should throw error if tokens are not available', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuthProvider.accessToken as any) = signal(null);

    const mockQuery = {
      response: () => ({}),
      error: () => null,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    TestBed.runInInjectionContext(() => {
      expect(() => exec({})).toThrow('Tokens are not available inside authAndExec');
    });
  });

  it('should set loading state when auth query is pending', () => {
    const mockQuery = {
      response: () => null,
      error: () => null,
      loading: () => true,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(true),
    } as unknown as AnyQuerySnapshot;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider as AnyBearerAuthProvider,
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

      (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        // First execution
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // Simulate 401 error
        mockState.error.set({ code: 401, message: 'Unauthorized' } as any);

        // Trigger token refresh
        (mockAuthProvider.afterTokenRefresh$ as Subject<void>).next();

        // Should have re-executed
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

      (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        // First execution
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // Simulate non-401 error
        mockState.error.set({ code: 500, message: 'Server Error' } as any);

        // Trigger token refresh
        (mockAuthProvider.afterTokenRefresh$ as Subject<void>).next();

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

      (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
        deps: mockDeps,
        state: mockState,
        transformAuthAndExec: transformSpy,
      });

      TestBed.runInInjectionContext(() => {
        // First execution
        exec({});
        expect(transformSpy).toHaveBeenCalledTimes(1);

        // Simulate 401 error
        mockState.error.set({ code: 401, message: 'Unauthorized' } as any);

        // Trigger token refresh - should retry once
        (mockAuthProvider.afterTokenRefresh$ as Subject<void>).next();
        expect(transformSpy).toHaveBeenCalledTimes(2);

        // Clear error for second refresh
        mockState.error.set(null);

        // Second token refresh - should NOT retry because take(1) completed
        (mockAuthProvider.afterTokenRefresh$ as Subject<void>).next();
        expect(transformSpy).toHaveBeenCalledTimes(2);
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

      (mockAuthProvider.latestExecutedQuery as any) = signal({ key: 'test', snapshot: mockQuery });

      const transformSpy = vi.fn();
      const exec = createSecureExecuteFactory({
        authProvider: mockAuthProvider as AnyBearerAuthProvider,
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
});
