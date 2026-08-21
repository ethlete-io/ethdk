import { computed, effect, Signal, signal, untracked } from '@angular/core';
import { decryptBearer } from '../http/internal/request-route';
import {
  queryDevtoolsApiEnvIds,
  queryDevtoolsApiEnvIsProduction,
  queryDevtoolsApiEnvScope,
} from './query-devtools-api-envs';
import { QueryDevtoolsAuthProviderRegistration, QueryDevtoolsAuthSeed } from './query-devtools-hook';
import { setQueryDevtoolsAuthPill } from './query-devtools-pills';
import {
  queryDevtoolsSettings,
  queryDevtoolsStorage,
  readQueryDevtoolsStore,
  writeQueryDevtoolsStore,
} from './query-devtools-settings';

/** One field a declared login needs, collected in the panel rather than committed to the repository. */
export type QueryDevtoolsAuthField = {
  /** The key this field's value goes under when the login args are built. */
  name: string;

  /** Shown instead of {@link name}, where the name alone does not read well. */
  label?: string;

  /** `password` masks the input. Nothing typed here is ever sent anywhere but the login query. */
  type?: 'text' | 'email' | 'password';

  /** A value that is safe in the repository, for example a shared dev address. Prefilled and editable. */
  default?: string;
};

/**
 * One account the panel can log in as. The application declares the slot - the label, the query and the
 * fields; whoever runs it types the credentials in once, and they stay in this browser.
 *
 * @see QueryDevtoolsOptions.authAccounts
 */
export type QueryDevtoolsAuthAccount = {
  /** The `createBearerAuthProvider({ name })` this account logs into. */
  provider: string;

  /** Names the account in the picker, for example `Admin`. */
  label: string;

  /** The key of the provider query that performs the login, for example `login`. */
  loginQuery: string;

  /** What the login needs. Defaults to an e-mail and a password. */
  fields?: QueryDevtoolsAuthField[];

  /** Turns the collected values into the login query's args. Defaults to `{ body: values }`. */
  buildArgs?: (values: Record<string, string>) => unknown;

  /**
   * The api env ids this account exists on, for a backend whose users are not the next one's. Omitted
   * offers it on every env.
   */
  envs?: string[];

  /** Shown next to the label, for example the role this account has. */
  note?: string;
};

/** An account added in the panel instead of declared by the application. */
export type QueryDevtoolsAuthLocalAccount = {
  id: string;
  provider: string;
  label: string;
  loginQuery: string;

  /** The api env scope it was added under, so a backend's accounts stay with that backend. */
  scope: string;

  /**
   * What the login needs, which is not `email` and `password` for every backend. Absent on an account
   * added before the panel asked: those fall back to the shape a declared account uses.
   */
  fields?: QueryDevtoolsAuthField[];
};

/** One session the vault holds, which is a token pair plus who it belongs to. */
export type QueryDevtoolsAuthSession = {
  id: string;

  /** The auth provider whose session this is. */
  provider: string;

  /** What the picker shows. Taken from the token's claims, and editable. */
  label: string;

  /** The api env scope the tokens were issued under. A session is only ever offered on its own scope. */
  scope: string;

  accessToken: string;
  refreshToken: string;

  /** The `sub` claim, which is how a session is recognised again after a plain login. */
  subject: string | null;

  /**
   * The name the token claimed, for a backend that issues no `sub`. This is what tells two users apart
   * there, so it is written from the claims on every capture and never from {@link label}.
   */
  identity: string | null;

  /**
   * The account id a devtools login created it for, or `null` for a login in the application itself.
   * How a login as a declared account finds its own session again where the tokens carry no `sub`.
   */
  account: string | null;

  /** The access token's `exp` claim, in seconds, or `null` for a token that carries none. */
  expiresAt: number | null;

  /** When the tokens were last written, in ms. */
  savedAt: number;
};

/** Both kinds of account as the panel and the pill take them. */
export type QueryDevtoolsAuthAccountView = {
  /** `declared:<provider>|<label>` for an application's own, `local:<id>` for one added in the panel. */
  id: string;

  provider: string;
  label: string;
  loginQuery: string;
  fields: QueryDevtoolsAuthField[];

  /** What is stored for each field on this machine. Absent keys are fields nobody filled in yet. */
  values: Record<string, string>;

  /** Whether every field has a value, which is what makes the account loggable-in. */
  ready: boolean;

  /** Whether the application declared it, which is what makes it un-removable in the panel. */
  declared: boolean;

  buildArgs?: (values: Record<string, string>) => unknown;

  note?: string;
};

