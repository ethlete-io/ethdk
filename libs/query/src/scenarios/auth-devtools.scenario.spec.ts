import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { createEnvironmentInjector, EnvironmentInjector, inject } from '@angular/core';
import { flushMultiTabSync, installFakeBroadcastChannel, installFakeWebLocks } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BearerAuthProviderFeatureContext,
  clearQueryDevtoolsAuthSessions,
  createBearerAuthProvider,
  createGetQuery,
  createPostQuery,
  createQueryClient,
  createSecureGetQuery,
  isQueryDevtoolsEnabled,
  loginQueryDevtoolsAuthAccount,
  provideQueryDevtools,
  queryDevtoolsAuthAccountsFor,
  queryDevtoolsAuthSessionsFor,
  setQueryDevtoolsAuthCredentials,
  setQueryDevtoolsAuthTabLocal,
  withAuthenticationQuery,
  withBearerAuthMultiTabSync,
  withPersistentAuth,
  withRefreshQuery,
} from '../index';
import { decodeToken, mintToken, Scenario, ScenarioAuthBuilders, useScenario } from './harness';

const BASE_URL = 'https://api.test';
const PROVIDER_NAME = 'auth-devtools-scenario';
const ACCOUNT_PROVIDER_NAME = 'auth-devtools-scenario-accounts';

