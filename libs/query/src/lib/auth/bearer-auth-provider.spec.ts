import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createQueryClient, QueryClientRef } from '../http';
import { createBearerAuthProvider } from './bearer-auth-provider';

describe('createBearerAuthProvider', () => {
  let queryClientRef: QueryClientRef;

  beforeEach(() => {
    queryClientRef = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('should create a bearer auth provider tuple', () => {
    const authProvider = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
    });

    expect(authProvider).toBeTruthy();
    expect(Array.isArray(authProvider)).toBe(true);
    expect(authProvider.length).toBe(3);
  });

  it('should provide inject function in tuple', () => {
    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
    });

    expect(typeof injectAuthProvider).toBe('function');

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(provider).toBeTruthy();
      expect(provider.login).toBeDefined();
      expect(provider.logout).toBeDefined();
      expect(provider.tokens).toBeDefined();
      expect(provider.bearerData).toBeDefined();
    });
  });

  it('should provide injection token in tuple', () => {
    const [, , token] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
    });

    expect(token).toBeTruthy();
  });

  it('should create provider with default configuration', () => {
    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
    });

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(provider.latestExecutedQuery()).toBeNull();
      expect(provider.tokens()).toBeNull();
      expect(provider.bearerData()).toBeNull();
    });
  });

  it('should provide all required methods', () => {
    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
    });

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(typeof provider.login).toBe('function');
      expect(typeof provider.loginWithToken).toBe('function');
      expect(typeof provider.refreshToken).toBe('function');
      expect(typeof provider.selectRole).toBe('function');
      expect(typeof provider.logout).toBe('function');
      expect(typeof provider.enableCookie).toBe('function');
      expect(typeof provider.disableCookie).toBe('function');
      expect(typeof provider.isCookiePresent).toBe('function');
      expect(typeof provider.tryLoginWithCookie).toBe('function');
    });
  });

  it('should provide all required signals', () => {
    const [, injectAuthProvider] = createBearerAuthProvider({
      name: 'test-auth',
      queryClientRef,
    });

    TestBed.runInInjectionContext(() => {
      const provider = injectAuthProvider();

      expect(typeof provider.latestExecutedQuery).toBe('function');
      expect(typeof provider.tokens).toBe('function');
      expect(typeof provider.bearerData).toBe('function');
    });
  });
});
