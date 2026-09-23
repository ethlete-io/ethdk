import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryDevtoolsAuthProviderHandle } from './query-devtools-hook';
import { setQueryDevtoolsApiEnvs } from './query-devtools-api-envs';
import {
  addQueryDevtoolsAuthAccount,
  clearQueryDevtoolsAuthSessions,
  forgetQueryDevtoolsAuthSession,
  forgetQueryDevtoolsAuthSessionsFor,
  initQueryDevtoolsAuthSessions,
  loginQueryDevtoolsAuthAccount,
  queryDevtoolsAuthAccountsFor,
  queryDevtoolsAuthActive,
  queryDevtoolsAuthFieldsFor,
  queryDevtoolsAuthOtherScopeCount,
  queryDevtoolsAuthProviders,
  queryDevtoolsAuthSessions,
  queryDevtoolsAuthSessionsFor,
  queryDevtoolsAuthTabLocal,
  readQueryDevtoolsAuthSeedFor,
  renameQueryDevtoolsAuthSession,
  setQueryDevtoolsAuthCredentials,
  setQueryDevtoolsAuthTabLocal,
  switchQueryDevtoolsAuthSession,
  trackQueryDevtoolsAuthProvider,
} from './query-devtools-auth-sessions';
import { initQueryDevtoolsSettings, setQueryDevtoolsSettings } from './query-devtools-settings';

const HUB = {
  name: 'Hub API',
  storageKey: 'hubApiEnv',
  fallback: 'staging',
  envs: [{ id: 'staging' }, { id: 'local' }, { id: 'production', production: true }],
};

/** A JWT whose payload is readable but whose signature is not checked by anything under test. */
const token = (payload: Record<string, unknown>) =>
  `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=/g, '')}.signature`;

const ADMIN = token({ sub: 'admin-1', name: 'Admin', exp: 4000 });
const MEMBER = token({ sub: 'member-1', name: 'Member', exp: 5000 });

/** A backend whose access token names nobody: no `sub` to recognise a session by, and no name to show. */
const NAMELESS = token({ exp: 6000 });

/** A backend that names who is logged in but issues no `sub`, which is what the hub API does. */
const NAMED = token({ name: 'Admin', exp: 6000 });
const NAMED_AGAIN = token({ name: 'Admin', exp: 7000 });
const NAMED_OTHER = token({ name: 'Member', exp: 7000 });

const STORE_KEY = 'ethlete:query:devtools:auth:v1';
const ACTIVE_KEY = 'ethlete:query:devtools:auth-active:v1';

/** What `isDevMode()` reads. A production build of an application sets it to `false`. */
const withProductionBuild = (run: () => void) => {
  const globals = globalThis as Record<string, unknown>;
  const previous = globals['ngDevMode'];

  globals['ngDevMode'] = false;

  try {
    run();
  } finally {
    globals['ngDevMode'] = previous;
  }
};

type Fake = {
  handle: QueryDevtoolsAuthProviderHandle;
  accessToken: ReturnType<typeof signal<string | null>>;
  refreshToken: ReturnType<typeof signal<string | null>>;
  sessionEndCause: ReturnType<typeof signal<string | null>>;
  isTabLocalSession: ReturnType<typeof signal<boolean>>;
  logins: unknown[];
  evictions: number;
  unbinds: number;
  stop: () => void;
};

const createProvider = (name: string): Fake => {
  const accessToken = signal<string | null>(null);
  const refreshToken = signal<string | null>(null);
  const sessionEndCause = signal<string | null>(null);
  const isTabLocalSession = signal(false);
  const logins: unknown[] = [];
  const state = { evictions: 0, unbinds: 0 };

  const handle: QueryDevtoolsAuthProviderHandle = {
    accessToken,
    refreshToken,
    setTokens: (access, refresh) => {
      accessToken.set(access);
      refreshToken.set(refresh);
      sessionEndCause.set(null);
    },
    logout: () => {
      accessToken.set(null);
      refreshToken.set(null);
      sessionEndCause.set('user');
    },
    sessionEndCause,
    queries: {
      login: {
        execute: (args: unknown) => {
          logins.push(args);

          // The vault reads the snapshot `execute` hands back, to let go of a login that failed.
          return { isAlive: signal(false), error: signal(null) };
        },
      },
    },
  };

  const client = {
    baseUrl: 'https://staging.example.com',
    clearPersistedQueries: () => Promise.resolve(),
    repository: {
      unbindAllSecure: () => state.unbinds++,
      subtle: {
        cacheEntries: () => [{ key: 'a' }, { key: 'b' }],
        evict: () => state.evictions++,
      },
    },
  };

  const stop = TestBed.runInInjectionContext(() =>
    trackQueryDevtoolsAuthProvider({
      name,
      handle,
      // The vault needs a repository and the two clear calls, not a whole client.
      client: client as never,
      isTabLocalSession,
      injector: TestBed.inject(Injector),
    }),
  );

  return {
    handle,
    accessToken,
    refreshToken,
    sessionEndCause,
    isTabLocalSession,
    logins,
    get evictions() {
      return state.evictions;
    },
    get unbinds() {
      return state.unbinds;
    },
    stop,
  };
};

