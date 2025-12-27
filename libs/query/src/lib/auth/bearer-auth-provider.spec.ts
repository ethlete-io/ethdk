import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createPostQuery, createQueryClient, QueryClientRef } from '../http';
import { createBearerAuthProvider } from './bearer-auth-provider';
import { withAuthenticationQuery, withRefreshQuery } from './bearer-auth-query-builders';

describe('createBearerAuthProvider', () => {
  let queryClientRef: QueryClientRef;

  beforeEach(() => {
    queryClientRef = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('should create a bearer auth provider tuple', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');

    const authProvider = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
      queries: [
        withAuthenticationQuery('login', {
          queryCreator: login,
          extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
        }),
      ],
    });

    expect(authProvider).toBeTruthy();
    expect(Array.isArray(authProvider)).toBe(true);
    expect(authProvider.length).toBe(3);
  });

  it('should provide inject function in tuple', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');

    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
      queries: [
        withAuthenticationQuery('login', {
          queryCreator: login,
          extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
        }),
      ],
    });

    expect(typeof injectAuthProvider).toBe('function');

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(provider).toBeTruthy();
      expect(provider.queries.login).toBeDefined();
      expect(provider.logout).toBeDefined();
      expect(provider.accessToken).toBeDefined();
      expect(provider.bearerData).toBeDefined();
    });
  });

  it('should provide injection token in tuple', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');

    const [, , token] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
      queries: [
        withAuthenticationQuery('login', {
          queryCreator: login,
          extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
        }),
      ],
    });

    expect(token).toBeTruthy();
  });

  it('should create provider with default configuration', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');

    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
      queries: [
        withAuthenticationQuery('login', {
          queryCreator: login,
          extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
        }),
      ],
    });

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(provider.latestExecutedQuery()).toBeNull();
      expect(provider.accessToken()).toBeNull();
      expect(provider.bearerData()).toBeNull();
    });
  });

  it('should provide queries registry', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');
    const tokenRefresh = postQuery<{
      body: { refresh_token: string };
      response: { token: string; refresh_token: string };
    }>('/auth/refresh-token');

    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
      queries: [
        withAuthenticationQuery('login', {
          queryCreator: login,
          extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
        }),
        withRefreshQuery('tokenRefresh', {
          queryCreator: tokenRefresh,
          extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
          expiresInPropertyName: 'exp',
          refreshBuffer: 60 * 60 * 1000,
        }),
      ],
    });

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(provider.queries.login).toBeDefined();
      expect(typeof provider.queries.login.execute).toBe('function');
      expect(typeof provider.queries.login.snapshot).toBe('function');

      expect(provider.queries.tokenRefresh).toBeDefined();
      expect(typeof provider.queries.tokenRefresh.execute).toBe('function');
      expect(typeof provider.queries.tokenRefresh.snapshot).toBe('function');
    });
  });

  it('should provide all required signals', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');

    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
      queries: [
        withAuthenticationQuery('login', {
          queryCreator: login,
          extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
        }),
      ],
    });

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(typeof provider.latestExecutedQuery).toBe('function');
      expect(typeof provider.latestNonInternalQuery).toBe('function');
      expect(typeof provider.accessToken).toBe('function');
      expect(typeof provider.refreshToken).toBe('function');
      expect(typeof provider.bearerData).toBe('function');
      expect(typeof provider.isAuthenticated).toBe('function');
    });
  });
});