type Store = {
  sessions: QueryDevtoolsAuthSession[];

  /** What a login needs, keyed by account id. Written here and read by nothing else. */
  credentials: Record<string, Record<string, string>>;

  accounts: QueryDevtoolsAuthLocalAccount[];
};

type Seed = QueryDevtoolsAuthSeed & { sessionId: string; scope: string };

type LiveProvider = QueryDevtoolsAuthProviderRegistration;

const STORE_KEY = 'ethlete:query:devtools:auth:v1';

/**
 * `sessionStorage`: which stored session a provider's live tokens belong to is the one part of this that
 * is the tab's own. Two tabs holding two users would otherwise overwrite each other's answer.
 */
const ACTIVE_KEY = 'ethlete:query:devtools:auth-active:v1';

/** `sessionStorage`, always: a session that belongs to one tab cannot be kept where every tab reads it. */
const SEED_KEY = 'ethlete:query:devtools:auth-tab-session:v1';

const DEFAULT_FIELDS: QueryDevtoolsAuthField[] = [
  { name: 'email', type: 'email' },
  { name: 'password', type: 'password' },
];

const EMPTY: Store = { sessions: [], credentials: {}, accounts: [] };

const store = /* @__PURE__ */ signal<Store>(EMPTY);
const active = /* @__PURE__ */ signal<Record<string, string | null>>({});
const declared = /* @__PURE__ */ signal<QueryDevtoolsAuthAccount[]>([]);
const providers = /* @__PURE__ */ signal<string[]>([]);
const tabLocal = /* @__PURE__ */ signal<Record<string, boolean>>({});

const live = /* @__PURE__ */ new Map<string, LiveProvider>();

/**
 * The account each provider's next captured token pair was logged in as, set by
 * `loginQueryDevtoolsAuthAccount` and consumed by the capture it causes. `previous` is the session that
 * was in force before, which the logout on the way out would otherwise take out of reach.
 */
const pendingLogins = /* @__PURE__ */ new Map<string, { id: string; label: string; previous: string | null }>();

let idCounter = 0;

