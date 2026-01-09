import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { deleteCookie, getCookie, injectRoute, setCookie } from '@ethlete/core';
import { QueryTestSetup, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withCookieTokenStorage } from './bearer-auth-cookie-storage';

vi.mock('@ethlete/core', async () => {
  const actual = await vi.importActual('@ethlete/core');
  return {
    ...actual,
    getCookie: vi.fn(),
    setCookie: vi.fn(),
    deleteCookie: vi.fn(),
    getDomain: vi.fn(() => 'test.com'),
    injectRoute: vi.fn(() => signal('/')),
  };
});

describe('bearer-auth-cookie-storage', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    setup = setupQueryTest({ baseUrl: 'https://api.test.com', name: 'test-auth' });
    vi.clearAllMocks();
  });

  describe('withCookieTokenStorage', () => {
    it('should return a cookie storage feature builder', () => {
      const builder = withCookieTokenStorage({
        autoLogin: {
          queryKey: 'refresh',
          buildArgs: (token) => ({ body: { token } }),
        },
      });

      expect(builder._type).toBe('cookieStorage');
      expect(builder.config).toBeDefined();
      expect(builder.setup).toBeDefined();
    });
  });

  describe('CookieStorageFeature', () => {
    it('should save refresh token to cookie when token is set', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login(
        { username: 'test', password: 'pass' },
        { accessToken: 'access-token', refreshToken: 'refresh-token-123' },
      );

      TestBed.tick();

      expect(setCookie).toHaveBeenCalledWith('testAuth', 'refresh-token-123', 30, 'test.com', '/', 'lax');
    });

    it('should use default cookie name if not provided', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();

      expect(setCookie).toHaveBeenCalledWith('etAuth', 'refresh', 30, 'test.com', '/', 'lax');
    });

    it('should use custom cookie configuration', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'customAuth',
            domain: 'custom.com',
            expiresInDays: 7,
            path: '/app',
            sameSite: 'strict',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();

      expect(setCookie).toHaveBeenCalledWith('customAuth', 'refresh', 7, 'custom.com', '/app', 'strict');
    });

    it('should delete cookie when refresh token is cleared', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();
      vi.clearAllMocks();

      // Clear tokens by logging in with empty refresh token
      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: '' });

      TestBed.tick();

      expect(deleteCookie).toHaveBeenCalledWith('testAuth', '/', 'test.com');
    });

    it('should be enabled by default', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      expect(authSetup.auth.features.cookieStorage?.isEnabled()).toBe(true);
    });

    it('should disable cookie storage and delete cookie when disable is called', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();
      vi.clearAllMocks();

      authSetup.auth.features.cookieStorage?.disable();

      expect(authSetup.auth.features.cookieStorage?.isEnabled()).toBe(false);
      expect(deleteCookie).toHaveBeenCalledWith('testAuth', '/', 'test.com');
    });

    it('should not save cookies when disabled', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.auth.features.cookieStorage?.disable();
      TestBed.tick();
      vi.clearAllMocks();

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();

      expect(setCookie).not.toHaveBeenCalled();
    });

    it('should re-enable cookie storage and save current token', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      authSetup.auth.features.cookieStorage?.disable();
      TestBed.tick();
      vi.clearAllMocks();

      authSetup.auth.features.cookieStorage?.enable();
      TestBed.tick();

      expect(authSetup.auth.features.cookieStorage?.isEnabled()).toBe(true);
      expect(setCookie).toHaveBeenCalledWith('testAuth', 'refresh', 30, 'test.com', '/', 'lax');
    });
  });

  describe('Auto-login', () => {
    it('should attempt auto-login on initialization if cookie exists', () => {
      vi.mocked(getCookie).mockReturnValue('stored-refresh-token');

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
      expect(refreshReq.request.body).toEqual({ token: 'stored-refresh-token' });

      refreshReq.flush({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      TestBed.tick();

      expect(authSetup.auth.accessToken()).toBe('new-access');
      expect(authSetup.auth.refreshToken()).toBe('new-refresh');
    });

    it('should not attempt auto-login if cookie does not exist', () => {
      vi.mocked(getCookie).mockReturnValue(null);

      setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('should support custom buildArgs function', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');

      setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { refreshToken: token, clientId: 'test-client' } }),
            },
          }),
        ],
      });

      const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
      expect(refreshReq.request.body).toEqual({ refreshToken: 'stored-token', clientId: 'test-client' });
    });

    it('should not auto-login on excluded routes', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      vi.mocked(injectRoute).mockReturnValue(signal('/public/landing'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
              excludeRoutes: ['/public', '/login'],
            },
          }),
        ],
      });

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('should auto-login on non-excluded routes', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      vi.mocked(injectRoute).mockReturnValue(signal('/dashboard'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
              excludeRoutes: ['/public', '/login'],
            },
          }),
        ],
      });

      setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
    });

    it('should not auto-login when cookie storage is disabled', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      // Initial auto-login will happen, flush it
      setup.httpTesting.expectOne('https://api.test.com/auth/refresh').flush({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      // Disable and try again
      authSetup.auth.features.cookieStorage?.disable();

      authSetup.auth.features.cookieStorage?.tryLogin();

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('should allow manual tryLogin call', () => {
      vi.mocked(getCookie).mockReturnValue(null);

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withCookieTokenStorage({
            name: 'testAuth',
            autoLogin: {
              queryKey: 'refresh',
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');

      // Now set a cookie and manually try login
      vi.mocked(getCookie).mockReturnValue('manual-token');

      authSetup.auth.features.cookieStorage?.tryLogin();

      const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
      expect(refreshReq.request.body).toEqual({ token: 'manual-token' });
    });
  });
});
