import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { getCookie, getDomain, injectRoute } from '@ethlete/core';
import { createPostQuery, createQueryClient, QueryClientRef } from '../../http';
import { createBearerAuthProvider } from '../bearer-auth-provider';
import { withAuthenticationQuery } from '../bearer-auth-query-builders';
import { withTokenRevocation } from './bearer-auth-token-revocation';

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

describe('bearer-auth-token-revocation', () => {
  let queryClientRef: QueryClientRef;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();

    queryClientRef = createQueryClient({ baseUrl: 'https://api.test.com', name: 'test' });

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
  });

  describe('TokenRevocationFeature', () => {
    it('should return a token revocation feature builder', () => {
      const feature = withTokenRevocation({
        queryKey: 'revoke',
        buildArgs: (tokens) => ({
          body: { token: tokens.accessToken ?? '' },
        }),
      });

      expect(feature._type).toBe('tokenRevocation');
      expect(feature.config).toBeDefined();
      expect(feature.setup).toBeDefined();
    });

    it('should create auth provider with revocation feature', () => {
      const createPost = createPostQuery(queryClientRef);

      const loginQuery = createPost<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const revokeQuery = createPost<{
        body: { token: string };
        response: void;
      }>('/auth/revoke');

      const [, injectAuth] = createBearerAuthProvider({
        name: 'test',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: loginQuery,
          }),
          withAuthenticationQuery('revoke', {
            queryCreator: revokeQuery,
          }),
        ],
        features: [
          withTokenRevocation({
            queryKey: 'revoke',
            buildArgs: (tokens) => ({
              body: { token: tokens.accessToken ?? '' },
            }),
            revokeOnLogout: false,
          }),
        ],
        multiTabSync: false,
      });

      const auth = TestBed.runInInjectionContext(() => injectAuth());

      expect(auth).toBeDefined();
      expect(auth.features.tokenRevocation).toBeDefined();
      expect(auth.features.tokenRevocation.enabled()).toBe(true);

      auth.features.tokenRevocation.disable();
      expect(auth.features.tokenRevocation.enabled()).toBe(false);

      auth.features.tokenRevocation.enable();
      expect(auth.features.tokenRevocation.enabled()).toBe(true);
    });

    it('should manually revoke token using the registered query', async () => {
      const createPost = createPostQuery(queryClientRef);

      const loginQuery = createPost<{
        body: { username: string };
        response: { accessToken: string; refreshToken: string };
      }>('/auth/login');

      const revokeQuery = createPost<{
        body: { token: string };
        response: void;
      }>('/auth/revoke');

      const [, injectAuth] = createBearerAuthProvider({
        name: 'test',
        queryClientRef,
        queries: [
          withAuthenticationQuery('login', {
            queryCreator: loginQuery,
          }),
          withAuthenticationQuery('revoke', {
            queryCreator: revokeQuery,
          }),
        ],
        features: [
          withTokenRevocation({
            queryKey: 'revoke',
            buildArgs: (tokens) => ({
              body: { token: tokens.accessToken ?? '' },
            }),
            revokeOnLogout: false,
          }),
        ],
        multiTabSync: false,
      });

      const auth = TestBed.runInInjectionContext(() => injectAuth());

      // Login first
      auth.queries.login.execute({ body: { username: 'test' } });
      httpTesting.expectOne('https://api.test.com/auth/login').flush({
        accessToken: 'token',
        refreshToken: 'refresh',
      });
      TestBed.tick();

      // Revoke
      const promise = auth.features.tokenRevocation.revoke();
      TestBed.tick();

      const req = httpTesting.expectOne('https://api.test.com/auth/revoke');
      expect(req.request.body).toEqual({ token: 'token' });
      req.flush(null);
      TestBed.tick();

      await promise;
    });
  });
});