const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++idCounter}`;

/**
 * Every session the vault holds, whatever env or provider it belongs to. Read
 * {@link queryDevtoolsAuthSessionsFor} instead where a provider is in hand.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsAuthSessions: Signal<QueryDevtoolsAuthSession[]> = /* @__PURE__ */ computed(
  () => store().sessions,
);

/**
 * Which stored session each provider's live tokens belong to, keyed by provider name. This tab's own
 * answer: another tab on another user has its own.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsAuthActive: Signal<Record<string, string | null>> = /* @__PURE__ */ active.asReadonly();

/**
 * Which providers hold a session of their own rather than the one every tab shares, keyed by provider
 * name.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsAuthTabLocal: Signal<Record<string, boolean>> = /* @__PURE__ */ tabLocal.asReadonly();

/** The auth providers the vault has been handed, in registration order. @internal */
export const queryDevtoolsAuthProviders: Signal<string[]> = /* @__PURE__ */ providers.asReadonly();

const scopeOf = () => queryDevtoolsApiEnvScope();

const persist = () => {
  const scope = queryDevtoolsSettings().authSessions;

  writeQueryDevtoolsStore(scope, STORE_KEY, store());
  writeQueryDevtoolsStore(scope === 'none' ? 'none' : 'session', ACTIVE_KEY, active());
};

const setActive = (provider: string, sessionId: string | null) => {
  active.update((current) => ({ ...current, [provider]: sessionId }));
};

const readSeeds = (): Record<string, Seed> => readQueryDevtoolsStore<Record<string, Seed>>('session', SEED_KEY) ?? {};

const writeSeeds = (seeds: Record<string, Seed>) => {
  if (Object.keys(seeds).length) writeQueryDevtoolsStore('session', SEED_KEY, seeds);
  else queryDevtoolsStorage('session')?.removeItem(SEED_KEY);
};

/** The claims a session is named and recognised by, or nothing for a token that is not a JWT. */
const identityOf = (accessToken: string) => {
  try {
    const payload = decryptBearer<Record<string, unknown> | null>(accessToken);

    if (!payload) return { label: null, subject: null, expiresAt: null };

    const named = ['name', 'preferred_username', 'username', 'email', 'sub'].find(
      (claim) => typeof payload[claim] === 'string' && payload[claim] !== '',
    );

    return {
      label: named ? String(payload[named]) : null,
      subject: typeof payload['sub'] === 'string' ? payload['sub'] : null,
      expiresAt: typeof payload['exp'] === 'number' ? payload['exp'] : null,
    };
  } catch {
    return { label: null, subject: null, expiresAt: null };
  }
};

const sanitizeSession = (value: unknown): QueryDevtoolsAuthSession | null => {
  if (typeof value !== 'object' || value === null) return null;

  const session = value as Partial<QueryDevtoolsAuthSession>;

  if (
    typeof session.id !== 'string' ||
    typeof session.provider !== 'string' ||
    typeof session.accessToken !== 'string' ||
    typeof session.refreshToken !== 'string'
  ) {
    return null;
  }

  return {
    id: session.id,
    provider: session.provider,
    label: typeof session.label === 'string' ? session.label : session.id,
    scope: typeof session.scope === 'string' ? session.scope : 'default',
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    subject: typeof session.subject === 'string' ? session.subject : null,
    identity: typeof session.identity === 'string' ? session.identity : null,
    account: typeof session.account === 'string' ? session.account : null,
    expiresAt: typeof session.expiresAt === 'number' ? session.expiresAt : null,
    savedAt: typeof session.savedAt === 'number' ? session.savedAt : 0,
  };
};

const sanitize = (value: Partial<Store> | null): Store => ({
  sessions: Array.isArray(value?.sessions)
    ? value.sessions.map(sanitizeSession).filter((session): session is QueryDevtoolsAuthSession => session !== null)
    : [],
  credentials: typeof value?.credentials === 'object' && value.credentials !== null ? value.credentials : {},
  accounts: Array.isArray(value?.accounts) ? value.accounts : [],
});

/**
 * The vault is one key every tab writes, so a tab holding a stale copy of it would drop whatever another
 * tab stored since. The event fires in the other tabs only, which is exactly the ones that need it.
 */
const listenForOtherTabs = () => {
  if (typeof window === 'undefined' || listening) return;

  listening = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== STORE_KEY) return;

    store.set(sanitize(event.newValue ? (JSON.parse(event.newValue) as Partial<Store>) : null));
    syncPill();
  });
};

let listening = false;

/**
 * Declares the accounts the panel may log in as, and reads back what a previous page stored. Called by
 * `provideQueryDevtools()` and by nothing else.
 * @internal
 */
export const initQueryDevtoolsAuthSessions = (accounts: QueryDevtoolsAuthAccount[] | undefined) => {
  const scope = queryDevtoolsSettings().authSessions;

  declared.set(accounts ?? []);
  store.set(sanitize(readQueryDevtoolsStore<Partial<Store>>(scope, STORE_KEY)));
  active.set(
    readQueryDevtoolsStore<Record<string, string | null>>(scope === 'none' ? 'none' : 'session', ACTIVE_KEY) ?? {},
  );
  listenForOtherTabs();
  syncPill();
};

/**
 * The session the panel put in this tab alone, or `null`. A seed from another backend is dropped rather
 * than applied: its tokens were issued by an API this page is not pointed at any more.
 * @internal
 */
export const readQueryDevtoolsAuthSeedFor = (providerName: string): QueryDevtoolsAuthSeed | null => {
  const seeds = readSeeds();
  const seed = seeds[providerName];

  if (!seed) return null;

  if (seed.scope !== scopeOf()) {
    const { [providerName]: _dropped, ...rest } = seeds;

    writeSeeds(rest);

    return null;
  }

  tabLocal.update((current) => ({ ...current, [providerName]: true }));
  setActive(providerName, seed.sessionId);

  return { accessToken: seed.accessToken, refreshToken: seed.refreshToken };
};

/**
 * Keeps the stored session in step with the live one: every rotation of a refresh token is written back,
 * so switching away and back later does not present a token the server has already spent.
 * @internal
 */
export const trackQueryDevtoolsAuthProvider = (registration: QueryDevtoolsAuthProviderRegistration) => {
  const { name, handle, injector, isTabLocalSession } = registration;

  live.set(name, registration);
  providers.update((current) => (current.includes(name) ? current : [...current, name]));
  isTabLocalSession.set(tabLocal()[name] === true);

  const stop = effect(
    () => {
      const accessToken = handle.accessToken();
      const refreshToken = handle.refreshToken();

      untracked(() => {
        if (accessToken && refreshToken) remember({ provider: name, accessToken, refreshToken });
        else forgetActive(name);
      });
    },
    { injector },
  );

  syncPill();

  return () => {
    stop.destroy();
    live.delete(name);
    providers.update((current) => current.filter((entry) => entry !== name));
    syncPill();
  };
};

/**
 * Drops what the previous user left behind. Their responses are cached under keys the next user's
 * requests hit, and a bound secure query would go on rendering a body that was fetched for somebody else.
 *
 * Only ever once the new tokens are in force: `unbindAllSecure` re-arms every secure query that
 * auto-executes on the first access token it sees, so clearing before them re-runs all of them on the
 * token the previous user still holds - and caches that answer for the one arriving.
 */
const clearClientData = (entry: LiveProvider) => {
  const { repository } = entry.client;

  repository.unbindAllSecure();

  for (const cacheEntry of repository.subtle.cacheEntries()) repository.subtle.evict(cacheEntry.key);

  void entry.client.clearPersistedQueries();
};

/**
 * Writes a live token pair into the vault. A pair whose subject is already stored updates that session
 * rather than adding another, which is what lets a plain login in the application fill the picker.
 */
const remember = (options: { provider: string; accessToken: string; refreshToken: string }) => {
  const { provider, accessToken, refreshToken } = options;

  // Nobody's real credentials or tokens are kept on this machine. See the Auth tab's own warning.
  if (queryDevtoolsApiEnvIsProduction()) return;

  const scope = scopeOf();
  const identity = identityOf(accessToken);
  const activeId = active()[provider] ?? null;
  const account = pendingLogins.get(provider) ?? null;

  pendingLogins.delete(provider);

  const mine = store().sessions.filter((session) => session.provider === provider && session.scope === scope);

  // This pair is already on record: the tab it belongs to lost only the pointer, which a new tab always
  // does - the pointer is the tab's own. Without this a token that carries no `sub` grows a second entry
  // per tab, and a third, until the picker is a column of sessions all named the same.
  const byTokens = mine.find((session) => session.refreshToken === refreshToken || session.accessToken === accessToken);
  const byAccount = account ? mine.find((session) => session.account === account.id) : undefined;
  const bySubject = identity.subject ? mine.find((session) => session.subject === identity.subject) : undefined;

  // The name the token claims, for a backend that issues no `sub`. A session held for another account is
  // left alone: two accounts are two slots even where one person's name is on both.
  const byIdentity = identity.label
    ? mine.find(
        (session) =>
          session.identity === identity.label && (!account || !session.account || session.account === account.id),
      )
    : undefined;

  // An account login logs out on the way in, and a logout lets go of the pointer, so the session this tab
  // was on has to be carried in by the pending login instead.
  const candidate = mine.find((session) => session.id === (activeId ?? account?.previous ?? null));

  // Whoever the live tokens belong to, the candidate is a different user as soon as one claim says so.
  // Without this a login as somebody else would overwrite the tokens of the user this tab is leaving,
  // which is the one pair the vault exists to keep.
  const isOtherUser =
    !!candidate &&
    ((!!identity.subject && !!candidate.subject && candidate.subject !== identity.subject) ||
      (!!identity.label && !!candidate.identity && candidate.identity !== identity.label) ||
      (!!account && !!candidate.account && candidate.account !== account.id));

  // The last resort for a token that names nobody at all: the newest session nothing can tell it apart
  // from. An account login is left out - it is asking for a session of its own.
  const byNothing =
    identity.subject || identity.label || account
      ? undefined
      : mine.filter((session) => !session.subject && !session.account).sort((a, b) => b.savedAt - a.savedAt)[0];

  const target = byTokens ?? byAccount ?? bySubject ?? byIdentity ?? (isOtherUser ? undefined : candidate) ?? byNothing;

  const session: QueryDevtoolsAuthSession = {
    id: target?.id ?? nextId('session'),
    provider,
    label: target?.label ?? identity.label ?? account?.label ?? 'session',
    scope,
    accessToken,
    refreshToken,
    subject: identity.subject,
    identity: identity.label ?? target?.identity ?? null,
    account: target?.account ?? account?.id ?? null,
    expiresAt: identity.expiresAt,
    savedAt: Date.now(),
  };

  store.update((current) => ({
    ...current,
    sessions: target
      ? current.sessions.map((entry) => (entry.id === target.id ? session : entry))
      : [...current.sessions, session],
  }));

  setActive(provider, session.id);

  if (tabLocal()[provider]) {
    writeSeeds({ ...readSeeds(), [provider]: { sessionId: session.id, scope, accessToken, refreshToken } });
  }

  persist();
  syncPill();

  // Another session than this tab was on. A rotation of the same one is not a change of user, and a
  // login that never landed leaves its pending entry behind for the next rotation to find.
  if (account && session.id !== account.previous) {
    const entry = live.get(provider);

    if (entry) clearClientData(entry);
  }
};

/** Lets go of the session a provider was on, without forgetting what the vault holds of it. */
const forgetActive = (provider: string) => {
  if (!active()[provider]) return;

  setActive(provider, null);
  persist();
  syncPill();
};

/** The sessions offered for one provider, which are the ones this backend issued. */
export const queryDevtoolsAuthSessionsFor = (provider: string) => {
  const scope = scopeOf();

  return store().sessions.filter((session) => session.provider === provider && session.scope === scope);
};

/** How many sessions this provider has under a different backend, which is what a switch left behind. */
export const queryDevtoolsAuthOtherScopeCount = (provider: string) => {
  const scope = scopeOf();

  return store().sessions.filter((session) => session.provider === provider && session.scope !== scope).length;
};

const declaredIdOf = (account: QueryDevtoolsAuthAccount) => `declared:${account.provider}|${account.label}`;

const viewOf = (options: {
  id: string;
  provider: string;
  label: string;
  loginQuery: string;
  fields: QueryDevtoolsAuthField[];
  declared: boolean;
  buildArgs?: (values: Record<string, string>) => unknown;
  note?: string;
}): QueryDevtoolsAuthAccountView => {
  const stored = store().credentials[options.id] ?? {};
  const values = Object.fromEntries(
    options.fields.map((field) => [field.name, stored[field.name] ?? field.default ?? '']),
  );

  return {
    ...options,
    values,
    ready: options.fields.every((field) => values[field.name] !== ''),
  };
};

/**
 * The accounts on offer for one provider: the ones the application declared for the env in force, plus
 * the ones added in the panel. Empty while a production env is the pick - nothing keeps a real user's
 * password on a developer's machine.
 */
export const queryDevtoolsAuthAccountsFor = (provider: string): QueryDevtoolsAuthAccountView[] => {
  if (queryDevtoolsApiEnvIsProduction()) return [];

  const scope = scopeOf();
  const envIds = queryDevtoolsApiEnvIds();

  const fromApp = declared()
    .filter((account) => account.provider === provider)
    .filter((account) => !account.envs?.length || account.envs.some((id) => envIds.includes(id)))
    .map((account) =>
      viewOf({
        id: declaredIdOf(account),
        provider,
        label: account.label,
        loginQuery: account.loginQuery,
        fields: account.fields ?? DEFAULT_FIELDS,
        declared: true,
        buildArgs: account.buildArgs,
        note: account.note,
      }),
    );

  const fromPanel = store()
    .accounts.filter((account) => account.provider === provider && account.scope === scope)
    .map((account) =>
      viewOf({
        id: `local:${account.id}`,
        provider,
        label: account.label,
        loginQuery: account.loginQuery,
        fields: account.fields?.length ? account.fields : queryDevtoolsAuthFieldsFor(provider, account.loginQuery),
        declared: false,
      }),
    );

  return [...fromApp, ...fromPanel];
};

/** Keeps one account's credentials on this machine. Refused while a production env is the pick. */
export const setQueryDevtoolsAuthCredentials = (options: { accountId: string; values: Record<string, string> }) => {
  if (queryDevtoolsApiEnvIsProduction()) return;

  store.update((current) => ({
    ...current,
    credentials: { ...current.credentials, [options.accountId]: options.values },
  }));
  persist();
  syncPill();
};

/** Forgets what was typed in for one account, leaving the account itself on offer. */
export const clearQueryDevtoolsAuthCredentials = (accountId: string) => {
  store.update((current) => {
    const { [accountId]: _removed, ...rest } = current.credentials;

    return { ...current, credentials: rest };
  });
  persist();
  syncPill();
};

/**
 * What a login needs on one provider, taken from an account the application declared for the same query.
 * The shape a hand-added account starts from, for a backend whose login is not `email` and `password`.
 */
export const queryDevtoolsAuthFieldsFor = (provider: string, loginQuery?: string): QueryDevtoolsAuthField[] => {
  const mine = declared().filter((account) => account.provider === provider && account.fields?.length);
  const shape = (loginQuery ? mine.find((account) => account.loginQuery === loginQuery) : undefined) ?? mine[0];

  return (shape?.fields ?? DEFAULT_FIELDS).map(({ name, label, type }) => ({ name, label, type }));
};

/** Adds an account the application does not declare, for the backend in force. */
export const addQueryDevtoolsAuthAccount = (options: {
  provider: string;
  label: string;
  loginQuery: string;
  fields?: QueryDevtoolsAuthField[];
}) => {
  const account: QueryDevtoolsAuthLocalAccount = { ...options, id: nextId('account'), scope: scopeOf() };

  store.update((current) => ({ ...current, accounts: [...current.accounts, account] }));
  persist();
  syncPill();

  return `local:${account.id}`;
};

/** Removes an account added in the panel, and whatever was typed in for it. */
export const removeQueryDevtoolsAuthAccount = (accountId: string) => {
  const id = accountId.replace(/^local:/, '');

  store.update((current) => {
    const { [accountId]: _removed, ...credentials } = current.credentials;

    return { ...current, credentials, accounts: current.accounts.filter((account) => account.id !== id) };
  });
  persist();
  syncPill();
};

export const renameQueryDevtoolsAuthSession = (options: { sessionId: string; label: string }) => {
  store.update((current) => ({
    ...current,
    sessions: current.sessions.map((session) =>
      session.id === options.sessionId ? { ...session, label: options.label } : session,
    ),
  }));
  persist();
  syncPill();
};

/** Drops one stored session. The live one it describes is left alone. */
export const forgetQueryDevtoolsAuthSession = (sessionId: string) => {
  store.update((current) => ({
    ...current,
    sessions: current.sessions.filter((session) => session.id !== sessionId),
  }));
  active.update((current) =>
    Object.fromEntries(Object.entries(current).map(([provider, id]) => [provider, id === sessionId ? null : id])),
  );
  persist();
  syncPill();
};

/**
 * Drops every session this backend issued for one provider. The accounts and what was typed in for them
 * are left alone, so the way back in is one login.
 */
export const forgetQueryDevtoolsAuthSessionsFor = (provider: string) => {
  const scope = scopeOf();
  const dropped = new Set(
    store()
      .sessions.filter((session) => session.provider === provider && session.scope === scope)
      .map((session) => session.id),
  );

  store.update((current) => ({
    ...current,
    sessions: current.sessions.filter((session) => !dropped.has(session.id)),
  }));
  active.update((current) =>
    Object.fromEntries(Object.entries(current).map(([name, id]) => [name, id && dropped.has(id) ? null : id])),
  );
  persist();
  syncPill();
};

/** Empties the vault: every session, every account added in the panel, every credential. */
export const clearQueryDevtoolsAuthSessions = () => {
  store.set(EMPTY);
  active.set({});
  writeSeeds({});
  persist();
  syncPill();
};

const reload = () => globalThis.location?.reload();

/**
 * Puts one stored session's tokens in force. The reload is the default because a switch only replaces
 * what the query layer holds: an application that keeps the user anywhere else - a profile service, the
 * router, an open form - is still showing the last one.
 */
export const switchQueryDevtoolsAuthSession = (options: { sessionId: string; reload?: boolean }) => {
  const session = store().sessions.find((entry) => entry.id === options.sessionId);

  if (!session) return;

  const entry = live.get(session.provider);

  if (!entry || session.scope !== scopeOf()) return;

  setActive(session.provider, session.id);

  if (tabLocal()[session.provider]) {
    writeSeeds({
      ...readSeeds(),
      [session.provider]: {
        sessionId: session.id,
        scope: session.scope,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      },
    });
  }

  persist();
  entry.handle.setTokens(session.accessToken, session.refreshToken);
  clearClientData(entry);
  syncPill();

  if (options.reload ?? queryDevtoolsSettings().reloadOnAuthSwitch) reload();
};

/**
 * Logs in as one account, through the provider's own login query - so the tokens are issued the way the
 * application issues them, and the vault picks the session up like any other login.
 */
export const loginQueryDevtoolsAuthAccount = (accountId: string) => {
  const account = queryDevtoolsAuthProviders()
    .flatMap((provider) => queryDevtoolsAuthAccountsFor(provider))
    .find((entry) => entry.id === accountId);

  if (!account?.ready) return;

  const entry = live.get(account.provider);
  const query = entry?.handle.queries?.[account.loginQuery];

  if (!entry || !query) return;

  const previous = active()[account.provider] ?? null;

  setActive(account.provider, null);
  pendingLogins.set(account.provider, { id: account.id, label: account.label, previous });
  persist();

  query.execute(account.buildArgs?.(account.values) ?? { body: account.values });
};

/** Ends the live session without forgetting it, so it can be switched back to. */
export const logoutQueryDevtoolsAuthSession = (provider: string) => {
  live.get(provider)?.handle.logout();
};

/**
 * Makes this tab's session its own, or hands it back to its siblings. Both reload: a tab that keeps its
 * own session runs no `BroadcastChannel` sync and writes no persistence cookie, and both are decided
 * while the provider is built.
 */
export const setQueryDevtoolsAuthTabLocal = (options: { provider: string; tabLocal: boolean }) => {
  const { provider } = options;
  const seeds = readSeeds();

  if (!options.tabLocal) {
    const { [provider]: _dropped, ...rest } = seeds;

    writeSeeds(rest);
    reload();

    return;
  }

  const entry = live.get(provider);
  const accessToken = entry?.handle.accessToken();
  const refreshToken = entry?.handle.refreshToken();

  if (!accessToken || !refreshToken) return;

  const sessionId = active()[provider] ?? null;

  if (!sessionId) return;

  writeSeeds({ ...seeds, [provider]: { sessionId, scope: scopeOf(), accessToken, refreshToken } });
  reload();
};

/** When a session's tokens were last written, which is what tells two same-named ones apart. */
const savedAtLabel = (session: QueryDevtoolsAuthSession) =>
  session.savedAt
    ? new Date(session.savedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : 'unknown';

/** What the floating pill offers, rebuilt whenever any of it changes. */
const syncPill = () => {
  const rows = untracked(() =>
    providers().map((provider) => {
      const sessions = queryDevtoolsAuthSessionsFor(provider);
      const accounts = queryDevtoolsAuthAccountsFor(provider);
      const activeId = active()[provider] ?? null;
      const current = sessions.find((session) => session.id === activeId);

      const shared = new Map<string, number>();

      for (const session of sessions) shared.set(session.label, (shared.get(session.label) ?? 0) + 1);

      const labelOf = (session: QueryDevtoolsAuthSession) =>
        shared.get(session.label) === 1 ? session.label : `${session.label} · ${savedAtLabel(session)}`;

      return {
        name: provider,
        current: current?.label ?? (live.get(provider)?.handle.accessToken() ? 'unnamed session' : 'anonymous'),
        tabLocal: tabLocal()[provider] === true,
        options: [
          ...sessions.map((session) => ({
            value: `session:${session.id}`,
            label: labelOf(session),
            title: `Switch to ${session.label}`,
            selected: session.id === activeId,
            disabled: false,
          })),
          ...accounts.map((account) => ({
            value: `account:${account.id}`,
            label: `log in as ${account.label}`,
            title: account.ready
              ? `Logs in through ${account.loginQuery}`
              : 'Needs its credentials typed into the panel first',
            selected: false,
            disabled: !account.ready,
          })),
        ],
        pick: (value: string) => {
          if (value.startsWith('session:')) switchQueryDevtoolsAuthSession({ sessionId: value.slice(8) });
          else if (value.startsWith('account:')) loginQueryDevtoolsAuthAccount(value.slice(8));
        },
        toggleTabLocal: () => setQueryDevtoolsAuthTabLocal({ provider, tabLocal: !tabLocal()[provider] }),
      };
    }),
  );

  setQueryDevtoolsAuthPill({ rows: rows.filter((row) => row.options.length > 0) });
};
