import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryDevtoolsAuthProviderHandle } from './query-devtools-hook';
import { setQueryDevtoolsApiEnvs } from './query-devtools-api-envs';
import {
  addQueryDevtoolsAuthAccount,
  clearQueryDevtoolsAuthSessions,
  forgetQueryDevtoolsAuthSession,
  initQueryDevtoolsAuthSessions,
  loginQueryDevtoolsAuthAccount,
  queryDevtoolsAuthAccountsFor,
  queryDevtoolsAuthOtherScopeCount,
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

type Fake = {
  handle: QueryDevtoolsAuthProviderHandle;
  accessToken: ReturnType<typeof signal<string | null>>;
  refreshToken: ReturnType<typeof signal<string | null>>;
  isTabLocalSession: ReturnType<typeof signal<boolean>>;
  logins: unknown[];
  evictions: number;
  unbinds: number;
  stop: () => void;
};

const createProvider = (name: string): Fake => {
  const accessToken = signal<string | null>(null);
  const refreshToken = signal<string | null>(null);
  const isTabLocalSession = signal(false);
  const logins: unknown[] = [];
  const state = { evictions: 0, unbinds: 0 };

  const handle: QueryDevtoolsAuthProviderHandle = {
    accessToken,
    refreshToken,
    setTokens: (access, refresh) => {
      accessToken.set(access);
      refreshToken.set(refresh);
    },
    logout: () => {
      accessToken.set(null);
      refreshToken.set(null);
    },
    queries: { login: { execute: (args: unknown) => logins.push(args) } },
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

    it('should not log in as an account nobody filled in', () => {
      initQueryDevtoolsAuthSessions([{ provider: 'hub-auth', label: 'Admin', loginQuery: 'login' }]);

      const provider = createProvider('hub-auth');

      loginQueryDevtoolsAuthAccount(queryDevtoolsAuthAccountsFor('hub-auth')[0]!.id);

      expect(provider.logins).toEqual([]);
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
});
