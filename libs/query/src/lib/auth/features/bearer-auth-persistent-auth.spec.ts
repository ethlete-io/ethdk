import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { deleteCookie, getCookie, injectRoute, setCookie } from '@ethlete/core';
import { QueryTestSetup, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptToken } from '../utils';
import { withPersistentAuth } from './bearer-auth-persistent-auth';

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

describe('bearer-auth-persistent-auth', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    setup = setupQueryTest({ baseUrl: 'https://api.test.com', name: 'test-auth' });
    vi.clearAllMocks();
  });

  describe('PersistentAuthFeature', () => {
    it('should save refresh token to cookie when token is set', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
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

      expect(setCookie).toHaveBeenCalledWith('testAuth', encryptToken('refresh-token-123'), 30, 'test.com', '/', 'lax');
    });

    it('should use default cookie name if not provided', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();

      expect(setCookie).toHaveBeenCalledWith('etAuth', encryptToken('refresh'), 30, 'test.com', '/', 'lax');
    });

    it('should use custom cookie configuration', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: {
              name: 'customAuth',
              domain: 'custom.com',
              expiresInDays: 7,
              path: '/app',
              sameSite: 'strict',
            },
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();

      expect(setCookie).toHaveBeenCalledWith('customAuth', encryptToken('refresh'), 7, 'custom.com', '/app', 'strict');
    });

    it('should delete cookie on logout', () => {
      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();
      vi.clearAllMocks();

      authSetup.auth.logout();

      TestBed.tick();

      expect(deleteCookie).toHaveBeenCalledWith('testAuth', '/', 'test.com');
    });

    it('should keep the cookie while the auto-login it triggered is still in flight', () => {
      vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      setup.httpTesting.expectOne('https://api.test.com/auth/refresh');

      TestBed.tick();

      expect(deleteCookie).not.toHaveBeenCalled();
    });

    it('should delete the cookie when the server rejects the stored token', () => {
      vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      setup.httpTesting
        .expectOne('https://api.test.com/auth/refresh')
        .flush({ message: 'Invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

      TestBed.tick();

      expect(deleteCookie).toHaveBeenCalledWith('testAuth', '/', 'test.com');
    });

    it('should keep the cookie when the auto-login fails without the server rejecting the token', () => {
      vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      setup.httpTesting
        .expectOne('https://api.test.com/auth/refresh')
        .flush({ message: 'Nope' }, { status: 500, statusText: 'Internal Server Error' });

      TestBed.tick();

      expect(deleteCookie).not.toHaveBeenCalled();
    });

    it('should default to rememberMe=false when no config, preference, or cookie exists', () => {
      vi.mocked(getCookie).mockReturnValue(null);
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      expect(authSetup.auth.features.persistentAuth?.rememberMe()).toBe(false);
    });

    it('should use defaultRememberMe config when no preference or cookie exists', () => {
      vi.mocked(getCookie).mockReturnValue(null);
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            defaultRememberMe: true,
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      expect(authSetup.auth.features.persistentAuth?.rememberMe()).toBe(true);
    });

    it('should infer rememberMe=true when cookie exists but no preference stored', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      expect(authSetup.auth.features.persistentAuth?.rememberMe()).toBe(true);
    });

    it('should use localStorage preference over cookie existence', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => 'false'),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      expect(authSetup.auth.features.persistentAuth?.rememberMe()).toBe(false);
    });

    it('should change to session cookie when setRememberMe(false) is called', () => {
      vi.mocked(getCookie).mockReturnValue(null);
      const localStorageMock = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            defaultRememberMe: true, // Start with rememberMe=true
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();
      vi.clearAllMocks();

      authSetup.auth.features.persistentAuth?.setRememberMe(false);
      TestBed.tick();

      expect(authSetup.auth.features.persistentAuth?.rememberMe()).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('testAuth-rememberMe', 'false');
      // Should set session cookie (no expiry)
      expect(setCookie).toHaveBeenCalledWith('testAuth', encryptToken('refresh'), null, 'test.com', '/', 'lax');
    });

    it('should save session cookie (no expiry) when rememberMe=false', () => {
      vi.mocked(getCookie).mockReturnValue(null);
      const localStorageMock = {
        getItem: vi.fn(() => 'false'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();

      expect(setCookie).toHaveBeenCalledWith('testAuth', encryptToken('refresh'), null, 'test.com', '/', 'lax');
    });

    it('should change to persistent cookie when setRememberMe(true) is called', () => {
      vi.mocked(getCookie).mockReturnValue(null);
      const localStorageMock = {
        getItem: vi.fn(() => 'false'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      authSetup.login({ username: 'test', password: 'pass' }, { accessToken: 'access', refreshToken: 'refresh' });

      TestBed.tick();
      vi.clearAllMocks();

      authSetup.auth.features.persistentAuth?.setRememberMe(true);
      TestBed.tick();

      expect(authSetup.auth.features.persistentAuth?.rememberMe()).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('testAuth-rememberMe', 'true');
      // Should set persistent cookie with expiry
      expect(setCookie).toHaveBeenCalledWith('testAuth', encryptToken('refresh'), 30, 'test.com', '/', 'lax');
    });
  });

  describe('Auto-login', () => {
    it('should attempt auto-login on initialization if cookie exists', () => {
      vi.mocked(getCookie).mockReturnValue('stored-refresh-token');

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
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
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
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
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
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
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
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
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
              excludeRoutes: ['/public', '/login'],
            },
          }),
        ],
      });

      setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
    });

    it('should not auto-login when shouldAutoLogin refuses the route', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      vi.mocked(injectRoute).mockReturnValue(signal('/reset-password?token=abc'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
              shouldAutoLogin: (url) => new URL(url, 'https://test.com').pathname !== '/reset-password',
            },
          }),
        ],
      });

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('should auto-login on a route the predicate allows but a prefix list would have caught', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      vi.mocked(injectRoute).mockReturnValue(signal('/reset-password-templates'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
              shouldAutoLogin: (url) => new URL(url, 'https://test.com').pathname !== '/reset-password',
            },
          }),
        ],
      });

      setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
    });

    it('should let excludeRoutes veto a route the predicate allows', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      vi.mocked(injectRoute).mockReturnValue(signal('/public/landing'));

      setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
              excludeRoutes: ['/public'],
              shouldAutoLogin: () => true,
            },
          }),
        ],
      });

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');
    });

    it('should still auto-login even when rememberMe=false (session cookie)', () => {
      vi.mocked(getCookie).mockReturnValue('stored-token');
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => 'false'),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      // Auto-login should happen even with rememberMe=false
      const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
      expect(refreshReq.request.body).toEqual({ token: 'stored-token' });
    });

    it('should allow manual tryLogin call', () => {
      vi.mocked(getCookie).mockReturnValue(null);

      const authSetup = setupAuthTest({
        querySetup: setup,
        features: [
          withPersistentAuth({
            cookie: { name: 'testAuth' },
            autoLogin: {
              queryKey: 'refresh',
              // @ts-expect-error - Type inference issue in setupAuthTest
              buildArgs: (token) => ({ body: { token } }),
            },
          }),
        ],
      });

      setup.httpTesting.expectNone('https://api.test.com/auth/refresh');

      // Now set a cookie and manually try login
      vi.mocked(getCookie).mockReturnValue('manual-token');

      authSetup.auth.features.persistentAuth?.tryLogin();

      const refreshReq = setup.httpTesting.expectOne('https://api.test.com/auth/refresh');
      expect(refreshReq.request.body).toEqual({ token: 'manual-token' });
    });
  });
});
