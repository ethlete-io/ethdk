import { TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { withPersistentAuth } from '@ethlete/query';
import { setupAuthTest } from './auth-test-utils';
import { setupQueryTest } from './query-test-setup';
import { mintTestToken } from './token-test-utils';

describe('setupAuthTest', () => {
  const refreshBodyOf = (options: { buildRefreshArgs?: (token: string) => { body: Record<string, unknown> } }) => {
    const querySetup = setupQueryTest({ name: 'auth-test-utils' });
    const expectOne = vi.spyOn(querySetup.httpTesting, 'expectOne');
    const { refresh } = setupAuthTest({ querySetup, ...options });

    refresh('refresh-123', { accessToken: 'access', refreshToken: 'next' });

    return (expectOne.mock.results.at(-1)?.value as TestRequest).request.body;
  };

  it('sends the refresh token as { body: { token } } by default', () => {
    expect(refreshBodyOf({})).toEqual({ token: 'refresh-123' });
  });

  it('builds the refresh request with buildRefreshArgs, like the real provider', () => {
    expect(refreshBodyOf({ buildRefreshArgs: (token) => ({ body: { refresh_token: token } }) })).toEqual({
      refresh_token: 'refresh-123',
    });
  });

  it('types features against its login and refresh queries, like createBearerAuthProvider', () => {
    const querySetup = setupQueryTest({ name: 'auth-test-utils-types' });

    const { auth } = setupAuthTest({
      querySetup,
      features: [
        withPersistentAuth({
          cookie: { name: 'typed' },
          autoLogin: { queryKey: 'refresh', buildArgs: (token) => ({ body: { token } }) },
        }),
      ],
    });

    expect(auth.features.persistentAuth).toBeDefined();

    TestBed.resetTestingModule();

    setupAuthTest({
      querySetup: setupQueryTest({ name: 'auth-test-utils-typo' }),
      // @ts-expect-error - 'refersh' is not a query key of the test provider
      features: [withPersistentAuth({ cookie: { name: 'typo' }, autoLogin: { queryKey: 'refersh' } })],
    });
  });

  it('refreshes and retries a secure request that answers 401 by default, like production', () => {
    const querySetup = setupQueryTest({ name: 'auth-test-utils-401' });
    const { auth, makeSecureRequest } = setupAuthTest({ querySetup });

    TestBed.runInInjectionContext(() => auth.setTokens(mintTestToken(), 'refresh-1'));
    TestBed.tick();

    makeSecureRequest('/secure');
    querySetup.httpTesting
      .expectOne(`${querySetup.baseUrl}/secure`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    TestBed.tick();

    querySetup.httpTesting
      .expectOne(`${querySetup.baseUrl}/auth/refresh`)
      .flush({ accessToken: mintTestToken(), refreshToken: 'refresh-2' });
    TestBed.tick();

    expect(auth.refreshToken()).toBe('refresh-2');
  });
});