type TokenArgs = { body: { email?: string; token?: string }; response: { accessToken: string; refreshToken: string } };
type Profile = { response: { id: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFeatureBuilder = (context: BearerAuthProviderFeatureContext<any, any>) => { type: string; instance: unknown };

type BootOptions = {
  name?: string;
  accessTokenExpiresInMs?: number;
  refreshStrategy?: number;
  autoRetryOn401?: boolean;
  features?: readonly AnyFeatureBuilder[];
};

type Trace = {
  requests: { method: string; path: string; auth: string | null; status: number | null }[];
  session: { status: string; endCause: string | null; tokens: (string | null)[] };
  extra?: Record<string, unknown>;
};

type Flow = {
  title: string;
  run: (s: Scenario) => Promise<Trace>;
  assert: (trace: Trace) => void;
};

let bootCounter = 0;

const is401 = (entry: { error: unknown }) => entry.error instanceof HttpErrorResponse && entry.error.status === 401;

const subjectOf = (headers: HttpHeaders) => {
  const header = headers.get('Authorization');
  const claims = header ? decodeToken(header.replace('Bearer ', '')) : null;

  return (claims?.['sub'] as string | undefined) ?? 'nobody';
};

/** Login mints a pair whose `sub` is the e-mail, so a response can say which user a request ran as. */
const serve = (s: Scenario, accessTokenExpiresInMs = 15 * 60 * 1000) => {
  const pair = (sub: string) => ({
    accessToken: mintToken({ expiresInMs: accessTokenExpiresInMs, claims: { sub } }),
    refreshToken: mintToken({ expiresInMs: 60 * 60 * 1000, claims: { sub } }),
  });

  s.api.on('POST', '/auth/login', ({ body }) => ({ body: pair((body as TokenArgs['body']).email ?? 'user') }));
  s.api.on('POST', '/auth/refresh', ({ body }) => {
    const claims = decodeToken((body as TokenArgs['body']).token ?? '');

    return { body: pair((claims?.['sub'] as string | undefined) ?? 'user') };
  });
  s.api.protect('/secure/**');
  s.api.on('GET', '/secure/me', ({ headers }) => ({ body: { id: subjectOf(headers) } }));
  s.api.on('GET', '/public/info', () => ({ body: { version: 1 } }));
};

/** One browser tab, or one page load: its own query client and auth provider on the scenario's fake API. */
const boot = (s: Scenario, options: BootOptions = {}) => {
  const clientRef = createQueryClient({
    name: `auth-devtools-client-${++bootCounter}`,
    baseUrl: BASE_URL,
    keepUnusedFor: 0,
  });
  const post = createPostQuery(clientRef);
  const refresh = post<TokenArgs>('/auth/refresh');
  const authRef = createBearerAuthProvider({
    name: options.name ?? PROVIDER_NAME,
    queryClientRef: clientRef,
    queries: [
      withAuthenticationQuery('login', { queryCreator: post<TokenArgs>('/auth/login') }),
      withRefreshQuery('refresh', {
        queryCreator: refresh,
        refreshStrategy: options.refreshStrategy ?? 0.5,
        autoRetryOn401: options.autoRetryOn401 ?? false,
      }),
    ],
    features: (options.features ?? []) as unknown as readonly [],
  });

  const injector = createEnvironmentInjector(
    [...clientRef.provide(), ...authRef.provide()],
    s.run(() => inject(EnvironmentInjector)),
  );
  const auth = injector.runInContext(() => authRef.inject());

  if (!auth) throw new Error('auth devtools scenario: failed to create the auth provider');

  const consumers: EnvironmentInjector[] = [];

  return {
    auth,
    getSecure: createSecureGetQuery(clientRef, authRef),
    get: createGetQuery(clientRef),
    consumer: () => {
      const child = createEnvironmentInjector([], injector);
      consumers.push(child);
      return { run: <T>(fn: () => T) => child.runInContext(fn) };
    },
    destroy: () => {
      for (const child of consumers) child.destroy();
      injector.destroy();
    },
  };
};

type Tab = ReturnType<typeof boot>;

const login = async (s: Scenario, tab: Tab, email = 'a@test') => {
  tab.auth.queries.login.execute({ body: { email } });
  await s.settle();
};

const persistentAuth = () =>
  withPersistentAuth<ScenarioAuthBuilders>({
    autoLogin: { queryKey: 'refresh', buildArgs: (token: string) => ({ body: { token } }) },
  });

const sync = async (s: Scenario) => {
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
  await flushMultiTabSync();
  await s.settle();
};

/** Tokens are renamed by first appearance, so two runs with different minted strings compare equal. */
const traceOf = (s: Scenario, auth: Tab['auth'], extra?: Record<string, unknown>): Trace => {
  const names = new Map<string, string>();
  const nameOf = (token: string | null) => {
    if (!token) return null;
    if (!names.has(token)) names.set(token, `token-${names.size + 1}`);

    return names.get(token) ?? null;
  };

  return {
    requests: s.api.requests.map((request) => ({
      method: request.method,
      path: request.path,
      auth: nameOf(request.headers.get('Authorization')?.replace('Bearer ', '') ?? null),
      status: request.status,
    })),
    session: {
      status: auth.sessionStatus(),
      endCause: auth.sessionEndCause(),
      tokens: [nameOf(auth.accessToken()), nameOf(auth.refreshToken())],
    },
    ...(extra ? { extra } : {}),
  };
};

const deleteCookie = () => {
  document.cookie = 'etAuth=; max-age=0; path=/';
};

const stateOf = (auth: Tab['auth']) => {
  const state = auth.executionState();

  return state ? { type: state.type, state: state.state } : null;
};

const flows: Flow[] = [
  {
    title: 'a login puts the bearer header on a secure query and on nothing else',
    run: async (s) => {
      serve(s);
      const tab = boot(s);
      await login(s, tab);

      const c = tab.consumer();
      const secure = c.run(() => tab.getSecure<Profile>('/secure/me')());
      const open = c.run(() => tab.get<{ response: { version: number } }>('/public/info')());
      await s.settle();

      const trace = traceOf(s, tab.auth, { secure: secure.response(), open: open.response() });

      tab.destroy();

      return trace;
    },
    assert: (trace) => {
      expect(trace.requests).toEqual([
        { method: 'POST', path: '/auth/login', auth: null, status: 200 },
        { method: 'GET', path: '/secure/me', auth: 'token-1', status: 200 },
        { method: 'GET', path: '/public/info', auth: null, status: 200 },
      ]);
      expect(trace.session).toEqual({ status: 'authenticated', endCause: null, tokens: ['token-1', 'token-2'] });
      expect(trace.extra).toEqual({ secure: { id: 'a@test' }, open: { version: 1 } });
    },
  },
  {
    title: 'a proactive refresh rotates the token the next secure request sends',
    run: async (s) => {
      serve(s, 20000);
      const tab = boot(s, { accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });
      await login(s, tab);

      const c = tab.consumer();
      const secure = c.run(() => tab.getSecure<Profile>('/secure/me')());
      await s.settle();

      s.tick(10000);
      await s.settle();
      secure.execute();
      await s.settle();

      const trace = traceOf(s, tab.auth);

      tab.destroy();

      return trace;
    },
    assert: (trace) => {
      expect(trace.requests).toEqual([
        { method: 'POST', path: '/auth/login', auth: null, status: 200 },
        { method: 'GET', path: '/secure/me', auth: 'token-1', status: 200 },
        { method: 'POST', path: '/auth/refresh', auth: null, status: 200 },
        { method: 'GET', path: '/secure/me', auth: 'token-2', status: 200 },
      ]);
      expect(trace.session.status).toBe('authenticated');
      expect(trace.session.tokens[0]).toBe('token-2');
    },
  },
  {
    title: 'a 401 with autoRetryOn401 refreshes once and retries once',
    run: async (s) => {
      serve(s);
      s.api.once('GET', '/secure/me', () => ({ status: 401, body: { message: 'revoked' } }));
      const tab = boot(s, { autoRetryOn401: true });
      await login(s, tab);

      const c = tab.consumer();
      const secure = c.run(() => tab.getSecure<Profile>('/secure/me')());
      s.flush();
      await s.settle();
      s.flush();

      s.expectError(is401);

      const trace = traceOf(s, tab.auth, { secure: secure.response(), error: secure.error() });

      tab.destroy();

      return trace;
    },
    assert: (trace) => {
      expect(trace.requests).toEqual([
        { method: 'POST', path: '/auth/login', auth: null, status: 200 },
        { method: 'GET', path: '/secure/me', auth: 'token-1', status: 401 },
        { method: 'POST', path: '/auth/refresh', auth: null, status: 200 },
        { method: 'GET', path: '/secure/me', auth: 'token-2', status: 200 },
      ]);
      expect(trace.extra).toEqual({ secure: { id: 'a@test' }, error: null });
    },
  },
  {
    title: 'a logout ends the session and drops the secure response',
    run: async (s) => {
      serve(s);
      const tab = boot(s);
      await login(s, tab);

      const c = tab.consumer();
      const secure = c.run(() => tab.getSecure<Profile>('/secure/me')());
      await s.settle();

      tab.auth.logout();
      await s.settle();

      const trace = traceOf(s, tab.auth, { secure: secure.response() });

      tab.destroy();

      return trace;
    },
    assert: (trace) => {
      expect(trace.requests).toHaveLength(2);
      expect(trace.session).toEqual({ status: 'anonymous', endCause: 'user', tokens: [null, null] });
      expect(trace.extra).toEqual({ secure: null });
    },
  },
  {
    title: 'a refresh the server rejects ends the session as expired and refreshes no further',
    run: async (s) => {
      serve(s, 20000);
      s.api.once('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'expired' } }));
      const tab = boot(s, { accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });
      await login(s, tab);

      s.tick(10000);
      await s.settle();
      s.flush();

      s.expectError(is401);

      const trace = traceOf(s, tab.auth);

      tab.destroy();

      return trace;
    },
    assert: (trace) => {
      expect(trace.requests).toEqual([
        { method: 'POST', path: '/auth/login', auth: null, status: 200 },
        { method: 'POST', path: '/auth/refresh', auth: null, status: 401 },
      ]);
      expect(trace.session).toEqual({ status: 'anonymous', endCause: 'expired', tokens: [null, null] });
    },
  },
  {
    title: 'a remember-me cookie restores the session on the next page load',
    run: async (s) => {
      serve(s);
      const first = boot(s, { features: [persistentAuth()] });
      await login(s, first);

      const cookieWritten = document.cookie.includes('etAuth=');

      first.destroy();

      const second = boot(s, { features: [persistentAuth()] });
      await s.settle();
      s.flush();
      await s.settle();

      const trace = traceOf(s, second.auth, { cookieWritten, executionState: stateOf(second.auth) });

      second.destroy();

      return trace;
    },
    assert: (trace) => {
      expect(trace.requests).toEqual([
        { method: 'POST', path: '/auth/login', auth: null, status: 200 },
        { method: 'POST', path: '/auth/refresh', auth: null, status: 200 },
      ]);
      expect(trace.session.status).toBe('authenticated');
      expect(trace.extra).toEqual({ cookieWritten: true, executionState: { type: 'autoLogin', state: 'success' } });
    },
  },
  {
    title: 'a login in one tab is adopted by the other, and its logout ends both',
    run: async (s) => {
      const bus = installFakeBroadcastChannel();
      const locks = installFakeWebLocks();

      try {
        serve(s);
        const a = boot(s, { features: [withBearerAuthMultiTabSync()] });
        const b = boot(s, { features: [withBearerAuthMultiTabSync()] });
        await sync(s);
        s.tick(251);
        await sync(s);

        const anonymousBefore = b.auth.sessionStatus();

        await login(s, a);
        await sync(s);
        s.flush();
        await s.settle();

        const adopted = b.auth.accessToken() === a.auth.accessToken();
        const seedState = stateOf(b.auth);

        a.auth.logout();
        await sync(s);

        const trace = traceOf(s, a.auth, {
          anonymousBefore,
          adopted,
          seedState,
          other: { status: b.auth.sessionStatus(), endCause: b.auth.sessionEndCause() },
        });

        a.destroy();
        b.destroy();

        return trace;
      } finally {
        bus.restore();
        locks.restore();
      }
    },
    assert: (trace) => {
      expect(trace.requests).toEqual([{ method: 'POST', path: '/auth/login', auth: null, status: 200 }]);
      expect(trace.session).toEqual({ status: 'anonymous', endCause: 'user', tokens: [null, null] });
      expect(trace.extra).toEqual({
        anonymousBefore: 'anonymous',
        adopted: true,
        seedState: { type: 'tokenSeed', state: 'success' },
        other: { status: 'anonymous', endCause: 'otherTab' },
      });
    },
  },
];

const recorded = new Map<string, Trace>();

const devtoolsProviders = () => [
  provideQueryDevtools({
    authAccounts: [{ provider: ACCOUNT_PROVIDER_NAME, label: 'Member', loginQuery: 'login' }],
  }),
];

describe('auth flows without the devtools', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  beforeEach(deleteCookie);

  for (const flow of flows) {
    it(flow.title, async () => {
      const s = scenario();

      expect(isQueryDevtoolsEnabled()).toBe(false);

      const trace = await flow.run(s);

      flow.assert(trace);
      recorded.set(flow.title, trace);
    });
  }
});

describe('auth flows with the devtools attached', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: devtoolsProviders });

  beforeEach(() => {
    deleteCookie();
    clearQueryDevtoolsAuthSessions();
  });

  for (const flow of flows) {
    it(`${flow.title}, identically`, async () => {
      const s = scenario();

      expect(isQueryDevtoolsEnabled()).toBe(true);

      const trace = await flow.run(s);

      flow.assert(trace);
      expect(trace).toEqual(recorded.get(flow.title));
    });
  }
});