const flush = () => TestBed.tick();

/** Ends a session the way a refresh that failed for good does. */
const expire = (provider: Fake) => {
  provider.accessToken.set(null);
  provider.refreshToken.set(null);
  provider.sessionEndCause.set('expired');
  flush();
};

describe('query devtools auth sessions', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    initQueryDevtoolsSettings();
    setQueryDevtoolsSettings({ reloadOnAuthSwitch: false });
    setQueryDevtoolsApiEnvs([HUB]);
    clearQueryDevtoolsAuthSessions();
    initQueryDevtoolsAuthSessions([]);
  });

  it('should keep the tokens of a plain login out of web storage outside a development build', () => {
    withProductionBuild(() => {
      initQueryDevtoolsSettings();
      initQueryDevtoolsAuthSessions([]);

      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();

      expect(queryDevtoolsAuthSessionsFor('hub-auth').length).toBe(1);
      expect(localStorage.getItem(STORE_KEY)).toBeNull();
      expect(sessionStorage.getItem(STORE_KEY)).toBeNull();
      expect(sessionStorage.getItem(ACTIVE_KEY)).toBeNull();

      provider.stop();
    });
  });

  it('should keep the vault in sessionStorage outside a development build once session is picked', () => {
    withProductionBuild(() => {
      setQueryDevtoolsSettings({ authSessions: 'session' });
      initQueryDevtoolsAuthSessions([]);

      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();

      expect(localStorage.getItem(STORE_KEY)).toBeNull();
      expect(sessionStorage.getItem(STORE_KEY)).not.toBeNull();

      provider.stop();
    });
  });

  it('should drop a vault an earlier build left in either store outside a development build', () => {
    const leftover = JSON.stringify({ sessions: [], credentials: { a: { password: 'x' } } });

    localStorage.setItem(STORE_KEY, leftover);
    sessionStorage.setItem(STORE_KEY, leftover);
    sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ 'hub-auth': 'session-1' }));

    withProductionBuild(() => {
      initQueryDevtoolsSettings();
      initQueryDevtoolsAuthSessions([]);

      expect(localStorage.getItem(STORE_KEY)).toBeNull();
      expect(sessionStorage.getItem(STORE_KEY)).toBeNull();
      expect(sessionStorage.getItem(ACTIVE_KEY)).toBeNull();
    });
  });

  it('should drop the copy a former scope left in the other store', () => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ sessions: [], credentials: {} }));

    initQueryDevtoolsAuthSessions([]);

    expect(sessionStorage.getItem(STORE_KEY)).toBeNull();
  });

  it('should forget a session that expired, tokens and all', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();

    expire(provider);

    expect(queryDevtoolsAuthSessionsFor('hub-auth')).toEqual([]);
  });

  it('should keep a session the user logged out of', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();

    provider.handle.logout();
    flush();

    expect(queryDevtoolsAuthSessionsFor('hub-auth').length).toBe(1);
  });

  it('should hold nothing until a provider has a session', () => {
    createProvider('hub-auth');

    expect(queryDevtoolsAuthSessionsFor('hub-auth')).toEqual([]);
  });

  it('should remember a session the application logged in on its own', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();

    const sessions = queryDevtoolsAuthSessionsFor('hub-auth');

    expect(sessions.length).toBe(1);
    expect(sessions[0]).toMatchObject({ label: 'Admin', subject: 'admin-1', refreshToken: 'refresh-1' });
  });

  it('should follow a rotated refresh token rather than keeping the spent one', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();
    provider.handle.setTokens(ADMIN, 'refresh-2');
    flush();

    expect(queryDevtoolsAuthSessionsFor('hub-auth').map((session) => session.refreshToken)).toEqual(['refresh-2']);
  });

  it('should recognise a subject it already holds instead of storing it twice', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();
    provider.handle.logout();
    flush();
    provider.handle.setTokens(ADMIN, 'refresh-3');
    flush();

    expect(queryDevtoolsAuthSessionsFor('hub-auth').length).toBe(1);
  });

  it('should keep the second user beside the first', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();
    provider.handle.logout();
    flush();
    provider.handle.setTokens(MEMBER, 'refresh-2');
    flush();

    expect(queryDevtoolsAuthSessionsFor('hub-auth').map((session) => session.label)).toEqual(['Admin', 'Member']);
  });

  it('should recognise a pair it already holds where the token names nobody', () => {
    const first = createProvider('hub-auth');

    first.handle.setTokens(NAMELESS, 'refresh-1');
    flush();
    first.stop();

    // A new tab: which session the live tokens belong to is the tab's own answer, and this tab has none.
    sessionStorage.clear();
    initQueryDevtoolsAuthSessions([]);

    const second = createProvider('hub-auth');

    second.handle.setTokens(NAMELESS, 'refresh-1');
    flush();

    expect(queryDevtoolsAuthSessionsFor('hub-auth').length).toBe(1);
  });

  it('should keep one session where the token names nobody and the pair was rotated since', () => {
    const first = createProvider('hub-auth');

    first.handle.setTokens(NAMELESS, 'refresh-1');
    flush();
    first.stop();

    sessionStorage.clear();
    initQueryDevtoolsAuthSessions([]);

    const second = createProvider('hub-auth');

    second.handle.setTokens(NAMELESS, 'refresh-2');
    flush();

    const sessions = queryDevtoolsAuthSessionsFor('hub-auth');

    expect(sessions.length).toBe(1);
    expect(sessions[0]?.refreshToken).toBe('refresh-2');
  });

  it('should put a stored session in force, and drop what the last user cached', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();
    const admin = queryDevtoolsAuthSessionsFor('hub-auth')[0]!;

    provider.handle.setTokens(MEMBER, 'refresh-2');
    flush();

    switchQueryDevtoolsAuthSession({ sessionId: admin.id, reload: false });
    flush();

    expect(provider.accessToken()).toBe(ADMIN);
    expect(provider.refreshToken()).toBe('refresh-1');
    expect(provider.evictions).toBe(2);
    expect(provider.unbinds).toBe(1);
  });

  it('should keep the live provider when a same-named one is torn down', () => {
    const first = createProvider('hub-auth');
    const second = createProvider('hub-auth');

    first.stop();

    second.handle.setTokens(ADMIN, 'refresh-1');
    flush();
    second.handle.logout();
    flush();

    const session = queryDevtoolsAuthSessionsFor('hub-auth')[0]!;

    switchQueryDevtoolsAuthSession({ sessionId: session.id, reload: false });
    flush();

    expect(queryDevtoolsAuthProviders()).toContain('hub-auth');
    expect(second.accessToken()).toBe(ADMIN);
    expect(second.unbinds).toBe(1);
  });

  it('should offer a session only on the backend that issued it', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();

    localStorage.setItem('hubApiEnv', 'local');
    setQueryDevtoolsApiEnvs([HUB]);

    expect(queryDevtoolsAuthSessionsFor('hub-auth')).toEqual([]);
    expect(queryDevtoolsAuthOtherScopeCount('hub-auth')).toBe(1);
  });

  it('should refuse to store anything while production is the pick', () => {
    localStorage.setItem('hubApiEnv', 'production');
    setQueryDevtoolsApiEnvs([HUB]);

    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();

    expect(queryDevtoolsAuthSessionsFor('hub-auth')).toEqual([]);
  });

  it('should rename and forget a stored session', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();
    const session = queryDevtoolsAuthSessionsFor('hub-auth')[0]!;

    renameQueryDevtoolsAuthSession({ sessionId: session.id, label: 'The admin' });

    expect(queryDevtoolsAuthSessionsFor('hub-auth')[0]?.label).toBe('The admin');

    forgetQueryDevtoolsAuthSession(session.id);

    expect(queryDevtoolsAuthSessionsFor('hub-auth')).toEqual([]);
  });

  it('should survive a reload through the store', () => {
    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();

    initQueryDevtoolsAuthSessions([]);

    expect(queryDevtoolsAuthSessionsFor('hub-auth').map((session) => session.label)).toEqual(['Admin']);
  });

  it('should keep nothing at all on a scope of none', () => {
    setQueryDevtoolsSettings({ authSessions: 'none' });

    const provider = createProvider('hub-auth');

    provider.handle.setTokens(ADMIN, 'refresh-1');
    flush();
    initQueryDevtoolsAuthSessions([]);

    expect(queryDevtoolsAuthSessionsFor('hub-auth')).toEqual([]);
  });

  describe('accounts', () => {
    it('should declare no account of an env it does not exist on', () => {
      initQueryDevtoolsAuthSessions([
        { provider: 'hub-auth', label: 'Admin', loginQuery: 'login' },
        { provider: 'hub-auth', label: 'Local only', loginQuery: 'login', envs: ['local'] },
      ]);

      expect(queryDevtoolsAuthAccountsFor('hub-auth').map((account) => account.label)).toEqual(['Admin']);
    });

    it('should offer no account at all while production is the pick', () => {
      localStorage.setItem('hubApiEnv', 'production');
      setQueryDevtoolsApiEnvs([HUB]);
      initQueryDevtoolsAuthSessions([{ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' }]);

      expect(queryDevtoolsAuthAccountsFor('hub-auth')).toEqual([]);
    });

    it('should read as not ready until its credentials are typed in', () => {
      initQueryDevtoolsAuthSessions([{ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' }]);

      const account = queryDevtoolsAuthAccountsFor('hub-auth')[0]!;

      expect(account.ready).toBe(false);

      setQueryDevtoolsAuthCredentials({
        accountId: account.id,
        values: { email: 'admin@example.com', password: 'hunter2' },
      });

      expect(queryDevtoolsAuthAccountsFor('hub-auth')[0]?.ready).toBe(true);
    });

    it('should log in through the provider query, with what was typed in', () => {
      initQueryDevtoolsAuthSessions([{ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' }]);

      const provider = createProvider('hub-auth');
      const account = queryDevtoolsAuthAccountsFor('hub-auth')[0]!;

      setQueryDevtoolsAuthCredentials({
        accountId: account.id,
        values: { email: 'admin@example.com', password: 'hunter2' },
      });
      loginQueryDevtoolsAuthAccount(account.id);

      expect(provider.logins).toEqual([{ body: { email: 'admin@example.com', password: 'hunter2' } }]);
    });

    it('should drop what the last user cached only once the login is in force', () => {
      // A provider of its own: an account login left pending by an earlier test would clear on this
      // one's first token pair.
      const provider = createProvider('vault-auth');
      const id = addQueryDevtoolsAuthAccount({ provider: 'vault-auth', label: 'Member', loginQuery: 'login' });

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'member@example.com', password: 'x' } });
      provider.handle.setTokens(NAMED, 'refresh-1');
      flush();

      loginQueryDevtoolsAuthAccount(id);

      // Unbinding here re-arms every secure query that auto-executes, on the token the previous user
      // still holds - and its answer is then cached for the user logging in.
      expect(provider.unbinds).toBe(0);
      expect(provider.evictions).toBe(0);

      provider.handle.setTokens(NAMED_OTHER, 'refresh-2');
      flush();

      expect(provider.unbinds).toBe(1);
      expect(provider.evictions).toBe(2);
    });

    it('should name a session after the account it was logged in as, and reuse it', () => {
      const provider = createProvider('hub-auth');
      const id = addQueryDevtoolsAuthAccount({ provider: 'hub-auth', label: 'Tester', loginQuery: 'login' });

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'tester@example.com', password: 'x' } });

      loginQueryDevtoolsAuthAccount(id);
      provider.handle.setTokens(NAMELESS, 'refresh-1');
      flush();

      expect(queryDevtoolsAuthSessionsFor('hub-auth').map((session) => session.label)).toEqual(['Tester']);

      loginQueryDevtoolsAuthAccount(id);
      provider.handle.setTokens(NAMELESS, 'refresh-2');
      flush();

      const sessions = queryDevtoolsAuthSessionsFor('hub-auth');

      expect(sessions.length).toBe(1);
      expect(sessions[0]?.refreshToken).toBe('refresh-2');
    });

    it('should log an account in on top of the plain login of the same user', () => {
      const provider = createProvider('hub-auth');
      const id = addQueryDevtoolsAuthAccount({ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' });

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'admin@example.com', password: 'x' } });

      provider.handle.setTokens(NAMED, 'refresh-1');
      flush();

      loginQueryDevtoolsAuthAccount(id);
      provider.handle.logout();
      flush();
      provider.handle.setTokens(NAMED_AGAIN, 'refresh-2');
      flush();

      const sessions = queryDevtoolsAuthSessionsFor('hub-auth');

      expect(sessions.length).toBe(1);
      expect(sessions[0]?.refreshToken).toBe('refresh-2');
    });

    it('should keep the plain login of another user beside an account login', () => {
      const provider = createProvider('hub-auth');
      const id = addQueryDevtoolsAuthAccount({ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' });

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'admin@example.com', password: 'x' } });

      provider.handle.setTokens(NAMED_OTHER, 'refresh-1');
      flush();

      loginQueryDevtoolsAuthAccount(id);
      provider.handle.logout();
      flush();
      provider.handle.setTokens(NAMED, 'refresh-2');
      flush();

      expect(queryDevtoolsAuthSessionsFor('hub-auth').length).toBe(2);
    });

    it('should forget every session of one provider and keep the accounts', () => {
      const provider = createProvider('hub-auth');
      const id = addQueryDevtoolsAuthAccount({ provider: 'hub-auth', label: 'Tester', loginQuery: 'login' });

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'tester@example.com', password: 'x' } });
      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();

      forgetQueryDevtoolsAuthSessionsFor('hub-auth');

      expect(queryDevtoolsAuthSessionsFor('hub-auth')).toEqual([]);
      expect(queryDevtoolsAuthAccountsFor('hub-auth').map((account) => account.label)).toEqual(['Tester']);
      expect(queryDevtoolsAuthAccountsFor('hub-auth')[0]?.ready).toBe(true);
    });

    it('should not log in as an account nobody filled in', () => {
      initQueryDevtoolsAuthSessions([{ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' }]);

      const provider = createProvider('hub-auth');

      loginQueryDevtoolsAuthAccount(queryDevtoolsAuthAccountsFor('hub-auth')[0]!.id);

      expect(provider.logins).toEqual([]);
    });

    it('should send the field names the application declares, not email and password', () => {
      initQueryDevtoolsAuthSessions([
        {
          provider: 'hub-auth',
          label: 'Admin',
          loginQuery: 'login',
          fields: [
            { name: 'username', label: 'E-mail', type: 'email', default: 'admin@example.com' },
            { name: 'password', type: 'password' },
          ],
        },
      ]);

      const id = addQueryDevtoolsAuthAccount({ provider: 'hub-auth', label: 'Tester', loginQuery: 'login' });
      const account = queryDevtoolsAuthAccountsFor('hub-auth').find((entry) => entry.id === id);

      expect(account?.fields.map((field) => field.name)).toEqual(['username', 'password']);
      expect(account?.values).toEqual({ username: '', password: '' });
    });

    it('should keep the field names an account was added with', () => {
      const id = addQueryDevtoolsAuthAccount({
        provider: 'hub-auth',
        label: 'Tester',
        loginQuery: 'login',
        fields: [{ name: 'handle' }, { name: 'secret', type: 'password' }],
      });
      const provider = createProvider('hub-auth');

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { handle: 'tester', secret: 'x' } });
      loginQueryDevtoolsAuthAccount(id);

      expect(provider.logins).toEqual([{ body: { handle: 'tester', secret: 'x' } }]);
    });

    it('should keep an account added in the panel with the backend it was added on', () => {
      createProvider('hub-auth');

      addQueryDevtoolsAuthAccount({ provider: 'hub-auth', label: 'Ad hoc', loginQuery: 'login' });

      expect(queryDevtoolsAuthAccountsFor('hub-auth').map((account) => account.label)).toEqual(['Ad hoc']);

      localStorage.setItem('hubApiEnv', 'local');
      setQueryDevtoolsApiEnvs([HUB]);

      expect(queryDevtoolsAuthAccountsFor('hub-auth')).toEqual([]);
    });
  });

  describe('a second tab', () => {
    it('should read what another tab stored rather than overwriting it', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();

      const fromOtherTab = JSON.stringify({
        sessions: [
          ...JSON.parse(localStorage.getItem('ethlete:query:devtools:auth:v1')!).sessions,
          {
            id: 'session-from-b',
            provider: 'hub-auth',
            label: 'Member',
            scope: 'hubApiEnv=staging',
            accessToken: MEMBER,
            refreshToken: 'refresh-9',
            subject: 'member-1',
            expiresAt: 5000,
            savedAt: 1,
          },
        ],
        credentials: {},
        accounts: [],
      });

      localStorage.setItem('ethlete:query:devtools:auth:v1', fromOtherTab);
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'ethlete:query:devtools:auth:v1', newValue: fromOtherTab }),
      );

      expect(queryDevtoolsAuthSessionsFor('hub-auth').map((session) => session.label)).toEqual(['Admin', 'Member']);

      provider.handle.setTokens(ADMIN, 'refresh-2');
      flush();

      const stored = JSON.parse(localStorage.getItem('ethlete:query:devtools:auth:v1')!);

      expect(stored.sessions.map((session: { label: string }) => session.label)).toEqual(['Admin', 'Member']);
    });

    it('should keep which session is in force out of the shared store', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();

      expect(JSON.parse(localStorage.getItem('ethlete:query:devtools:auth:v1')!).active).toBeUndefined();
      expect(sessionStorage.getItem('ethlete:query:devtools:auth-active:v1')).not.toBeNull();
    });
  });

  describe('a session of one tab', () => {
    it('should hand the seeded tokens to a provider being built, and mark the tab', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'hub-auth', tabLocal: true });

      expect(readQueryDevtoolsAuthSeedFor('hub-auth')).toEqual({ accessToken: ADMIN, refreshToken: 'refresh-1' });
      expect(queryDevtoolsAuthTabLocal()['hub-auth']).toBe(true);
    });

    it('should drop a seed the backend changed under', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'hub-auth', tabLocal: true });

      localStorage.setItem('hubApiEnv', 'local');
      setQueryDevtoolsApiEnvs([HUB]);

      expect(readQueryDevtoolsAuthSeedFor('hub-auth')).toBeNull();
    });

    it('should keep the seed in step with a rotated refresh token', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'hub-auth', tabLocal: true });
      provider.handle.setTokens(ADMIN, 'refresh-2');
      flush();

      expect(readQueryDevtoolsAuthSeedFor('hub-auth')?.refreshToken).toBe('refresh-2');
    });

    it('should hand the tab back on rejoining', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'hub-auth', tabLocal: true });
      setQueryDevtoolsAuthTabLocal({ provider: 'hub-auth', tabLocal: false });

      expect(readQueryDevtoolsAuthSeedFor('hub-auth')).toBeNull();
    });

    it('should drop the seed of a session that expired, so a reload starts anonymous', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'hub-auth', tabLocal: true });

      expire(provider);

      expect(readQueryDevtoolsAuthSeedFor('hub-auth')).toBeNull();
    });

    it('should tell the provider its session is its own', () => {
      const provider = createProvider('hub-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'hub-auth', tabLocal: true });
      readQueryDevtoolsAuthSeedFor('hub-auth');

      const next = createProvider('hub-auth');

      expect(next.isTabLocalSession()).toBe(true);
    });
  });

  describe('reading what it is handed', () => {
    it('should store a token it cannot decode under a generic name and without an expiry', () => {
      const provider = createProvider('opaque-auth');

      provider.handle.setTokens('opaque-access-token', 'refresh-1');
      flush();

      expect(queryDevtoolsAuthSessionsFor('opaque-auth')[0]).toMatchObject({
        label: 'session',
        subject: null,
        expiresAt: null,
      });
    });

    it('should ignore an expiry claim that is not a number', () => {
      const provider = createProvider('odd-exp-auth');

      provider.handle.setTokens(token({ sub: 'user-1', exp: 'never' }), 'refresh-1');
      flush();

      expect(queryDevtoolsAuthSessionsFor('odd-exp-auth')[0]).toMatchObject({ label: 'user-1', expiresAt: null });
    });

    it('should drop stored sessions it cannot read, and fill in what an older build left out', () => {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          sessions: [
            null,
            'not a session',
            { id: 'missing-tokens', provider: 'hub-auth' },
            { id: 'old-build', provider: 'hub-auth', accessToken: ADMIN, refreshToken: 'refresh-1' },
          ],
        }),
      );

      initQueryDevtoolsAuthSessions([]);

      expect(queryDevtoolsAuthSessions()).toEqual([
        {
          id: 'old-build',
          provider: 'hub-auth',
          label: 'old-build',
          scope: 'default',
          accessToken: ADMIN,
          refreshToken: 'refresh-1',
          subject: null,
          identity: null,
          account: null,
          expiresAt: null,
          savedAt: 0,
        },
      ]);
    });

    it('should ignore storage events for other keys, and empty the vault when another tab clears it', () => {
      const provider = createProvider('cleared-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();

      window.dispatchEvent(new StorageEvent('storage', { key: 'something-else', newValue: '{}' }));

      expect(queryDevtoolsAuthSessionsFor('cleared-auth').length).toBe(1);

      window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY, newValue: null }));

      expect(queryDevtoolsAuthSessions()).toEqual([]);
    });
  });

  describe('keeping sessions apart', () => {
    it('should keep two accounts in two slots even where their tokens name the same person', () => {
      const provider = createProvider('twin-auth');
      const first = addQueryDevtoolsAuthAccount({ provider: 'twin-auth', label: 'First', loginQuery: 'login' });
      const second = addQueryDevtoolsAuthAccount({ provider: 'twin-auth', label: 'Second', loginQuery: 'login' });

      setQueryDevtoolsAuthCredentials({ accountId: first, values: { email: 'a@example.com', password: 'x' } });
      setQueryDevtoolsAuthCredentials({ accountId: second, values: { email: 'b@example.com', password: 'x' } });

      loginQueryDevtoolsAuthAccount(first);
      provider.handle.setTokens(NAMED, 'refresh-1');
      flush();

      loginQueryDevtoolsAuthAccount(second);
      provider.handle.setTokens(NAMED_AGAIN, 'refresh-2');
      flush();

      expect(queryDevtoolsAuthSessionsFor('twin-auth').map((session) => [session.label, session.refreshToken])).toEqual(
        [
          ['Admin', 'refresh-1'],
          ['Admin', 'refresh-2'],
        ],
      );
    });

    it('should keep the sessions of another backend when a production session expires', () => {
      const staging = createProvider('env-auth');

      staging.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      staging.stop();

      localStorage.setItem('hubApiEnv', 'production');
      setQueryDevtoolsApiEnvs([HUB]);
      initQueryDevtoolsAuthSessions([]);

      const production = createProvider('env-auth');

      flush();
      production.handle.setTokens(MEMBER, 'refresh-2');
      flush();
      expire(production);

      localStorage.setItem('hubApiEnv', 'staging');
      setQueryDevtoolsApiEnvs([HUB]);

      expect(queryDevtoolsAuthSessionsFor('env-auth').map((session) => session.refreshToken)).toEqual(['refresh-1']);
    });

    it('should refuse to keep credentials while production is the pick', () => {
      initQueryDevtoolsAuthSessions([{ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' }]);

      const id = queryDevtoolsAuthAccountsFor('hub-auth')[0]!.id;

      localStorage.setItem('hubApiEnv', 'production');
      setQueryDevtoolsApiEnvs([HUB]);
      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'real@example.com', password: 'secret' } });

      localStorage.setItem('hubApiEnv', 'staging');
      setQueryDevtoolsApiEnvs([HUB]);

      expect(queryDevtoolsAuthAccountsFor('hub-auth')[0]?.ready).toBe(false);
      expect(localStorage.getItem(STORE_KEY) ?? '').not.toContain('secret');
    });

    it('should offer the fields of the first declared account when no login query is named', () => {
      initQueryDevtoolsAuthSessions([
        { provider: 'hub-auth', label: 'Plain', loginQuery: 'login' },
        { provider: 'hub-auth', label: 'Handle', loginQuery: 'signin', fields: [{ name: 'handle', label: 'Handle' }] },
      ]);

      expect(queryDevtoolsAuthFieldsFor('hub-auth').map((field) => field.name)).toEqual(['handle']);
    });

    it('should rename and forget one session without touching the others', () => {
      const hub = createProvider('rename-auth');
      const shop = createProvider('rename-shop-auth');

      hub.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      hub.handle.setTokens(MEMBER, 'refresh-2');
      flush();
      shop.handle.setTokens(ADMIN, 'refresh-3');
      flush();

      const [admin, member] = queryDevtoolsAuthSessionsFor('rename-auth');

      renameQueryDevtoolsAuthSession({ sessionId: admin!.id, label: 'The admin' });

      expect(queryDevtoolsAuthSessionsFor('rename-auth').map((session) => session.label)).toEqual([
        'The admin',
        'Member',
      ]);

      forgetQueryDevtoolsAuthSession(admin!.id);

      expect(queryDevtoolsAuthActive()['rename-auth']).toBe(member!.id);

      forgetQueryDevtoolsAuthSessionsFor('rename-auth');

      expect(queryDevtoolsAuthActive()['rename-auth']).toBeNull();
      expect(queryDevtoolsAuthActive()['rename-shop-auth']).toBe(
        queryDevtoolsAuthSessionsFor('rename-shop-auth')[0]!.id,
      );
    });
  });

  describe('switching and logging in', () => {
    it('should not switch to a session it does not hold, of another backend, or of a provider that is gone', () => {
      const provider = createProvider('switch-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      const admin = queryDevtoolsAuthSessionsFor('switch-auth')[0]!;

      provider.handle.setTokens(MEMBER, 'refresh-2');
      flush();

      switchQueryDevtoolsAuthSession({ sessionId: 'no-such-session', reload: false });

      localStorage.setItem('hubApiEnv', 'local');
      setQueryDevtoolsApiEnvs([HUB]);
      switchQueryDevtoolsAuthSession({ sessionId: admin.id, reload: false });

      localStorage.setItem('hubApiEnv', 'staging');
      setQueryDevtoolsApiEnvs([HUB]);
      provider.stop();
      switchQueryDevtoolsAuthSession({ sessionId: admin.id, reload: false });

      expect(provider.accessToken()).toBe(MEMBER);
      expect(provider.unbinds).toBe(0);
    });

    it('should follow a switch with the seed of a tab that owns its session', () => {
      const provider = createProvider('seeded-switch-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      const admin = queryDevtoolsAuthSessionsFor('seeded-switch-auth')[0]!;

      provider.handle.setTokens(MEMBER, 'refresh-2');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'seeded-switch-auth', tabLocal: true });
      readQueryDevtoolsAuthSeedFor('seeded-switch-auth');

      switchQueryDevtoolsAuthSession({ sessionId: admin.id });

      expect(readQueryDevtoolsAuthSeedFor('seeded-switch-auth')).toEqual({
        accessToken: ADMIN,
        refreshToken: 'refresh-1',
      });
    });

    it('should not log in through a query the provider does not have', () => {
      initQueryDevtoolsAuthSessions([{ provider: 'no-query-auth', label: 'Admin', loginQuery: 'signin' }]);

      const provider = createProvider('no-query-auth');
      const id = queryDevtoolsAuthAccountsFor('no-query-auth')[0]!.id;

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'a@example.com', password: 'x' } });
      loginQueryDevtoolsAuthAccount(id);

      expect(provider.logins).toEqual([]);
      expect(queryDevtoolsAuthActive()['no-query-auth']).toBeUndefined();
    });

    it('should not make a tab own a session it does not hold', () => {
      createProvider('anonymous-auth');
      setQueryDevtoolsAuthTabLocal({ provider: 'anonymous-auth', tabLocal: true });

      expect(readQueryDevtoolsAuthSeedFor('anonymous-auth')).toBeNull();

      localStorage.setItem('hubApiEnv', 'production');
      setQueryDevtoolsApiEnvs([HUB]);

      const production = createProvider('production-auth');

      production.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      setQueryDevtoolsAuthTabLocal({ provider: 'production-auth', tabLocal: true });

      expect(readQueryDevtoolsAuthSeedFor('production-auth')).toBeNull();
    });
  });

  describe('the floating pill', () => {
    const selectOf = (providerName: string) => {
      const shadow = document.getElementById('et-query-devtools-pill')?.shadowRoot;
      const pill = [...(shadow?.querySelectorAll('.pill') ?? [])].find(
        (element) => element.querySelector('.name')?.textContent === providerName,
      );

      return pill?.querySelector('select') ?? null;
    };

    const pick = (select: HTMLSelectElement | null, value: string) => {
      if (!select) throw new Error('pill row not rendered');

      select.value = value;
      select.dispatchEvent(new Event('change'));
    };

    it('should tell same-named sessions apart by when they were saved', () => {
      const provider = createProvider('pill-names-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      provider.handle.setTokens(MEMBER, 'refresh-2');
      flush();

      const member = queryDevtoolsAuthSessionsFor('pill-names-auth')[1];

      renameQueryDevtoolsAuthSession({ sessionId: member!.id, label: 'Admin' });

      const labels = [...(selectOf('pill-names-auth')?.options ?? [])]
        .filter((option) => option.value.startsWith('session:'))
        .map((option) => option.textContent);

      expect(labels).toHaveLength(2);
      expect(labels.every((label) => label?.startsWith('Admin · ') && label !== 'Admin · unknown')).toBe(true);
    });

    it('should mark a stored session an older build saved without a time', () => {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          sessions: ['one', 'two'].map((id) => ({
            id,
            provider: 'pill-old-auth',
            label: 'Admin',
            scope: 'hubApiEnv=staging',
            accessToken: ADMIN,
            refreshToken: `refresh-${id}`,
          })),
        }),
      );
      initQueryDevtoolsAuthSessions([]);
      createProvider('pill-old-auth');

      const labels = [...(selectOf('pill-old-auth')?.options ?? [])]
        .filter((option) => option.value.startsWith('session:'))
        .map((option) => option.textContent);

      expect(labels).toEqual(['Admin · unknown', 'Admin · unknown']);
    });

    it('should switch to the session picked in the pill', () => {
      const provider = createProvider('pill-switch-auth');

      provider.handle.setTokens(ADMIN, 'refresh-1');
      flush();
      const admin = queryDevtoolsAuthSessionsFor('pill-switch-auth')[0]!;

      provider.handle.setTokens(MEMBER, 'refresh-2');
      flush();

      pick(selectOf('pill-switch-auth'), `session:${admin.id}`);

      expect(provider.accessToken()).toBe(ADMIN);
    });

    it('should log in as the account picked in the pill', () => {
      initQueryDevtoolsAuthSessions([{ provider: 'pill-login-auth', label: 'Admin', loginQuery: 'login' }]);

      const provider = createProvider('pill-login-auth');
      const id = queryDevtoolsAuthAccountsFor('pill-login-auth')[0]!.id;

      setQueryDevtoolsAuthCredentials({ accountId: id, values: { email: 'admin@example.com', password: 'x' } });
      pick(selectOf('pill-login-auth'), `account:${id}`);

      expect(provider.logins).toEqual([{ body: { email: 'admin@example.com', password: 'x' } }]);
    });
  });
});
