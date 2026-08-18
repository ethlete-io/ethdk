import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createUnsavedChangesTracker, getCookie, getDomain, injectRoute } from '@ethlete/core';
import { flushMultiTabSync, installFakeBroadcastChannel, installFakeWebLocks } from '@ethlete/query/testing';
import { createPostQuery, createQueryClient, createSecureGetQuery, QueryClientRef } from '../http';
import { createBearerAuthProvider } from './bearer-auth-provider';
import { withAuthenticationQuery, withRefreshQuery } from './bearer-auth-query-builders';
import { withBearerAuthMultiTabSync, withPersistentAuth } from './features';
import { encryptToken, resetEncryptionKey } from './utils';

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

  it('should create a bearer auth provider definition', () => {
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
    expect(typeof authProvider.provide).toBe('function');
    expect(typeof authProvider.inject).toBe('function');
    expect(authProvider.token).toBeTruthy();
  });

  it('should provide an inject function', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');

    const { inject: injectAuthProvider } = createBearerAuthProvider({
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

  it('should provide an injection token', () => {
    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { username: string; password: string };
      response: { token: string; refresh_token: string };
    }>('/auth/login');

    const { token } = createBearerAuthProvider({
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

    const { inject: injectAuthProvider } = createBearerAuthProvider({
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

    const { inject: injectAuthProvider } = createBearerAuthProvider({
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

    const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

    it('reuses one query across attempts instead of leaving a cache entry per attempt', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string; password: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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
        const repository = TestBed.inject(queryClientRef.token).repository;

        provider.queries.login.execute({ body: { username: 'wrong', password: 'pass' } });
        httpTesting
          .expectOne('https://api.example.com/auth/login')
          .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
        TestBed.tick();

        provider.queries.login.execute({ body: { username: 'right', password: 'pass' } });
        httpTesting.expectOne('https://api.example.com/auth/login').flush({
          token: 'access-123',
          refresh_token: 'refresh-456',
        });
        TestBed.tick();

        expect(repository.subtle.cacheEntries()).toHaveLength(1);
        expect(provider.accessToken()).toBe('access-123');
      });
    });

    it('is not replayed by refreshQueriesInUse', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string; password: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

        httpTesting.expectOne('https://api.example.com/auth/login').flush({
          token: 'access-123',
          refresh_token: 'refresh-456',
        });

        TestBed.tick();

        TestBed.inject(queryClientRef.token).refreshQueriesInUse();

        expect(httpTesting.match(() => true)).toHaveLength(0);
      });
    });
  });

  describe('setTokens', () => {
    it('should authenticate from externally issued tokens', async () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
          }),
        ],
      });

      TestBed.runInInjectionContext(async () => {
        const provider = injectAuthProvider();

        // An SSO callback arrives with both tokens - no auth query runs at all.
        let refreshed = 0;
        provider.afterTokenRefresh$.subscribe(() => refreshed++);

        provider.setTokens('external-access', 'external-refresh');
        await Promise.resolve();

        expect(provider.accessToken()).toBe('external-access');
        expect(provider.refreshToken()).toBe('external-refresh');
        expect(provider.isAuthenticated()).toBe(true);
        expect(refreshed).toBe(1);
        httpTesting.verify();
      });
    });

    it('should report a success executionState, like a completed auth query', () => {
      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.executionState()).toBeNull();

        provider.setTokens('external-access', 'external-refresh');

        expect(provider.executionState()).toEqual({ type: 'tokenSeed', state: 'success' });
      });
    });

    it('should not override the more specific executionState of a query-driven login', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        expect(provider.executionState()).toEqual({
          type: 'login',
          state: 'success',
          response: { token: 'access-123', refresh_token: 'refresh-456' },
        });
      });
    });

    it('should report an error executionState when the response carries no usable tokens', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: () => {
              throw new Error('no tokens in here');
            },
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        const state = provider.executionState();

        expect(state?.state).toBe('error');
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

    it('should re-run a secure query that outlived the logout once the user logs back in', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

      const getUserMe = createSecureGetQuery(queryClientRef, authProvider)<{ response: { uuid: string } }>('/user/me');

      const { provider, userQuery } = TestBed.runInInjectionContext(() => ({
        provider: authProvider.inject(),
        userQuery: getUserMe(),
      }));

      const signIn = (token: string) => {
        provider.queries.login.execute({ body: { username: 'test' } });
        TestBed.tick();
        httpTesting.expectOne('https://api.example.com/auth/login').flush({ token, refresh_token: `${token}-refresh` });
        TestBed.tick();
      };

      signIn('access-1');
      httpTesting.expectOne('https://api.example.com/user/me').flush({ uuid: 'user-1' });
      TestBed.tick();
      expect(userQuery.response()).toEqual({ uuid: 'user-1' });

      provider.logout();
      TestBed.tick();
      expect(userQuery.response()).toBeNull();

      signIn('access-2');

      httpTesting.expectOne('https://api.example.com/user/me').flush({ uuid: 'user-2' });
      TestBed.tick();

      expect(userQuery.response()).toEqual({ uuid: 'user-2' });
    });

    it('should run a secure query that waited out a failed login once a later one succeeds', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
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

      const getUserMe = createSecureGetQuery(queryClientRef, authProvider)<{ response: { uuid: string } }>('/user/me');

      const { provider, userQuery } = TestBed.runInInjectionContext(() => ({
        provider: authProvider.inject(),
        userQuery: getUserMe(),
      }));

      provider.queries.login.execute({ body: { username: 'test' } });
      TestBed.tick();
      httpTesting.expectOne('https://api.example.com/auth/login').flush(null, { status: 403, statusText: 'Forbidden' });
      TestBed.tick();

      expect(userQuery.error()).toBeTruthy();
      httpTesting.expectNone('https://api.example.com/user/me');

      provider.queries.login.execute({ body: { username: 'test' } });
      TestBed.tick();
      httpTesting
        .expectOne('https://api.example.com/auth/login')
        .flush({ token: 'access-1', refresh_token: 'refresh-1' });
      TestBed.tick();

      httpTesting.expectOne('https://api.example.com/user/me').flush({ uuid: 'user-1' });
      TestBed.tick();

      expect(userQuery.response()).toEqual({ uuid: 'user-1' });
    });

    it('should send the refreshed access token when a 401 is retried', async () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const refresh = postQuery<{
        body: { token: string };
        response: { token: string; refresh_token: string };
      }>('/auth/refresh');

      const extractTokens = (response: { token: string; refresh_token: string }) => ({
        accessToken: response.token,
        refreshToken: response.refresh_token,
      });

      const authProvider = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', { queryCreator: login, extractTokens }),
          withRefreshQuery('refresh', { queryCreator: refresh, extractTokens }),
        ],
      });

      const getUserMe = createSecureGetQuery(queryClientRef, authProvider)<{ response: { uuid: string } }>('/user/me');

      const { provider, userQuery } = TestBed.runInInjectionContext(() => ({
        provider: authProvider.inject(),
        userQuery: getUserMe(),
      }));

      provider.queries.login.execute({ body: { username: 'test' } });
      TestBed.tick();
      httpTesting
        .expectOne('https://api.example.com/auth/login')
        .flush({ token: 'access-1', refresh_token: 'refresh-1' });
      TestBed.tick();

      const first = httpTesting.expectOne('https://api.example.com/user/me');
      expect(first.request.headers.get('Authorization')).toBe('Bearer access-1');

      // The access token expired mid-session: the request 401s, which is what asks for a refresh.
      first.flush(null, { status: 401, statusText: 'Unauthorized' });
      TestBed.tick();

      httpTesting
        .expectOne('https://api.example.com/auth/refresh')
        .flush({ token: 'access-2', refresh_token: 'refresh-2' });
      TestBed.tick();
      await Promise.resolve();
      TestBed.tick();

      // The retry re-uses the repository's cached request, so it must resolve its headers again
      // rather than replay the ones the first attempt was built with.
      const retry = httpTesting.expectOne('https://api.example.com/user/me');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');

      retry.flush({ uuid: 'user-1' });
      TestBed.tick();
      expect(userQuery.response()).toEqual({ uuid: 'user-1' });
    });

    it('should abandon unsaved-changes guards so their dialogs and tab locks are released', async () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
          }),
        ],
      });

      const draft = signal('untouched');
      const confirm = vi.fn(() => false);

      const { provider, tracker } = TestBed.runInInjectionContext(() => ({
        provider: injectAuthProvider(),
        tracker: createUnsavedChangesTracker({ source: draft, confirm }),
      }));

      TestBed.tick();
      draft.set('edited');
      TestBed.tick();

      expect(tracker.hasChanges()).toBe(true);

      provider.logout();

      expect(tracker.isAbandoned()).toBe(true);
      // The edits can't be saved anymore, so the guard passes instead of prompting over the login page.
      await expect(tracker.runCheck()).resolves.toBe(true);
      expect(confirm).not.toHaveBeenCalled();
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
          }),
        ],
        features: [
          withPersistentAuth({
            autoLogin: {
              queryKey: 'login',
              buildArgs: (token) => ({ body: { username: token } }),
            },
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.features.persistentAuth).toBeDefined();
        expect(provider.features.persistentAuth.rememberMe).toBeDefined();
        expect(provider.features.persistentAuth.setRememberMe).toBeDefined();
      });
    });

    it('should work without features', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

  describe('multi-tab sync feature', () => {
    let originalBroadcastChannel: typeof BroadcastChannel;
    let mockChannel: {
      postMessage: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      onmessage: ((event: MessageEvent) => void) | null;
    };

    beforeEach(() => {
      // Reset encryption key for consistent test behavior
      resetEncryptionKey();

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

    it('should open the sync channel when the feature is used', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync()],
      });

      TestBed.runInInjectionContext(() => {
        injectAuthProvider();
        expect(globalThis.BroadcastChannel).toHaveBeenCalledWith('ethlete-auth-sync:test-auth');
      });
    });

    it('should report why every tab reads as the leader when no election runs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [withAuthenticationQuery('login', { queryCreator: login })],
        features: [withBearerAuthMultiTabSync({ leaderElection: false })],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.features.multiTabSync.leadership).toBe('off');
        expect(provider.features.multiTabSync.isLeader()).toBe(true);
      });
    });

    it('should broadcast token updates to other tabs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync()],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();

        // Tokens should be encrypted when broadcast
        const calls = mockChannel.postMessage.mock.calls;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tokenUpdateCall = calls.find((call: any[]) => call[0]?.type === 'tokens-updated');

        expect(tokenUpdateCall).toBeDefined();
        expect(tokenUpdateCall?.[0]).toEqual({
          type: 'tokens-updated',
          accessToken: encryptToken('access-token'),
          refreshToken: encryptToken('refresh-token'),
        });
      });
    });

    it('should broadcast logout to other tabs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync()],
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
          cause: 'user',
        });
      });
    });

    it('should receive token updates from other tabs', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync()],
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync()],
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

    it('should be off without the feature', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

        // Named rather than "never called": the query client opens a channel of its own for its
        // multi-tab sync, which is a separate opt-in.
        expect(globalThis.BroadcastChannel).not.toHaveBeenCalledWith('ethlete-auth-sync:test-auth');
      });
    });

    it('should use custom channel name', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync({ channelName: 'custom-auth-channel' })],
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync({ syncTokens: false })],
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

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
        ],
        features: [withBearerAuthMultiTabSync({ syncLogout: false })],
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
    it('should emit after successful login', async () => {
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
      await TestBed.runInInjectionContext(async () => {
        const provider = authProvider.inject();

        provider.afterTokenRefresh$.subscribe(() => {
          emissions.push('emitted');
        });

        // Login
        provider.queries.login.execute({ body: { username: 'test', password: 'pass' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();
        await Promise.resolve();

        // Should have emitted after successful login
        expect(emissions).toHaveLength(1);
      });
    });

    it('should emit after successful token refresh', async () => {
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
      await TestBed.runInInjectionContext(async () => {
        const provider = authProvider.inject();

        // Login first
        provider.queries.login.execute({ body: { username: 'test', password: 'pass' } });
        const loginReq = httpTesting.expectOne('https://api.example.com/auth/login');
        loginReq.flush({ accessToken: 'access-token', refreshToken: 'refresh-token' });
        TestBed.tick();
        await Promise.resolve();

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
        await Promise.resolve();

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
        const provider = authProvider.inject();

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

  describe('executionState', () => {
    it('should start as null', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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
        expect(provider.executionState()).toBeNull();
      });
    });

    it('should be loading during login', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

        expect(provider.executionState()).toEqual({ type: 'login', state: 'loading' });

        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();
      });
    });

    it('should be success after successful login', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        const state = provider.executionState();
        expect(state).toBeDefined();
        expect(state!.type).toBe('login');
        expect(state!.state).toBe('success');
        expect((state as { response: unknown }).response).toEqual({
          token: 'access-123',
          refresh_token: 'refresh-456',
        });
      });
    });

    it('should be error after failed login', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

        const state = provider.executionState();
        expect(state).toBeDefined();
        expect(state!.type).toBe('login');
        expect(state!.state).toBe('error');
        expect((state as { error: unknown }).error).toBeDefined();
      });
    });

    it('should be logout after calling logout', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        provider.logout();

        expect(provider.executionState()).toEqual({ type: 'logout', state: 'success' });
      });
    });

    it('should use the query key as type for auth queries', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const signup = postQuery<{
        body: { email: string };
        response: { token: string; refresh_token: string };
      }>('/auth/signup');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
            extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
          }),
          withAuthenticationQuery('signup', {
            queryCreator: signup,
            extractTokens: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.signup.execute({ body: { email: 'test@test.com' } });
        expect(provider.executionState()?.type).toBe('signup');

        const req = httpTesting.expectOne('https://api.example.com/auth/signup');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();
      });
    });

    it('should use autoLogin as type for persistent auth triggered queries', () => {
      vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));
      resetEncryptionKey();

      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');
      const refresh = postQuery<{
        body: { token: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/refresh');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: login,
          }),
          withAuthenticationQuery('refresh', {
            queryCreator: refresh,
          }),
        ],
        features: [
          withPersistentAuth({
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.executionState()?.type).toBe('autoLogin');
        expect(provider.executionState()?.state).toBe('loading');

        const req = httpTesting.expectOne('https://api.example.com/auth/refresh');
        req.flush({ accessToken: 'new-access', refreshToken: 'new-refresh' });
        TestBed.tick();

        expect(provider.executionState()?.type).toBe('autoLogin');
        expect(provider.executionState()?.state).toBe('success');
      });
    });

    it('should use tokenRefresh as type for token refresh queries', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const tokenRefresh = postQuery<{
        body: { token: string };
        response: { token: string; refresh_token: string };
      }>('/auth/refresh-token');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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
          }),
        ],
      });

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        // Login first to get tokens
        provider.queries.login.execute({ body: { username: 'test' } });
        const loginReq = httpTesting.expectOne('https://api.example.com/auth/login');
        loginReq.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        // Manually execute the refresh query
        provider.queries.tokenRefresh.execute({ body: { token: 'refresh-456' } });

        expect(provider.executionState()?.type).toBe('tokenRefresh');
        expect(provider.executionState()?.state).toBe('loading');

        const refreshReq = httpTesting.expectOne('https://api.example.com/auth/refresh-token');
        refreshReq.flush({ token: 'new-access', refresh_token: 'new-refresh' });
        TestBed.tick();

        expect(provider.executionState()?.type).toBe('tokenRefresh');
        expect(provider.executionState()?.state).toBe('success');
      });
    });

    it('should overwrite previous state with latest operation', () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');

      const { inject: injectAuthProvider } = createBearerAuthProvider({
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

        // Login succeeds
        provider.queries.login.execute({ body: { username: 'test' } });
        const req = httpTesting.expectOne('https://api.example.com/auth/login');
        req.flush({ token: 'access-123', refresh_token: 'refresh-456' });
        TestBed.tick();

        expect(provider.executionState()?.state).toBe('success');

        // Logout overwrites
        provider.logout();
        expect(provider.executionState()).toEqual({ type: 'logout', state: 'success' });
      });
    });
  });

  describe('sessionStatus', () => {
    const createProvider = (withRestore: boolean) => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');
      const restore = postQuery<{
        body: { token: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/restore');

      return createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', { queryCreator: login }),
          withAuthenticationQuery('restore', { queryCreator: restore }),
        ],
        features: withRestore
          ? [
              withPersistentAuth({
                autoLogin: { queryKey: 'restore', buildArgs: (token) => ({ body: { token } }) },
              }),
            ]
          : [],
      });
    };

    it('should be anonymous straight away when nothing tries to restore a session', () => {
      const { inject: injectAuthProvider } = createProvider(false);

      TestBed.runInInjectionContext(() => {
        expect(injectAuthProvider().sessionStatus()).toBe('anonymous');
      });
    });

    it('should be anonymous straight away when there is no cookie to restore from', () => {
      vi.mocked(getCookie).mockReturnValue(null);
      const { inject: injectAuthProvider } = createProvider(true);

      TestBed.runInInjectionContext(() => {
        expect(injectAuthProvider().sessionStatus()).toBe('anonymous');
      });
    });

    it('should be restoring while the auto-login is in flight, then authenticated', () => {
      vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));
      resetEncryptionKey();

      const { inject: injectAuthProvider } = createProvider(true);

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.sessionStatus()).toBe('restoring');

        httpTesting
          .expectOne('https://api.example.com/auth/restore')
          .flush({ accessToken: 'access', refreshToken: 'refresh' });
        TestBed.tick();

        expect(provider.sessionStatus()).toBe('authenticated');
      });
    });

    it('should be anonymous once a failed auto-login has settled', () => {
      vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));
      resetEncryptionKey();

      const { inject: injectAuthProvider } = createProvider(true);

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        expect(provider.sessionStatus()).toBe('restoring');

        httpTesting
          .expectOne('https://api.example.com/auth/restore')
          .flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
        TestBed.tick();

        expect(provider.sessionStatus()).toBe('anonymous');
      });
    });

    it('should follow a login and a logout', () => {
      const { inject: injectAuthProvider } = createProvider(false);

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.queries.login.execute({ body: { username: 'test' } });
        httpTesting
          .expectOne('https://api.example.com/auth/login')
          .flush({ accessToken: 'access', refreshToken: 'refresh' });
        TestBed.tick();

        expect(provider.sessionStatus()).toBe('authenticated');

        provider.logout();
        expect(provider.sessionStatus()).toBe('anonymous');
      });
    });

    it('should become authenticated on setTokens', () => {
      const { inject: injectAuthProvider } = createProvider(false);

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.setTokens('access', 'refresh');

        expect(provider.sessionStatus()).toBe('authenticated');
      });
    });
  });

  describe('sessionEndCause', () => {
    const createProvider = () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      return createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [withAuthenticationQuery('login', { queryCreator: login })],
      });
    };

    it('should be null until a session has ended', () => {
      const { inject: injectAuthProvider } = createProvider();

      TestBed.runInInjectionContext(() => {
        expect(injectAuthProvider().sessionEndCause()).toBeNull();
      });
    });

    it('should default to user for a plain logout', () => {
      const { inject: injectAuthProvider } = createProvider();

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.logout();

        expect(provider.sessionEndCause()).toBe('user');
      });
    });

    it('should keep the cause the caller passed', () => {
      const { inject: injectAuthProvider } = createProvider();

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.logout('inactivity');

        expect(provider.sessionEndCause()).toBe('inactivity');
      });
    });

    it('should clear once a new session starts', () => {
      const { inject: injectAuthProvider } = createProvider();

      TestBed.runInInjectionContext(() => {
        const provider = injectAuthProvider();

        provider.logout('inactivity');
        provider.setTokens('access', 'refresh');

        expect(provider.sessionEndCause()).toBeNull();
      });
    });
  });

  describe('proactive token refresh', () => {
    /** A token the provider's default `decryptBearer` reads an `exp` out of, in seconds. */
    const tokenExpiringIn = (seconds: number) =>
      `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;

    const createProvider = () => {
      const postQuery = createPostQuery(queryClientRef);
      const login = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const refresh = postQuery<{
        body: { token: string };
        response: { token: string; refresh_token: string };
      }>('/auth/refresh');

      const extractTokens = (response: { token: string; refresh_token: string }) => ({
        accessToken: response.token,
        refreshToken: response.refresh_token,
      });

      return createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', { queryCreator: login, extractTokens }),
          withRefreshQuery('refresh', { queryCreator: refresh, extractTokens }),
        ],
      });
    };

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const login = (provider: {
      queries: { login: { execute: (args: { body: { username: string } }) => unknown } };
    }) => {
      provider.queries.login.execute({ body: { username: 'test' } });
      TestBed.tick();
    };

    it('should refresh once the token reaches its refresh time', () => {
      const { inject: injectAuthProvider } = createProvider();

      TestBed.runInInjectionContext(() => {
        login(injectAuthProvider());

        httpTesting
          .expectOne('https://api.example.com/auth/login')
          .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-1' });
        TestBed.tick();

        httpTesting.expectNone('https://api.example.com/auth/refresh');

        // 1000s of lifetime, a 250s buffer (25% of it), so the refresh is due 750s in.
        vi.advanceTimersByTime(750_000);
        TestBed.tick();

        httpTesting
          .expectOne('https://api.example.com/auth/refresh')
          .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-2' });
        TestBed.tick();
      });
    });

    it('should come back for a refresh it could not run when it came due', () => {
      const { inject: injectAuthProvider } = createProvider();

      TestBed.runInInjectionContext(() => {
        login(injectAuthProvider());

        // Short-lived enough that the next refresh is due the moment the token is applied - which is
        // while the login that issued it still counts as in flight, so the attempt is declined.
        httpTesting
          .expectOne('https://api.example.com/auth/login')
          .flush({ token: tokenExpiringIn(20), refresh_token: 'refresh-1' });
        TestBed.tick();

        vi.advanceTimersByTime(5_000);
        TestBed.tick();

        httpTesting
          .expectOne('https://api.example.com/auth/refresh')
          .flush({ token: tokenExpiringIn(20), refresh_token: 'refresh-2' });
        TestBed.tick();

        // The one that follows lands inside `minRefreshInterval` and is declined too - without a
        // re-arm nothing renews this session again until a request fails with a 401.
        httpTesting.expectNone('https://api.example.com/auth/refresh');

        vi.advanceTimersByTime(30_000);
        TestBed.tick();

        httpTesting
          .expectOne('https://api.example.com/auth/refresh')
          .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-3' });
        TestBed.tick();
      });
    });
    it('should refresh a token that came due while the tab was hidden, as soon as it is visible again', () => {
      const { inject: injectAuthProvider } = createProvider();

      TestBed.runInInjectionContext(() => {
        login(injectAuthProvider());

        httpTesting
          .expectOne('https://api.example.com/auth/login')
          .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-1' });
        TestBed.tick();

        // Moving the clock without running timers is what a backgrounded tab does: the refresh came
        // due, and the throttled (or frozen) `timer()` never fired for it. Far enough that the token
        // is inside its refresh buffer - the schedule is always recomputed from the lifetime that is
        // *left*, so an hour of hidden time does not by itself make a long-lived token overdue.
        vi.setSystemTime(Date.now() + 970_000);

        httpTesting.expectNone('https://api.example.com/auth/refresh');

        document.dispatchEvent(new Event('visibilitychange'));
        TestBed.tick();

        httpTesting
          .expectOne('https://api.example.com/auth/refresh')
          .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-2' });
        TestBed.tick();
      });
    });

    /**
     * Everything a follower spec needs: the fakes installed, another tab holding the leader lock, and a
     * logged-in provider whose access token is one tick away from being stale. `dispose` unwinds it.
     */
    const openFollowerTab = async (options: { holdRefreshLock?: boolean } = {}) => {
      const bus = installFakeBroadcastChannel();
      const locks = installFakeWebLocks();

      let releaseLeaderLock = () => {
        /* not granted yet */
      };
      const leaderLock = navigator.locks.request(
        'ethlete-auth:leader:test-auth',
        () => new Promise<void>((resolve) => (releaseLeaderLock = resolve)),
      );

      let releaseRefreshLock = () => {
        /* not requested */
      };
      const refreshLock = options.holdRefreshLock
        ? navigator.locks.request(
            'ethlete-auth:refresh:test-auth',
            () => new Promise<void>((resolve) => (releaseRefreshLock = resolve)),
          )
        : Promise.resolve();

      const postQuery = createPostQuery(queryClientRef);
      const loginQuery = postQuery<{
        body: { username: string };
        response: { token: string; refresh_token: string };
      }>('/auth/login');
      const refresh = postQuery<{
        body: { token: string };
        response: { token: string; refresh_token: string };
      }>('/auth/refresh');

      const extractTokens = (response: { token: string; refresh_token: string }) => ({
        accessToken: response.token,
        refreshToken: response.refresh_token,
      });

      const { inject: injectAuthProvider } = createBearerAuthProvider({
        name: 'test-auth',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', { queryCreator: loginQuery, extractTokens }),
          withRefreshQuery('refresh', { queryCreator: refresh, extractTokens }),
        ],
        features: [withBearerAuthMultiTabSync()],
      });

      const settle = async () => {
        for (let i = 0; i < 5; i++) {
          TestBed.tick();
          await flushMultiTabSync();
        }
      };

      return {
        bus,
        settle,
        injectAuthProvider,
        dispose: async () => {
          releaseLeaderLock();
          releaseRefreshLock();
          await Promise.all([leaderLock.catch(() => undefined), refreshLock.catch(() => undefined)]);
          TestBed.resetTestingModule();
          bus.restore();
          locks.restore();
        },
      };
    };

    /**
     * Runs the token down to the point a follower stops waiting: 1000s of lifetime, a 250s refresh
     * buffer, and a 30s staleness grace, so the tab delegates 970s in.
     */
    const runTokenDownToStale = async (settle: () => Promise<void>) => {
      vi.advanceTimersByTime(750_000);
      await settle();

      vi.advanceTimersByTime(220_000);
      await settle();
    };

    it('should refresh the tokens itself once the leader has ignored every delegated request', async () => {
      const tab = await openFollowerTab();

      try {
        await TestBed.runInInjectionContext(async () => {
          // Read before the first await: an injection context does not survive one.
          const provider = tab.injectAuthProvider();

          login(provider);

          httpTesting
            .expectOne('https://api.example.com/auth/login')
            .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-1' });

          await tab.settle();
          tab.bus.posted.length = 0;

          await runTokenDownToStale(tab.settle);

          // Delegated rather than run here: the leader may still be the one to act on it.
          expect(
            tab.bus.posted.filter((message) => (message.data as { type: string }).type === 'refresh-requested').length,
          ).toBe(1);
          httpTesting.expectNone('https://api.example.com/auth/refresh');

          // Three unanswered 3s windows. A leader that answers none of them is frozen, gone, or broken,
          // and the tab holds a token that is about to be worthless either way.
          for (let window = 0; window < 3; window++) {
            vi.advanceTimersByTime(3_000);
            await tab.settle();
          }

          const request = httpTesting.expectOne('https://api.example.com/auth/refresh');

          expect(request.request.body).toEqual({ token: 'refresh-1' });

          request.flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-2' });
          await tab.settle();

          expect(provider.refreshToken()).toBe('refresh-2');
        });
      } finally {
        await tab.dispose();
      }
    });

    it('should keep waiting while the leader answers that a refresh started', async () => {
      const tab = await openFollowerTab();

      try {
        await TestBed.runInInjectionContext(async () => {
          login(tab.injectAuthProvider());

          httpTesting
            .expectOne('https://api.example.com/auth/login')
            .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-1' });

          await tab.settle();
          await runTokenDownToStale(tab.settle);

          const leaderChannel = new BroadcastChannel('ethlete-auth-leader:test-auth');

          leaderChannel.postMessage({ type: 'refresh-started' });
          await tab.settle();

          // The three windows a silent leader gets. This one said it is working on the refresh, so the
          // tab must not spend the refresh token that leader is spending.
          for (let window = 0; window < 3; window++) {
            vi.advanceTimersByTime(3_000);
            await tab.settle();
          }

          httpTesting.expectNone('https://api.example.com/auth/refresh');

          // Bounded even so: the answer said a refresh started, not that it will ever finish.
          for (let window = 0; window < 3; window++) {
            vi.advanceTimersByTime(3_000);
            await tab.settle();
          }

          httpTesting
            .expectOne('https://api.example.com/auth/refresh')
            .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-2' });
          await tab.settle();

          leaderChannel.close();
        });
      } finally {
        await tab.dispose();
      }
    });

    it('should stand down when another tab already holds the refresh lock', async () => {
      const tab = await openFollowerTab({ holdRefreshLock: true });

      try {
        await TestBed.runInInjectionContext(async () => {
          login(tab.injectAuthProvider());

          httpTesting
            .expectOne('https://api.example.com/auth/login')
            .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-1' });

          await tab.settle();
          await runTokenDownToStale(tab.settle);

          for (let window = 0; window < 3; window++) {
            vi.advanceTimersByTime(3_000);
            await tab.settle();
          }

          // Every follower goes stale at the same instant, so the lock is what stops the second one from
          // spending a refresh token the first one is already spending.
          httpTesting.expectNone('https://api.example.com/auth/refresh');
        });
      } finally {
        await tab.dispose();
      }
    });

    it('should leave a scheduled refresh to the leader instead of delegating it', async () => {
      const bus = installFakeBroadcastChannel();
      const locks = installFakeWebLocks();

      // Another tab already holds the leader lock, so the provider below is a follower.
      let releaseLeaderLock = () => {
        /* not granted yet */
      };
      const leaderLock = navigator.locks.request(
        'ethlete-auth:leader:test-auth',
        () => new Promise<void>((resolve) => (releaseLeaderLock = resolve)),
      );

      try {
        const postQuery = createPostQuery(queryClientRef);
        const loginQuery = postQuery<{
          body: { username: string };
          response: { token: string; refresh_token: string };
        }>('/auth/login');
        const refresh = postQuery<{
          body: { token: string };
          response: { token: string; refresh_token: string };
        }>('/auth/refresh');

        const extractTokens = (response: { token: string; refresh_token: string }) => ({
          accessToken: response.token,
          refreshToken: response.refresh_token,
        });

        const { inject: injectAuthProvider } = createBearerAuthProvider({
          name: 'test-auth',
          queryClientRef,
          queries: [
            withAuthenticationQuery('login', { queryCreator: loginQuery, extractTokens }),
            withRefreshQuery('refresh', { queryCreator: refresh, extractTokens }),
          ],
          features: [withBearerAuthMultiTabSync()],
        });

        await TestBed.runInInjectionContext(async () => {
          login(injectAuthProvider());

          httpTesting
            .expectOne('https://api.example.com/auth/login')
            .flush({ token: tokenExpiringIn(1000), refresh_token: 'refresh-1' });

          for (let i = 0; i < 5; i++) {
            TestBed.tick();
            await flushMultiTabSync();
          }

          bus.posted.length = 0;

          // 1000s of lifetime, a 250s buffer, so the follower's own timer is due 750s in - at the same
          // instant as the leader's, which is why acting on it here can only duplicate the leader.
          vi.advanceTimersByTime(750_000);
          TestBed.tick();
          await flushMultiTabSync();

          httpTesting.expectNone('https://api.example.com/auth/refresh');
          expect(
            bus.posted.filter((message) => (message.data as { type: string }).type === 'refresh-requested'),
          ).toEqual([]);
        });
      } finally {
        releaseLeaderLock();
        await leaderLock.catch(() => undefined);
        TestBed.resetTestingModule();
        bus.restore();
        locks.restore();
      }
    });
  });
});
