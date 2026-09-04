import { HttpErrorResponse } from '@angular/common/http';
import {
  createBearerAuthProvider,
  createSecureGetQuery,
  TokenRefreshQueryConfig,
  withAuthenticationQuery,
  withRefreshQuery,
} from '../index';
import { describe, expect, it } from 'vitest';
import { mintToken, Scenario, useScenario } from './harness';

type TokenArgs = { body: Record<string, unknown>; response: { accessToken: string; refreshToken: string } };

let providerCounter = 0;

/**
 * Unlike `s.auth()`, leaves `extractTokens` to the provider's default - the one that validates the
 * response shape - unless a scenario hands in its own.
 */
const createAuth = (
  s: Scenario,
  config: Omit<TokenRefreshQueryConfig<TokenArgs>, 'queryCreator'> & { accessTokenExpiresInMs?: number } = {},
) => {
  const { accessTokenExpiresInMs = 15 * 60 * 1000, ...refreshConfig } = config;
  const issue = () => ({
    body: {
      accessToken: mintToken({ expiresInMs: accessTokenExpiresInMs }),
      refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000 }),
    },
  });

  s.api.on('POST', '/auth/login', issue);
  s.api.on('POST', '/auth/refresh', issue);

  const ref = createBearerAuthProvider({
    name: `auth-lifecycle-${++providerCounter}`,
    queryClientRef: s.clientRef,
    queries: [
      withAuthenticationQuery('login', {
        queryCreator: s.post<TokenArgs>('/auth/login'),
        extractTokens: refreshConfig.extractTokens,
      }),
      withRefreshQuery('refresh', { queryCreator: s.post<TokenArgs>('/auth/refresh'), ...refreshConfig }),
    ],
  });

  const provider = s.run(() => ref.inject());

  if (!provider) throw new Error('auth lifecycle scenario: failed to create the auth provider');

  return Object.assign(provider, { ref });
};

describe('auth token lifecycle scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('every way a token pair arrives emits afterTokenRefresh$ exactly once', async () => {
    const s = scenario();
    const auth = s.auth({ autoRetryOn401: true });
    const emissions: string[] = [];
    const subscription = auth.afterTokenRefresh$.subscribe(() => emissions.push(auth.accessToken() ?? 'null'));

    s.api.protect('/secure/**');
    s.api.on('GET', '/secure/profile', () => ({ body: { id: 'me' } }));
    s.api.once('GET', '/secure/profile', () => ({ status: 401, body: { message: 'revoked' } }));

    const getSecureProfile = createSecureGetQuery(
      s.clientRef,
      auth.ref,
    )<{ response: { id: string } }>('/secure/profile');

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();
    expect(emissions).toHaveLength(1);

    c.run(() => getSecureProfile());
    s.flush();
    await s.settle();
    s.flush();
    await s.settle();
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(emissions).toHaveLength(2);

    s.run(() => auth.queries.refresh.execute({ body: { token: auth.refreshToken()! } }));
    await s.settle();
    expect(emissions).toHaveLength(3);

    s.run(() => auth.setTokens(mintToken({ expiresInMs: 600000 }), mintToken({ expiresInMs: 3600000 })));
    await s.settle();
    expect(emissions).toHaveLength(4);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 401);
    subscription.unsubscribe();
    c.destroy();
  });
});

describe('auth refresh failure scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('a refresh whose response carries no tokens ends the session like a rejected refresh', async () => {
    const s = scenario();
    const auth = createAuth(s, { accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });

    s.api.once('POST', '/auth/refresh', () => ({ body: { unexpected: true } }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.isAuthenticated()).toBe(true);

    s.tick(10000);
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.executionState()).toEqual({ type: 'logout', state: 'success' });
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('expired');
    expect(auth.accessToken()).toBeNull();

    s.expectError(/Failed to extract tokens/);

    c.destroy();
  });

  it('a custom extractTokens that hands back no token strings is treated as a failed refresh, not a session', async () => {
    const s = scenario();
    const auth = createAuth(s, {
      accessTokenExpiresInMs: 20000,
      refreshStrategy: 0.5,
      extractTokens: (response) => ({
        accessToken: (response as { data?: { accessToken: string } }).data?.accessToken as string,
        refreshToken: (response as { data?: { refreshToken: string } }).data?.refreshToken as string,
      }),
    });

    s.api.once('POST', '/auth/login', () => ({
      body: {
        data: { accessToken: mintToken({ expiresInMs: 20000 }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
      },
    }));

    const c = s.consumer();
    c.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    expect(auth.isAuthenticated()).toBe(true);

    s.tick(10000);
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.sessionStatus()).toBe('anonymous');
    expect(auth.sessionEndCause()).toBe('expired');
    expect(auth.accessToken()).toBeNull();
    expect(auth.refreshToken()).toBeNull();

    s.expectError(/Failed to extract tokens/);

    c.destroy();
  });
});