describe('devtools session vault', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 }, providers: devtoolsProviders });

  beforeEach(() => {
    deleteCookie();
    clearQueryDevtoolsAuthSessions();
  });

  it('a session the server refused is forgotten with its tab-local seed, so the next load starts anonymous and can log in', async () => {
    const s = scenario();
    const name = `${PROVIDER_NAME}-expired`;

    serve(s, 20000);
    s.api.once('POST', '/auth/refresh', () => ({ status: 401, body: { message: 'expired' } }));

    const first = boot(s, { name, accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });
    await login(s, first);

    const deadAccessToken = first.auth.accessToken();

    setQueryDevtoolsAuthTabLocal({ provider: name, tabLocal: true });

    expect(queryDevtoolsAuthSessionsFor(name)).toHaveLength(1);

    s.tick(10000);
    await s.settle();
    s.flush();
    s.expectError(is401);

    expect(first.auth.sessionEndCause()).toBe('expired');
    expect(queryDevtoolsAuthSessionsFor(name)).toHaveLength(0);

    first.destroy();

    const requestsBeforeReload = s.api.requests.length;
    const second = boot(s, { name, accessTokenExpiresInMs: 20000, refreshStrategy: 0.5 });
    await s.settle();
    s.flush();

    expect(second.auth.sessionStatus()).toBe('anonymous');
    expect(second.auth.accessToken()).toBeNull();
    expect(s.api.requests.slice(requestsBeforeReload)).toEqual([]);

    await login(s, second, 'b@test');

    expect(second.auth.sessionStatus()).toBe('authenticated');
    expect(second.auth.accessToken()).not.toBe(deadAccessToken);
    expect(s.api.requests.slice(requestsBeforeReload).map((request) => request.status)).toEqual([200]);

    second.destroy();
  });

  it('a shared session is kept in the vault but never seeded into the next page load', async () => {
    const s = scenario();
    const name = `${PROVIDER_NAME}-shared`;

    serve(s);

    const first = boot(s, { name });
    await login(s, first);
    first.destroy();

    const requestsBeforeReload = s.api.requests.length;
    const second = boot(s, { name });
    await s.settle();
    s.flush();

    expect(queryDevtoolsAuthSessionsFor(name)).toHaveLength(1);
    expect(second.auth.sessionStatus()).toBe('anonymous');
    expect(s.api.requests.slice(requestsBeforeReload)).toEqual([]);

    second.destroy();
  });

  it('log in as drops the previous user only once the new tokens are in force, so no secure query re-runs as the old user', async () => {
    const s = scenario();

    serve(s);

    const tab = boot(s, { name: ACCOUNT_PROVIDER_NAME });
    await login(s, tab, 'a@test');

    const c = tab.consumer();
    const secure = c.run(() => tab.getSecure<Profile>('/secure/me')());
    await s.settle();

    expect(secure.response()).toEqual({ id: 'a@test' });

    const tokenOfA = tab.auth.accessToken();
    const [account] = queryDevtoolsAuthAccountsFor(ACCOUNT_PROVIDER_NAME);

    if (!account) throw new Error('auth devtools scenario: the declared account is missing');

    setQueryDevtoolsAuthCredentials({ accountId: account.id, values: { email: 'b@test', password: 'secret' } });

    const requestsBeforeSwitch = s.api.requests.length;

    loginQueryDevtoolsAuthAccount(account.id);
    await s.settle();
    s.flush();
    await s.settle();

    const afterSwitch = s.api.requests.slice(requestsBeforeSwitch);
    const secureAfterSwitch = afterSwitch.filter((request) => request.path === '/secure/me');

    expect(afterSwitch[0]).toMatchObject({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'b@test', password: 'secret' },
    });
    expect(secureAfterSwitch.length).toBeGreaterThan(0);
    expect(
      secureAfterSwitch.every((request) => request.headers.get('Authorization') === `Bearer ${tab.auth.accessToken()}`),
    ).toBe(true);
    expect(secureAfterSwitch.some((request) => request.headers.get('Authorization') === `Bearer ${tokenOfA}`)).toBe(
      false,
    );
    expect(secure.response()).toEqual({ id: 'b@test' });
    expect(queryDevtoolsAuthSessionsFor(ACCOUNT_PROVIDER_NAME)).toHaveLength(2);

    tab.destroy();
  });

  it('a tab that owns its session stands down the cookie auto-login and writes no cookie on refresh', async () => {
    const s = scenario();
    const name = `${PROVIDER_NAME}-own-tab`;

    serve(s, 20000);

    const first = boot(s, { name, accessTokenExpiresInMs: 20000, refreshStrategy: 0.5, features: [persistentAuth()] });
    await login(s, first);

    setQueryDevtoolsAuthTabLocal({ provider: name, tabLocal: true });
    first.destroy();

    const cookieBefore = document.cookie;

    expect(cookieBefore).toContain('etAuth=');

    const second = boot(s, { name, accessTokenExpiresInMs: 20000, refreshStrategy: 0.5, features: [persistentAuth()] });
    await s.settle();
    s.flush();

    expect(second.auth.sessionStatus()).toBe('authenticated');
    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(0);

    s.tick(10000);
    await s.settle();

    expect(s.api.requestCount('POST', '/auth/refresh')).toBe(1);
    expect(document.cookie).toBe(cookieBefore);

    second.destroy();
  });
});
