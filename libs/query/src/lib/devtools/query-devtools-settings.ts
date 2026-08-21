import { Signal, signal } from '@angular/core';

/**
 * Where one kind of devtools state is kept between page loads. `none` means it is not kept at all -
 * what that costs differs per kind, which is why every kind picks its own.
 */
export type QueryDevtoolsStorageScope = 'none' | 'session' | 'local';

/**
 * The devtools' own configuration: where each kind of panel state is kept, and the limits the panel
 * would otherwise hold as constants. Read it as {@link queryDevtoolsSettings}, change it with
 * {@link setQueryDevtoolsSettings}.
 */
export type QueryDevtoolsSettings = {
  /** Panel chrome and view state: dock, sizes, open tab, filters, selections. */
  viewState: QueryDevtoolsStorageScope;

  /** The entry ids sorted to the top of the Queries list. */
  pins: QueryDevtoolsStorageScope;

  /**
   * Armed response overrides, replayed as queries register on the next load. `none` by default: an app
   * that stays tampered with across reloads is hours of debugging the wrong thing.
   */
  overrides: QueryDevtoolsStorageScope;

  /** The library of designed mocks - the authoring, not whether any of them is armed. */
  mocks: QueryDevtoolsStorageScope;

  /**
   * Which mocks are **armed**, as opposed to the library above. `none` by default: an app that silently
   * serves designed data tomorrow morning is worse than arming them again, so keeping them is a choice
   * someone makes rather than the way the panel ships.
   */
  armedMocks: QueryDevtoolsStorageScope;

  /** The faults armed per client, for the same reason and with the same default. */
  armedFaults: QueryDevtoolsStorageScope;

  /**
   * The session vault: the token pairs the panel switches between, and the credentials it logs in with.
   * `local` by default, because a vault that forgets the other user on every reload is not one - and
   * `none` for a machine where nothing of the sort may be kept.
   */
  authSessions: QueryDevtoolsStorageScope;

  /** How many entries the Events log keeps. */
  maxEvents: number;

  /** How many dropped cache entries the Cache tab remembers, per client. */
  maxDroppedCacheEntries: number;

  /**
   * How many bodies each query retains, overriding `provideQueryDevtools({ responseHistory })` for the
   * rest of this page. `null` leaves the application's value alone.
   */
  responseHistory: number | null;

  /**
   * Whether switching to another session reloads the page. On by default: a switch replaces what the
   * query layer holds, and an application that keeps the user anywhere else - a profile service, the
   * router, an open form - is still showing the last one until it boots again.
   */
  reloadOnAuthSwitch: boolean;
};

const DEFAULTS: QueryDevtoolsSettings = {
  viewState: 'session',
  pins: 'local',
  overrides: 'none',
  mocks: 'local',
  armedMocks: 'none',
  armedFaults: 'none',
  authSessions: 'local',
  maxEvents: 100,
  maxDroppedCacheEntries: 20,
  responseHistory: null,
  reloadOnAuthSwitch: true,
};

/**
 * `localStorage`, whatever the scopes below say - a scope of `none` still has to be remembered, or the
 * choice would erase itself on the first reload it applies to.
 */
const SETTINGS_KEY = 'ethlete:query:devtools:settings:v1';

const LIMITS = {
  maxEvents: { min: 10, max: 1000 },
  maxDroppedCacheEntries: { min: 0, max: 200 },
  responseHistory: { min: 1, max: 50 },
} as const;

const settings = /* @__PURE__ */ signal(DEFAULTS);

/**
 * How the devtools are configured. Every consumer reads the live value rather than a copy, so a change
 * in the panel's Settings takes effect without a reload.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsSettings: Signal<QueryDevtoolsSettings> = /* @__PURE__ */ settings.asReadonly();

