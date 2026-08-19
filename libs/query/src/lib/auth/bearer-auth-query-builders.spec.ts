import { HttpHeaders } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryTestSetup, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it } from 'vitest';

describe('bearer-auth-query-builders', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    setup = setupQueryTest({ baseUrl: 'https://api.test.com', name: 'test-auth' });
  });

  describe('withAuthenticationQuery', () => {
    it('should extract and store tokens from login response', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
      });

      expect(authSetup.auth.accessToken()).toBeNull();
      expect(authSetup.auth.refreshToken()).toBeNull();

      authSetup.login(
        { username: 'testuser', password: 'testpass' },
        { accessToken: 'test-access-123', refreshToken: 'test-refresh-456' },
      );

      expect(authSetup.auth.accessToken()).toBe('test-access-123');
      expect(authSetup.auth.refreshToken()).toBe('test-refresh-456');
    });

    it('should use custom token extraction function', () => {
      type CustomLoginResponse = {
        accessToken: string;
        refreshToken: string;
        data: { token: string; refresh: string };
      };

      const authSetup = setupAuthTest<
        { body: { username: string; password: string }; response: CustomLoginResponse },
        { body: { token: string }; response: { accessToken: string; refreshToken: string } }
      >({
        querySetup: setup,
        extractLoginTokens: (response) => ({
          accessToken: response.data.token,
          refreshToken: response.data.refresh,
        }),
      });

      authSetup.login(
        { username: 'testuser', password: 'testpass' },
        { accessToken: '', refreshToken: '', data: { token: 'custom-access', refresh: 'custom-refresh' } },
      );

      expect(authSetup.auth.accessToken()).toBe('custom-access');
      expect(authSetup.auth.refreshToken()).toBe('custom-refresh');
    });
  });

  describe('withRefreshQuery - Token Refresh', () => {
    it('should extract and update tokens from refresh response', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
      });

      authSetup.login(
        { username: 'test', password: 'pass' },
        { accessToken: 'old-access', refreshToken: 'old-refresh' },
      );

      expect(authSetup.auth.accessToken()).toBe('old-access');

      authSetup.refresh('old-refresh', { accessToken: 'new-access', refreshToken: 'new-refresh' });

      expect(authSetup.auth.accessToken()).toBe('new-access');
      expect(authSetup.auth.refreshToken()).toBe('new-refresh');
    });

    it('should use custom token extraction function for refresh', () => {
      type CustomRefreshResponse = {
        accessToken: string;
        refreshToken: string;
        tokens: { access: string; refresh: string };
      };

      const authSetup = setupAuthTest<
        { body: { username: string; password: string }; response: { accessToken: string; refreshToken: string } },
        { body: { token: string }; response: CustomRefreshResponse }
      >({
        querySetup: setup,
        extractRefreshTokens: (response) => ({
          accessToken: response.tokens.access,
          refreshToken: response.tokens.refresh,
        }),
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'initial', refreshToken: 'initial' });

      authSetup.refresh('initial', {
        accessToken: '',
        refreshToken: '',
        tokens: { access: 'refreshed-access', refresh: 'refreshed-refresh' },
      });

      expect(authSetup.auth.accessToken()).toBe('refreshed-access');
      expect(authSetup.auth.refreshToken()).toBe('refreshed-refresh');
    });
  });

  describe('withRefreshQuery - the refresh request body', () => {
    const unauthorizeAndExpectRefresh = () => {
      setup.httpTesting
        .expectOne('https://api.test.com/api/secure-data')
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      return setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
    };

    it('sends the refresh token as `token` by default', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh-123' });
      authSetup.makeSecureRequest('/api/secure-data');

      expect(unauthorizeAndExpectRefresh().request.body).toEqual({ token: 'refresh-123' });
    });

    it('sends what buildArgs returns when the API names the field differently', () => {
      const authSetup = setupAuthTest<
        { body: { username: string; password: string }; response: { accessToken: string; refreshToken: string } },
        { body: { refresh_token: string }; response: { accessToken: string; refreshToken: string } }
      >({
        querySetup: setup,
        autoRetryOn401: true,
        buildRefreshArgs: (refreshToken) => ({ body: { refresh_token: refreshToken } }),
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh-123' });
      authSetup.makeSecureRequest('/api/secure-data');

      expect(unauthorizeAndExpectRefresh().request.body).toEqual({ refresh_token: 'refresh-123' });
    });
  });

  describe('withRefreshQuery - Auto-retry on 401', () => {
    const makeSecureRequestWithToken = (route: string, token: string) => {
      TestBed.runInInjectionContext(() => {
        setup.queryClient.repository.request({
          route: route as never,
          method: 'GET',
          isSecure: true,
          args: { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) },
          consumerDestroyRef: TestBed.inject(DestroyRef),
        });
      });
    };

    const unauthorize = (route: string) => {
      TestBed.runInInjectionContext(() => {
        setup.queryClient.repository.request({
          route: route as never,
          method: 'GET',
          isSecure: true,
          consumerDestroyRef: TestBed.inject(DestroyRef),
        });
      });

      setup.httpTesting
        .expectOne(`https://api.test.com${route}`)
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();
    };

    it('should trigger token refresh when a secure query returns 401', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        autoRetryOn401: true,
      });

      authSetup.login(
        { username: 'test', password: 'pass' },
        { accessToken: 'initial-access-token', refreshToken: 'refresh-token-123' },
      );

      expect(authSetup.auth.accessToken()).toBe('initial-access-token');
      expect(authSetup.auth.refreshToken()).toBe('refresh-token-123');

      authSetup.makeSecureRequest('/api/secure-data');

      const secureReq1 = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');
      secureReq1.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      // Should trigger refresh after 401
      const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
      refreshReq.flush({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
      TestBed.tick();

      expect(authSetup.auth.accessToken()).toBe('new-access-token');
      expect(authSetup.auth.refreshToken()).toBe('new-refresh-token');
    });

    it('should not trigger refresh if autoRetryOn401 is disabled', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        autoRetryOn401: false,
      });

      authSetup.login(
        { username: 'test', password: 'pass' },
        { accessToken: 'access-token', refreshToken: 'refresh-token' },
      );

      authSetup.makeSecureRequest('/api/secure-data');

      const secureReq = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');
      secureReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      // Should NOT trigger refresh
      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('should not trigger refresh for non-secure requests that fail with 401', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        autoRetryOn401: true,
      });

      authSetup.login(
        { username: 'test', password: 'pass' },
        { accessToken: 'access-token', refreshToken: 'refresh-token' },
      );

      // Make a non-secure request
      TestBed.runInInjectionContext(() => {
        setup.queryClient.repository.request({
          route: '/public/data' as never,
          method: 'GET',
          isSecure: false,
          consumerDestroyRef: TestBed.inject(DestroyRef),
        });
      });

      const publicReq = setup.httpTesting.expectOne('https://api.test.com/public/data');
      publicReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      // Should NOT trigger refresh for non-secure requests
      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('refreshes again for a second 401, rather than letting minRefreshInterval swallow it', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        autoRetryOn401: true,
        minRefreshInterval: 30000,
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access-1', refreshToken: 'refresh-1' });

      const unauthorize = () => {
        authSetup.makeSecureRequest('/api/secure-data');
        setup.httpTesting
          .expectOne('https://api.test.com/api/secure-data')
          .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

        TestBed.tick();
        TestBed.tick();
      };

      unauthorize();
      setup.httpTesting
        .expectOne('https://api.test.com/auth/refresh')
        .flush({ accessToken: 'access-2', refreshToken: 'refresh-2' });
      TestBed.tick();

      // The token this just minted is revoked server-side, well inside the 30s interval.
      unauthorize();
      setup.httpTesting
        .expectOne('https://api.test.com/auth/refresh')
        .flush({ accessToken: 'access-3', refreshToken: 'refresh-3' });
      TestBed.tick();

      expect(authSetup.auth.accessToken()).toBe('access-3');
    });

    it('sends one refresh while another is still in flight', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      for (const route of ['/api/a', '/api/b']) {
        authSetup.makeSecureRequest(route);
        setup.httpTesting
          .expectOne(`https://api.test.com${route}`)
          .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

        TestBed.tick();
        TestBed.tick();
      }

      setup.httpTesting
        .expectOne('https://api.test.com/auth/refresh')
        .flush({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      TestBed.tick();

      expect(authSetup.auth.accessToken()).toBe('new-access');
    });

    it('does not refresh for a 401 from a request sent with an older access token', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access-1', refreshToken: 'refresh-1' });

      makeSecureRequestWithToken('/api/slow', 'access-1');

      // The refresh already happened by the time the 401 lands - refreshing again would spend the
      // token pair it just produced.
      authSetup.auth.setTokens('access-2', 'refresh-2');
      TestBed.tick();

      setup.httpTesting
        .expectOne('https://api.test.com/api/slow')
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('refreshes for a 401 from a request sent with the current access token', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access-1', refreshToken: 'refresh-1' });

      makeSecureRequestWithToken('/api/slow', 'access-1');

      setup.httpTesting
        .expectOne('https://api.test.com/api/slow')
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      setup.httpTesting
        .expectOne('https://api.test.com/auth/refresh')
        .flush({ accessToken: 'access-2', refreshToken: 'refresh-2' });
      TestBed.tick();

      expect(authSetup.auth.accessToken()).toBe('access-2');
    });

    it('falls back to minRefreshInterval once a streak of fresh tokens keeps being rejected', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true, minRefreshInterval: 30000 });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access-0', refreshToken: 'refresh-0' });

      for (let round = 1; round <= 3; round++) {
        unauthorize(`/api/secure-${round}`);
        setup.httpTesting
          .expectOne('https://api.test.com/auth/refresh')
          .flush({ accessToken: `access-${round}`, refreshToken: `refresh-${round}` });
        TestBed.tick();
      }

      // The fourth rejection inside the interval: refreshing yet again cannot help.
      unauthorize('/api/secure-4');
      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('ends the rejected-token streak when a secure request succeeds', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true, minRefreshInterval: 30000 });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access-0', refreshToken: 'refresh-0' });

      for (let round = 1; round <= 2; round++) {
        unauthorize(`/api/secure-${round}`);
        setup.httpTesting
          .expectOne('https://api.test.com/auth/refresh')
          .flush({ accessToken: `access-${round}`, refreshToken: `refresh-${round}` });
        TestBed.tick();
      }

      authSetup.makeSecureRequest('/api/ok');
      setup.httpTesting.expectOne('https://api.test.com/api/ok').flush({ fine: true });
      TestBed.tick();
      TestBed.tick();

      for (let round = 3; round <= 4; round++) {
        unauthorize(`/api/secure-${round}`);
        setup.httpTesting
          .expectOne('https://api.test.com/auth/refresh')
          .flush({ accessToken: `access-${round}`, refreshToken: `refresh-${round}` });
        TestBed.tick();
      }

      expect(authSetup.auth.accessToken()).toBe('access-4');
    });

    it('should not trigger refresh if refresh token is missing', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        autoRetryOn401: true,
      });

      // Login with access token but without refresh token
      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access-token', refreshToken: '' });

      expect(authSetup.auth.refreshToken()).toBe('');

      authSetup.makeSecureRequest('/api/secure-data');

      const secureReq = setup.httpTesting.expectOne('https://api.test.com/api/secure-data');
      secureReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      // Should NOT trigger refresh if refresh token is empty
      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });
  });

  describe('withRefreshQuery - a refresh racing another token-issuing execution', () => {
    const raise401On = (route: string) => {
      setup.httpTesting
        .expectOne(`https://api.test.com${route}`)
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();
    };

    it('ignores a refresh that lands after the login which superseded it', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      authSetup.makeSecureRequest('/api/secure-data');
      raise401On('/api/secure-data');

      const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');

      TestBed.runInInjectionContext(() => {
        authSetup.auth.queries.login.execute({ body: { username: 'test', password: 'pass' } });
      });

      const loginReq = setup.httpTesting.expectOne('https://api.test.com/auth/login');

      loginReq.flush({ accessToken: 'login-access', refreshToken: 'login-refresh' });
      TestBed.tick();
      TestBed.tick();

      refreshReq.flush({ accessToken: 'refreshed-access', refreshToken: 'refreshed-refresh' });
      TestBed.tick();
      TestBed.tick();

      expect(authSetup.auth.accessToken()).toBe('login-access');
      expect(authSetup.auth.executionState()).toEqual({
        type: 'login',
        state: 'success',
        response: { accessToken: 'login-access', refreshToken: 'login-refresh' },
      });
    });

    it('does not start a refresh while a login is in flight', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.runInInjectionContext(() => {
        authSetup.auth.queries.login.execute({ body: { username: 'test', password: 'pass' } });
      });

      const loginReq = setup.httpTesting.expectOne('https://api.test.com/auth/login');

      authSetup.makeSecureRequest('/api/secure-data');
      raise401On('/api/secure-data');

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');

      loginReq.flush({ accessToken: 'login-access', refreshToken: 'login-refresh' });
      TestBed.tick();
      TestBed.tick();

      expect(authSetup.auth.accessToken()).toBe('login-access');
    });
  });

  describe('withRefreshQuery - a refresh that fails', () => {
    const failRefreshWith = (status: number, authSetup: ReturnType<typeof setupAuthTest>) => {
      authSetup.makeSecureRequest('/api/secure-data');
      setup.httpTesting
        .expectOne('https://api.test.com/api/secure-data')
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();
      TestBed.tick();

      setup.httpTesting
        .expectOne('https://api.test.com/auth/refresh')
        .flush({ message: 'nope' }, { status, statusText: 'Failed' });

      TestBed.tick();
      TestBed.tick();
    };

    it('ends the session when the server refuses the refresh token', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });
      expect(authSetup.auth.isAuthenticated()).toBe(true);

      failRefreshWith(401, authSetup);

      expect(authSetup.auth.isAuthenticated()).toBe(false);
      expect(authSetup.auth.accessToken()).toBeNull();
      expect(authSetup.auth.executionState()).toEqual({ type: 'logout', state: 'success' });
      expect(authSetup.auth.sessionEndCause()).toBe('expired');
    });

    it('ends the session for any status the retry config does not consider worth retrying', () => {
      const authSetup = setupAuthTest({ querySetup: setup, autoRetryOn401: true });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      failRefreshWith(403, authSetup);

      expect(authSetup.auth.isAuthenticated()).toBe(false);
    });

    it('hands the failure to onRefreshFailure instead, which may keep the session', () => {
      const seen: number[] = [];
      const authSetup = setupAuthTest({
        querySetup: setup,
        autoRetryOn401: true,
        onRefreshFailure: ({ error }) => seen.push(error.code),
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      failRefreshWith(401, authSetup);

      expect(seen).toEqual([401]);
      expect(authSetup.auth.isAuthenticated()).toBe(true);
    });

    it('hands an unusable successful refresh response to onRefreshFailure', () => {
      const seen: number[] = [];
      const authSetup = setupAuthTest({
        querySetup: setup,
        extractRefreshTokens: () => {
          throw new Error('missing tokens');
        },
        onRefreshFailure: ({ error }) => seen.push(error.code),
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });
      authSetup.refresh('refresh', { accessToken: 'ignored', refreshToken: 'ignored' });
      TestBed.tick();

      expect(seen).toEqual([0]);
      expect(authSetup.auth.accessToken()).toBe('access');
    });
  });

  describe('withRefreshQuery - Preemptive Refresh', () => {
    it('should accept refreshStrategy configuration options', () => {
      // This test just verifies that the configuration is accepted without errors
      const authSetup = setupAuthTest({
        querySetup: setup,
        refreshStrategy: { percentage: 0.75, minBufferMs: 60000, maxBufferMs: 600000 },
        minRefreshInterval: 30000,
        refreshIfExpired: true,
      });

      expect(authSetup.auth).toBeDefined();
      expect(authSetup.auth.isAuthenticated()).toBe(false);
    });

    it('should accept fixed buffer time as refreshStrategy', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        refreshStrategy: 300000, // 5 minutes fixed
      });

      expect(authSetup.auth).toBeDefined();
    });
  });
});
