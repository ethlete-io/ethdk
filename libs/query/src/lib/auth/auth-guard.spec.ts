import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { getCookie, getDomain, injectRoute } from '@ethlete/core';
import { createPostQuery, createQueryClient, QueryClientRef } from '../http';
import { AuthGuardConfig, createAuthGuard } from './auth-guard';
import { createBearerAuthProvider } from './bearer-auth-provider';
import { withAuthenticationQuery } from './bearer-auth-query-builders';
import { withPersistentAuth } from './features';
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

@Component({ template: 'home' })
class HomeComponent {}

@Component({ template: 'login' })
class LoginComponent {}

@Component({ template: 'protected' })
class ProtectedComponent {}

type SetupOptions = {
  /** Adds `withPersistentAuth`, so injecting the provider starts a session restore. */
  persistent?: boolean;

  /** Guards the login route with `canMatchAnonymous`. */
  guardLoginRoute?: boolean;

  guard?: Partial<AuthGuardConfig>;
};

/** Let the guard's pending observable emit and the navigation promise chain settle. */
const settle = async () => {
  TestBed.tick();
  await new Promise((r) => setTimeout(r));
  TestBed.tick();
};

describe('createAuthGuard', () => {
  let queryClientRef: QueryClientRef;
  let httpTesting: HttpTestingController;

  const setup = async (options: SetupOptions = {}) => {
    queryClientRef = createQueryClient({ baseUrl: 'https://api.example.com', name: 'guard-test' });

    const postQuery = createPostQuery(queryClientRef);
    const login = postQuery<{
      body: { token: string };
      response: { accessToken: string; refreshToken: string };
    }>('/auth/login');

    const providerRef = createBearerAuthProvider({
      name: 'guard-test-auth',
      queryClientRef,
      queries: [withAuthenticationQuery('login', { queryCreator: login })],
      features: options.persistent
        ? [withPersistentAuth({ autoLogin: { queryKey: 'login', buildArgs: (token) => ({ body: { token } }) } })]
        : [],
    });

    const guard = createAuthGuard(providerRef, { loginUrl: '/login', defaultUrl: '/home', ...options.guard });

    const routes: Routes = [
      { path: '', component: HomeComponent },
      { path: 'home', component: HomeComponent },
      { path: 'login', component: LoginComponent, canMatch: options.guardLoginRoute ? [guard.canMatchAnonymous] : [] },
      { path: 'protected', component: ProtectedComponent, canMatch: [guard.canMatch] },
    ];

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    });

    httpTesting = TestBed.inject(HttpTestingController);

    const harness = await RouterTestingHarness.create();
    const injector = TestBed.inject(Injector);
    const router = TestBed.inject(Router);

    return { guard, harness, injector, providerRef, router };
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.mocked(getCookie).mockReturnValue(null);
    vi.mocked(getDomain).mockReturnValue('localhost');
    vi.mocked(injectRoute).mockReturnValue(signal('/'));
  });

  afterEach(() => {
    httpTesting.verify();
    vi.clearAllMocks();
  });

  it('sends a visitor without a session to the login URL, carrying the attempted URL', async () => {
    const { harness, router } = await setup();

    await harness.navigateByUrl('/protected?tab=2#top');

    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe('/protected?tab=2#top');
    expect(router.url.startsWith('/login')).toBe(true);
  });

  it('redirects without a return URL when returnUrlParam is false', async () => {
    const { harness, router } = await setup({ guard: { returnUrlParam: false } });

    await harness.navigateByUrl('/protected');

    expect(router.url).toBe('/login');
  });

  it('uses a custom return URL param', async () => {
    const { harness, router } = await setup({ guard: { returnUrlParam: 'go' } });

    await harness.navigateByUrl('/protected');

    expect(router.parseUrl(router.url).queryParams['go']).toBe('/protected');
  });

  it('lets a visitor with a session through', async () => {
    const { harness, injector, providerRef, router } = await setup();

    runInInjectionContext(injector, () => providerRef.inject().setTokens('access', 'refresh'));

    await harness.navigateByUrl('/protected');

    expect(router.url).toBe('/protected');
  });

  it('pends while a session restore is in flight instead of redirecting', async () => {
    vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));
    resetEncryptionKey();

    const { harness, injector, providerRef, router } = await setup({ persistent: true });

    const provider = runInInjectionContext(injector, () => providerRef.inject());
    expect(provider.sessionStatus()).toBe('restoring');

    const navigation = harness.navigateByUrl('/protected');

    httpTesting.expectOne('https://api.example.com/auth/login').flush({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    await settle();
    await navigation;

    expect(router.url).toBe('/protected');
  });

  it('redirects once a session restore fails', async () => {
    vi.mocked(getCookie).mockReturnValue(encryptToken('stored-refresh-token'));
    resetEncryptionKey();

    const { harness, injector, providerRef, router } = await setup({ persistent: true });

    runInInjectionContext(injector, () => providerRef.inject());

    const navigation = harness.navigateByUrl('/protected');

    httpTesting
      .expectOne('https://api.example.com/auth/login')
      .flush({ message: 'nope' }, { status: 401, statusText: 'Unauthorized' });
    await settle();
    await navigation;

    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe('/protected');
  });

  it('keeps a visitor with a session off the login route, sending them to the return URL', async () => {
    const { harness, injector, providerRef, router } = await setup({ guardLoginRoute: true });

    runInInjectionContext(injector, () => providerRef.inject().setTokens('access', 'refresh'));

    await harness.navigateByUrl('/login?returnUrl=%2Fprotected');

    expect(router.url).toBe('/protected');
  });

  it('falls back to defaultUrl when there is no return URL', async () => {
    const { harness, injector, providerRef, router } = await setup({ guardLoginRoute: true });

    runInInjectionContext(injector, () => providerRef.inject().setTokens('access', 'refresh'));

    await harness.navigateByUrl('/login');

    expect(router.url).toBe('/home');
  });

  it('ignores a return URL that points outside the app', async () => {
    const { harness, injector, providerRef, router } = await setup({ guardLoginRoute: true });

    runInInjectionContext(injector, () => providerRef.inject().setTokens('access', 'refresh'));

    await harness.navigateByUrl('/login?returnUrl=%2F%2Fevil.example.com');

    expect(router.url).toBe('/home');
  });

  it('leaves an anonymous visitor on the login route', async () => {
    const { harness, router } = await setup({ guardLoginRoute: true });

    await harness.navigateByUrl('/login');

    expect(router.url).toBe('/login');
  });

  it('reads the return URL back and navigates to it after login', async () => {
    const { guard, harness, injector, providerRef, router } = await setup();

    await harness.navigateByUrl('/home?returnUrl=%2Fprotected');

    expect(runInInjectionContext(injector, () => guard.returnUrl())).toBe('/protected');

    runInInjectionContext(injector, () => providerRef.inject().setTokens('access', 'refresh'));
    runInInjectionContext(injector, () => guard.navigateAfterLogin()).subscribe();
    await settle();

    expect(router.url).toBe('/protected');
  });

  it('navigates to defaultUrl after login when nothing was captured', async () => {
    const { guard, harness, injector, router } = await setup();

    await harness.navigateByUrl('/login');
    runInInjectionContext(injector, () => guard.navigateAfterLogin()).subscribe();
    await settle();

    expect(router.url).toBe('/home');
  });
});
