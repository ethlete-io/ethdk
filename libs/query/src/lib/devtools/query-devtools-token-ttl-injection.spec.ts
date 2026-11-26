import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createBearerAuthProvider } from '../auth/bearer-auth-provider';
import { withAuthenticationQuery, withRefreshQuery } from '../auth/bearer-auth-query-builders';
import { createPostQuery, createQueryClient, QueryClientRef } from '../http';
import { provideQueryDevtools } from './query-devtools-registry';
import { clearQueryDevtoolsTokenTtl, setQueryDevtoolsTokenTtl } from './query-devtools-token-ttl';

const LOGIN_URL = 'https://api.example.com/auth/login';
const REFRESH_URL = 'https://api.example.com/auth/refresh';

/** A token the default `decryptBearer` reads an `iat`/`exp` pair out of, both in seconds. */
const token = (lifetimeSeconds: number) => {
  const iat = Math.floor(Date.now() / 1000);

  return `header.${btoa(JSON.stringify({ iat, exp: iat + lifetimeSeconds }))}.signature`;
};

describe('query devtools token TTL injection', () => {
  let queryClientRef: QueryClientRef;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();

    queryClientRef = createQueryClient({ baseUrl: 'https://api.example.com', name: 'ttl-test' });

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideQueryDevtools()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    clearQueryDevtoolsTokenTtl();
    vi.useRealTimers();
  });

  const login = (lifetimeSeconds: number) => {
    const postQuery = createPostQuery(queryClientRef);
    const loginQuery = postQuery<{ body: { username: string }; response: { token: string; refresh_token: string } }>(
      '/auth/login',
    );
    const refreshQuery = postQuery<{ body: { token: string }; response: { token: string; refresh_token: string } }>(
      '/auth/refresh',
    );

    const extractTokens = (response: { token: string; refresh_token: string }) => ({
      accessToken: response.token,
      refreshToken: response.refresh_token,
    });

    const { inject: injectAuthProvider } = createBearerAuthProvider({
      name: 'ttl-auth',
      queryClientRef,
      queries: [
        withAuthenticationQuery('login', { queryCreator: loginQuery, extractTokens }),
        withRefreshQuery('refresh', { queryCreator: refreshQuery, extractTokens }),
      ],
    });

    const provider = TestBed.runInInjectionContext(() => injectAuthProvider());

    provider.queries.login.execute({ body: { username: 'test' } });
    TestBed.tick();

    httpTesting.expectOne(LOGIN_URL).flush({ token: token(lifetimeSeconds), refresh_token: 'refresh-1' });
    TestBed.tick();

    return provider;
  };

  it('should refresh on an armed lifetime instead of the one the token was issued with', () => {
    setQueryDevtoolsTokenTtl({ providerName: 'ttl-auth', seconds: 200 });

    login(100_000);

    // 200s of lifetime, floored to a 60s buffer, so the refresh is due 140s in - not in a day and a half.
    vi.advanceTimersByTime(139_000);
    TestBed.tick();
    httpTesting.expectNone(REFRESH_URL);

    vi.advanceTimersByTime(1_000);
    TestBed.tick();
    httpTesting.expectOne(REFRESH_URL).flush({ token: token(100_000), refresh_token: 'refresh-2' });
    TestBed.tick();
  });

  it('should keep applying the armed lifetime to every token a refresh brings back', () => {
    setQueryDevtoolsTokenTtl({ providerName: 'ttl-auth', seconds: 200 });

    login(100_000);

    vi.advanceTimersByTime(140_000);
    TestBed.tick();
    httpTesting.expectOne(REFRESH_URL).flush({ token: token(100_000), refresh_token: 'refresh-2' });
    TestBed.tick();

    vi.advanceTimersByTime(140_000);
    TestBed.tick();
    httpTesting.expectOne(REFRESH_URL).flush({ token: token(100_000), refresh_token: 'refresh-3' });
    TestBed.tick();
  });

  it('should re-arm the schedule of a session that is already logged in', () => {
    login(100_000);

    vi.advanceTimersByTime(140_000);
    TestBed.tick();
    httpTesting.expectNone(REFRESH_URL);

    setQueryDevtoolsTokenTtl({ providerName: 'ttl-auth', seconds: 0 });
    TestBed.tick();

    // The token now reads as expired, which is what makes the refresh happen without waiting at all.
    httpTesting.expectOne(REFRESH_URL).flush({ token: token(100_000), refresh_token: 'refresh-2' });
    TestBed.tick();
  });

  it('should put the session back on the token’s own lifetime when disarmed', () => {
    setQueryDevtoolsTokenTtl({ providerName: 'ttl-auth', seconds: 200 });

    login(100_000);

    clearQueryDevtoolsTokenTtl('ttl-auth');
    TestBed.tick();

    vi.advanceTimersByTime(140_000);
    TestBed.tick();
    httpTesting.expectNone(REFRESH_URL);
  });

  it('should leave another provider on its own lifetime', () => {
    setQueryDevtoolsTokenTtl({ providerName: 'some-other-provider', seconds: 200 });

    login(100_000);

    vi.advanceTimersByTime(140_000);
    TestBed.tick();
    httpTesting.expectNone(REFRESH_URL);
  });

  it('should report the armed lifetime through bearerData', () => {
    setQueryDevtoolsTokenTtl({ providerName: 'ttl-auth', seconds: 200 });

    const provider = login(100_000);
    const data = provider.bearerData() as { iat: number; exp: number };

    expect(data.exp).toBe(data.iat + 200);
  });
});
