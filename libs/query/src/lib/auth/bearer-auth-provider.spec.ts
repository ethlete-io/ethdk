import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { getCookie, getDomain, injectRoute } from '@ethlete/core';
import { createPostQuery, createQueryClient, QueryClientRef } from '../http';
import { createBearerAuthProvider } from './bearer-auth-provider';
import { withAuthenticationQuery, withRefreshQuery } from './bearer-auth-query-builders';
import { withCookieTokenStorage } from './features';

vi.mock('@ethlete/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ethlete/core')>();
  return {
    ...actual,
    getCookie: vi.fn(),
    setCookie: vi.fn(),
    deleteCookie: vi.fn(),
    getDomain: vi.fn(),
    injectRoute: vi.fn(),
  };
});

describe('createBearerAuthProvider', () => {
  let queryClientRef: QueryClientRef;
  let httpTesting: HttpTestingController;
  let originalWarn: typeof console.warn;
  let originalError: typeof console.error;

  beforeEach(() => {
    TestBed.resetTestingModule();

    // Suppress console.warn for auth-related warnings during tests
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const message = args[0];
      if (typeof message === 'string' && message.includes('auto-refresh')) {
        return; // Suppress auto-refresh warnings
      }
      originalWarn(...args);
    };

    // Suppress console.error for expected error scenarios during tests
    originalError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args[0];
      // Suppress HttpErrorResponse logs for failed auth attempts
      if (message && typeof message === 'object' && 'name' in message && message.name === 'HttpErrorResponse') {
        return;
      }
      // Suppress bearer token decryption errors
      if (typeof message === 'string' && message.includes('Failed to decrypt bearer token')) {
        return;
      }
      // Suppress token extraction errors
      if (typeof message === 'string' && message.includes('Failed to extract tokens from')) {
        return;
      }
      originalError(...args);
    };

    queryClientRef = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpTesting = TestBed.inject(HttpTestingController);

    vi.mocked(getCookie).mockReturnValue(null);
    vi.mocked(getDomain).mockReturnValue('localhost');
    vi.mocked(injectRoute).mockReturnValue(signal('/test'));
  });

  afterEach(() => {
    httpTesting.verify();
    vi.clearAllMocks();
    console.warn = originalWarn;
    console.error = originalError;
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

  describe('login flow', () => {
    it('should extract and store tokens from successful login response', () => {
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

        provider.queries.login.execute({ body: { username: 'test', password: 'pass' } });

        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });

        TestBed.tick();

        expect(provider.accessToken()).toBe('access-123');
        expect(provider.refreshToken()).toBe('refresh-456');
        expect(provider.isAuthenticated()).toBe(true);
      });
    });

    it('should use custom token extractor when provided', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { data: { access: string; refresh: string } };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({
              accessToken: response.data.access,
              refreshToken: response.data.refresh,
            }),
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.login.execute({ body: { username: 'test' } });

        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ data: { access: 'custom-access', refresh: 'custom-refresh' } });

        TestBed.tick();

        expect(provider.accessToken()).toBe('custom-access');
        expect(provider.refreshToken()).toBe('custom-refresh');
      });
    });

    it('should not update tokens on failed login', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

        provider.queries.login.execute({ body: { username: 'test' } });

        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

        TestBed.tick();

        expect(provider.accessToken()).toBeNull();
        expect(provider.refreshToken()).toBeNull();
        expect(provider.isAuthenticated()).toBe(false);
      });
    });
  });

  describe('logout', () => {
    it('should clear all tokens on logout', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

        // Login first
        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        expect(provider.isAuthenticated()).toBe(true);

        // Logout
        provider.logout();

        expect(provider.accessToken()).toBeNull();
        expect(provider.refreshToken()).toBeNull();
        expect(provider.isAuthenticated()).toBe(false);
      });
    });

    it('should update isAuthenticated signal on logout', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

        expect(provider.isAuthenticated()).toBe(false);

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        expect(provider.isAuthenticated()).toBe(true);

        provider.logout();

        expect(provider.isAuthenticated()).toBe(false);
      });
    });
  });

  describe('bearerData', () => {
    it('should compute bearerData using bearerDecryptFn', () => {
      interface BearerData {
        userId: string;
        role: string;
      }

      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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
        bearerDecryptFn: (token: string): BearerData => {
          const parts = token.split('.');
          return JSON.parse(atob(parts[1] ?? ''));
        },
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        const payload = JSON.stringify({ userId: '123', role: 'admin' });
        const fakeToken = `header.${btoa(payload)}.signature`;

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: fakeToken, refresh_token: 'refresh-456' });
        TestBed.tick();

        const bearerData = provider.bearerData();
        expect(bearerData).toEqual({ userId: '123', role: 'admin' });
      });
    });

    it('should return null when bearerDecryptFn throws error', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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
        bearerDecryptFn: () => {
          throw new Error('Decryption failed');
        },
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'invalid-token', refresh_token: 'refresh-456' });
        TestBed.tick();

        expect(provider.bearerData()).toBeNull();
      });
    });

    it('should return null when no bearerDecryptFn is provided', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'some-token', refresh_token: 'refresh-456' });
        TestBed.tick();

        expect(provider.bearerData()).toBeNull();
      });
    });

    it('should update bearerData when access token changes', () => {
      interface BearerData {
        userId: string;
      }

      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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
        bearerDecryptFn: (token: string): BearerData => {
          const parts = token.split('.');
          return JSON.parse(atob(parts[1] ?? ''));
        },
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        // First login
        const payload1 = JSON.stringify({ userId: '123' });
        const token1 = `header.${btoa(payload1)}.signature`;

        provider.queries.login.execute({ body: { username: 'user1' } });
        const req1 = httpTesting.expectOne('https://api.example.com/auth/login');
        req1.flush({ token: token1, refresh_token: 'refresh-1' });
        TestBed.tick();

        expect(provider.bearerData()?.userId).toBe('123');

        // Second login with different user
        const payload2 = JSON.stringify({ userId: '456' });
        const token2 = `header.${btoa(payload2)}.signature`;

        provider.queries.login.execute({ body: { username: 'user2' } });
        const req2 = httpTesting.expectOne('https://api.example.com/auth/login');
        req2.flush({ token: token2, refresh_token: 'refresh-2' });
        TestBed.tick();

        expect(provider.bearerData()?.userId).toBe('456');
      });
    });
  });

  describe('latestExecutedQuery tracking', () => {
    it('should track latestExecutedQuery for user-triggered queries', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

        provider.queries.login.execute({ body: { username: 'test' } });

        expect(provider.latestExecutedQuery()).toBeDefined();
        expect(provider.latestExecutedQuery()?.key).toBe('login');

        // Flush the pending request
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access', refresh_token: 'refresh' });
      });
    });

    it('should track latestNonInternalQuery for user-triggered queries', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

        expect(provider.latestNonInternalQuery()).toBeNull();

        provider.queries.login.execute({ body: { username: 'test' } });

        expect(provider.latestNonInternalQuery()).toBeDefined();
        expect(provider.latestNonInternalQuery()?.key).toBe('login');

        // Flush the pending request
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access', refresh_token: 'refresh' });
      });
    });

    it('should update latestExecutedQuery for multiple queries', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const tokenRefresh = postQuery<{
        body: { refresh_token: string };
        response: { token: string; refresh_token: string };
      }>('/auth/refresh');

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

        provider.queries.login.execute({ body: { username: 'test' } });
        expect(provider.latestExecutedQuery()?.key).toBe('login');
        httpTesting.expectOne('https://api.example.com/auth/login').flush({ token: 'a', refresh_token: 'r' });

        provider.queries.tokenRefresh.execute({ body: { refresh_token: 'token' } });
        expect(provider.latestExecutedQuery()?.key).toBe('tokenRefresh');
        httpTesting.expectOne('https://api.example.com/auth/refresh').flush({ token: 'a2', refresh_token: 'r2' });
      });
    });
  });

  describe('multiple query types', () => {
    it('should support both login and refresh queries', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const tokenRefresh = postQuery<{
        body: { refresh_token: string };
        response: { token: string; refresh_token: string };
      }>('/auth/refresh');

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
        expect(provider.queries.tokenRefresh).toBeDefined();

        // Login
        provider.queries.login.execute({ body: { username: 'test' } });
        const loginReq = httpTesting.expectOne('https://api.example.com/auth/login');
        loginReq.flush({ token: 'access-1', refresh_token: 'refresh-1' });
        TestBed.tick();

        expect(provider.accessToken()).toBe('access-1');

        // Refresh
        provider.queries.tokenRefresh.execute({ body: { refresh_token: 'refresh-1' } });
        const refreshReq = httpTesting.expectOne('https://api.example.com/auth/refresh');
        refreshReq.flush({ token: 'access-2', refresh_token: 'refresh-2' });
        TestBed.tick();

        expect(provider.accessToken()).toBe('access-2');
        expect(provider.refreshToken()).toBe('refresh-2');
      });
    });

    it('should extract tokens from both query types independently', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const tokenRefresh = postQuery<{
        body: { refresh_token: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/refresh');

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
            // Different format for refresh endpoint - uses default extractor
            expiresInPropertyName: 'exp',
            refreshBuffer: 60 * 60 * 1000,
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        // Login with token/refresh_token format
        provider.queries.login.execute({ body: { username: 'test' } });
        const loginReq = httpTesting.expectOne('https://api.example.com/auth/login');
        loginReq.flush({ token: 'access-1', refresh_token: 'refresh-1' });
        TestBed.tick();

        expect(provider.accessToken()).toBe('access-1');
        expect(provider.refreshToken()).toBe('refresh-1');

        // Refresh with accessToken/refreshToken format (default extractor)
        provider.queries.tokenRefresh.execute({ body: { refresh_token: 'refresh-1' } });
        const refreshReq = httpTesting.expectOne('https://api.example.com/auth/refresh');
        refreshReq.flush({ accessToken: 'access-2', refreshToken: 'refresh-2' });
        TestBed.tick();

        expect(provider.accessToken()).toBe('access-2');
        expect(provider.refreshToken()).toBe('refresh-2');
      });
    });
  });

  describe('features integration', () => {
    it('should support cookie storage feature', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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
        features: [
          withCookieTokenStorage({
            autoLogin: {
              queryKey: 'login',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.features.cookieStorage).toBeDefined();
        expect(provider.features.cookieStorage.enable).toBeDefined();
        expect(provider.features.cookieStorage.disable).toBeDefined();
      });
    });

    it('should work without features', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

        // Should still work without features
        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        expect(provider.accessToken()).toBe('access-123');
      });
    });
  });

  describe('built-in multi-tab sync', () => {
    let originalBroadcastChannel: typeof BroadcastChannel;
    let mockChannel: {
      postMessage: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      onmessage: ((event: MessageEvent) => void) | null;
    };

    beforeEach(() => {
      originalBroadcastChannel = globalThis.BroadcastChannel;
      mockChannel = {
        postMessage: vi.fn(),
        close: vi.fn(),
        onmessage: null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).BroadcastChannel = vi.fn(function (this: any) {
        return mockChannel;
      });
    });

    afterEach(() => {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    });

    it('should be enabled by default', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        injectAuthProvider();
        expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('ethlete-auth-sync');
      });
    });

    it('should broadcast token updates to other tabs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        expect(mockChannel.postMessage).toHaveBeenCalledWith({
          type: 'tokens-updated',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });
      });
    });

    it('should broadcast logout to other tabs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        // First login
        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        mockChannel.postMessage.mockClear();

        // Then logout
        provider.logout();
        TestBed.tick();

        expect(mockChannel.postMessage).toHaveBeenCalledWith({
          type: 'logout',
        });
      });
    });

    it('should receive token updates from other tabs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.accessToken()).toBeNull();

        // Simulate message from another tab
        mockChannel.onmessage?.({
          data: {
            type: 'tokens-updated',
            accessToken: 'external-access',
            refreshToken: 'external-refresh',
          },
        } as MessageEvent);

        expect(provider.accessToken()).toBe('external-access');
        expect(provider.refreshToken()).toBe('external-refresh');
      });
    });

    it('should receive logout from other tabs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        // Set tokens
        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        expect(provider.accessToken()).toBe('access-token');

        // Simulate logout from another tab
        mockChannel.onmessage?.({
          data: {
            type: 'logout',
          },
        } as MessageEvent);

        expect(provider.accessToken()).toBeNull();
        expect(provider.refreshToken()).toBeNull();
      });
    });

    it('should be disabled when multiTabSync is false', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        multiTabSync: false,
      });

      TestBed.runInInjectionContext(() => {
        injectAuthProvider();
        expect(globalThis.BroadcastChannel).not.toHaveBeenCalled();
      });
    });

    it('should use custom channel name', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        multiTabSync: {
          channelName: 'custom-auth-channel',
        },
      });

      TestBed.runInInjectionContext(() => {
        injectAuthProvider();
        expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('custom-auth-channel');
      });
    });

    it('should respect syncTokens config', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        multiTabSync: {
          syncTokens: false,
        },
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        // Should not broadcast token updates
        expect(mockChannel.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tokens-updated' }));
      });
    });

    it('should respect syncLogout config', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const [, injectAuthProvider] = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        multiTabSync: {
          syncLogout: false,
        },
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        // Login first
        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        mockChannel.postMessage.mockClear();

        // Logout
        provider.logout();
        TestBed.tick();

        // Should not broadcast logout
        expect(mockChannel.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'logout' }));
      });
    });
  });

  describe('afterTokenRefresh$ Observable', () => {
    it('should emit after successful login', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string; password: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const authProvider = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({ accessToken: response.accessToken, refreshToken: response.refreshToken }),
          }),
        ],
      });

      const emissions: unknown[] = [];
      TestBed.runInInjectionContext(() => {
        const provider = authProvider[1]();

        provider.afterTokenRefresh$.subscribe(() => {
          emissions.push('emitted');
        });

        // Login
        provider.queries.login.execute({ body: { username: 'test', password: 'pass' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        // Should have emitted after successful login
        expect(emissions).toHaveLength(1);
      });
    });

    it('should emit after successful token refresh', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string; password: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const refresh = postQuery<{
        body: { refreshToken: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/refresh');

      const authProvider = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({ accessToken: response.accessToken, refreshToken: response.refreshToken }),
          }),
          withRefreshQuery('refresh', {
            queryCreator: refresh,
            extractTokens: (response) => ({ accessToken: response.accessToken, refreshToken: response.refreshToken }),
          }),
        ],
      });

      const emissions: unknown[] = [];
      TestBed.runInInjectionContext(() => {
        const provider = authProvider[1]();

        // Login first
        provider.queries.login.execute({ body: { username: 'test', password: 'pass' } });
        const loginReq = httpTesting.expectOne('https://api.example.com/auth/login');
        loginReq.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        // Now subscribe to afterTokenRefresh$
        provider.afterTokenRefresh$.subscribe(() => {
          emissions.push('emitted');
        });

        // Trigger refresh
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provider.queries.refresh.execute({} as any);
        const refreshReq = httpTesting.expectOne('https://api.example.com/auth/refresh');
        refreshReq.flush({ accessToken: 'new-access', refreshToken: 'new-refresh' });
        TestBed.tick();

        // Should have emitted after successful refresh
        expect(emissions).toHaveLength(1);
      });
    });

    it('should not emit when login fails', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string; password: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const authProvider = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({ accessToken: response.accessToken, refreshToken: response.refreshToken }),
          }),
        ],
      });

      const emissions: unknown[] = [];
      TestBed.runInInjectionContext(() => {
        const provider = authProvider[1]();

        provider.afterTokenRefresh$.subscribe(() => {
          emissions.push('emitted');
        });

        // Failed login
        provider.queries.login.execute({ body: { username: 'test', password: 'wrong' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
        TestBed.tick();

        // Should NOT have emitted
        expect(emissions).toHaveLength(0);
      });
    });
  });
});
