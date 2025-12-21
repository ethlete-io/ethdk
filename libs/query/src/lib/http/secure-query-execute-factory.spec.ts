import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, signal, Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AnyQuerySnapshot, QueryArgs } from './query';
import { QueryDependencies } from './query-dependencies';
import { QueryState } from './query-state';
import { BearerAuthProvider, createSecureExecuteFactory } from './secure-query-execute-factory';

describe('createSecureExecuteFactory', () => {
  let mockAuthProvider: BearerAuthProvider;
  let mockDeps: QueryDependencies;
  let mockState: QueryState<QueryArgs>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    mockAuthProvider = {
      tokens: () => ({ accessToken: 'test-token' }),
      latestExecutedQuery: signal(null) as Signal<AnyQuerySnapshot | null>,
    };

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
      authProvider: mockAuthProvider,
      deps: mockDeps,
      state: mockState,
      transformAuthAndExec: vi.fn(),
    });

    expect(exec['reset']).toBeTruthy();
    expect(typeof exec['reset']).toBe('function');
  });

  it('should have currentRepositoryKey property', () => {
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
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

    mockAuthProvider.latestExecutedQuery = signal(mockQuery) as Signal<AnyQuerySnapshot | null>;

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
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

    mockAuthProvider.latestExecutedQuery = signal(mockQuery) as Signal<AnyQuerySnapshot | null>;

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
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
    mockAuthProvider.tokens = () => null;

    const mockQuery = {
      response: () => ({}),
      error: () => null,
      loading: () => false,
      lastTimeExecutedAt: () => Date.now(),
      isAlive: signal(false),
    } as unknown as AnyQuerySnapshot;

    mockAuthProvider.latestExecutedQuery = signal(mockQuery) as Signal<AnyQuerySnapshot | null>;

    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
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

    mockAuthProvider.latestExecutedQuery = signal(mockQuery) as Signal<AnyQuerySnapshot | null>;

    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
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

    mockAuthProvider.latestExecutedQuery = signal(mockQuery) as Signal<AnyQuerySnapshot | null>;

    const transformSpy = vi.fn();
    const exec = createSecureExecuteFactory({
      authProvider: mockAuthProvider,
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
});