/**
 * The `Storage` a scope names, or `null` for `none` and for a browser that refuses one (private mode,
 * storage disabled, server-side rendering). Callers treat "no storage" and "not persisted" alike.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsStorage = (scope: QueryDevtoolsStorageScope): Storage | null => {
  if (scope === 'none' || typeof window === 'undefined') return null;

  try {
    return scope === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
};

/**
 * Reads one JSON-encoded devtools key from the store a scope names, or `null`.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const readQueryDevtoolsStore = <T>(scope: QueryDevtoolsStorageScope, key: string): T | null => {
  try {
    const raw = queryDevtoolsStorage(scope)?.getItem(key);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

/**
 * Writes one devtools key into the store a scope names. A scope of `none` writes nothing.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const writeQueryDevtoolsStore = (scope: QueryDevtoolsStorageScope, key: string, value: unknown) => {
  try {
    queryDevtoolsStorage(scope)?.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (private mode / disabled storage / quota)
  }
};

/**
 * Removes one devtools key from **both** stores, whatever the scope currently is - so a scope that
 * changed cannot leave a stale copy behind for the next load to read.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const clearQueryDevtoolsStore = (key: string) => {
  for (const scope of ['session', 'local'] as const) {
    try {
      queryDevtoolsStorage(scope)?.removeItem(key);
    } catch {
      // ignore (private mode / disabled storage)
    }
  }
};

const asScope = (value: unknown, fallback: QueryDevtoolsStorageScope): QueryDevtoolsStorageScope =>
  value === 'none' || value === 'session' || value === 'local' ? value : fallback;

const asCount = (value: unknown, limits: { min: number; max: number }, fallback: number) => {
  const count = Math.floor(Number(value));

  if (!Number.isFinite(count)) return fallback;

  return Math.min(Math.max(count, limits.min), limits.max);
};

/** A count that may be absent, where absent means "leave the application's own value alone". */
const asOptionalCount = (value: unknown, limits: { min: number; max: number }) => {
  if (value === null || value === undefined) return null;

  const count = Math.floor(Number(value));

  return Number.isFinite(count) ? Math.min(Math.max(count, limits.min), limits.max) : null;
};

/** Both a hand-edited store and a number typed into the panel come through here. */
const sanitize = (value: Partial<QueryDevtoolsSettings> | null): QueryDevtoolsSettings => ({
  viewState: asScope(value?.viewState, DEFAULTS.viewState),
  pins: asScope(value?.pins, DEFAULTS.pins),
  overrides: asScope(value?.overrides, DEFAULTS.overrides),
  mocks: asScope(value?.mocks, DEFAULTS.mocks),
  armedMocks: asScope(value?.armedMocks, DEFAULTS.armedMocks),
  armedFaults: asScope(value?.armedFaults, DEFAULTS.armedFaults),
  authSessions: asScope(value?.authSessions, DEFAULTS.authSessions),
  maxEvents: asCount(value?.maxEvents, LIMITS.maxEvents, DEFAULTS.maxEvents),
  maxDroppedCacheEntries: asCount(
    value?.maxDroppedCacheEntries,
    LIMITS.maxDroppedCacheEntries,
    DEFAULTS.maxDroppedCacheEntries,
  ),
  responseHistory: asOptionalCount(value?.responseHistory, LIMITS.responseHistory),
  reloadOnAuthSwitch:
    typeof value?.reloadOnAuthSwitch === 'boolean' ? value.reloadOnAuthSwitch : DEFAULTS.reloadOnAuthSwitch,
});

/**
 * Reads the stored settings. Called by `provideQueryDevtools()` **before** the override store is read
 * and the response-history default is set - both take their configuration from here - and by nothing
 * else.
 * @internal
 */
export const initQueryDevtoolsSettings = () => {
  settings.set(sanitize(readQueryDevtoolsStore<Partial<QueryDevtoolsSettings>>('local', SETTINGS_KEY)));
};

/**
 * Changes part of the devtools configuration and stores it. Values outside the range a field allows are
 * clamped rather than rejected.
 *
 * Overrides are the one field not to set here: their scope moves an existing store, so it goes through
 * `setQueryDevtoolsOverridesScope()` instead.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const setQueryDevtoolsSettings = (patch: Partial<QueryDevtoolsSettings>) => {
  const next = sanitize({ ...settings(), ...patch });

  settings.set(next);
  writeQueryDevtoolsStore('local', SETTINGS_KEY, next);
};
