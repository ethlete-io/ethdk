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

  describe('withRefreshQuery - Auto-retry on 401', () => {
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
});
