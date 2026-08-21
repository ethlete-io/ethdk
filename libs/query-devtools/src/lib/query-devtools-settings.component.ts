import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import {
  armAllQueryDevtoolsMocks,
  clearQueryDevtoolsArmedMocks,
  clearQueryDevtoolsAuthSessions,
  clearQueryDevtoolsFaults,
  QueryDevtoolsApiEnvSwitch,
  queryDevtoolsApiEnvs,
  queryDevtoolsApiEnvValues,
  queryDevtoolsArmedMocks,
  queryDevtoolsAuthSessions,
  queryDevtoolsMocks,
  queryDevtoolsResponseHistory,
  queryDevtoolsSettings,
  QueryDevtoolsStorageScope,
  setQueryDevtoolsApiEnv,
  setQueryDevtoolsArmedMocksScope,
  setQueryDevtoolsFaultsScope,
  setQueryDevtoolsOverridesScope,
  setQueryDevtoolsSettings,
} from '@ethlete/query';
import { injectQueryDevtoolsHost } from './query-devtools-host';

type ScopeKey = 'viewState' | 'pins' | 'overrides' | 'mocks' | 'armedMocks' | 'armedFaults' | 'authSessions';

type ScopeRow = {
  key: ScopeKey;
  label: string;

  /** What is kept, and what `none` costs - the one thing a scope picker cannot show on its own. */
  hint: string;

  /**
   * What to say on the scopes that let this state outlive the page that armed it - a picker cannot show
   * that an app is about to start lying to itself before anyone opens the panel.
   */
  warn?: { scopes: QueryDevtoolsStorageScope[]; text: string };
};

type LimitKey = 'maxEvents' | 'maxDroppedCacheEntries';

type LimitRow = { key: LimitKey; label: string; min: number; max: number; step: number; hint: string };

const SCOPE_ROWS: ScopeRow[] = [
  {
    key: 'viewState',
    label: 'Panel view state',
    hint: 'Where the panel sits, how big it is, the open tab, every filter and the selected query. Set none to forget all of it on each reload.',
  },
  {
    key: 'pins',
    label: 'Pinned queries',
    hint: 'Which queries sort to the top of the list. Local outlives the tab, because a pin says what you are working on rather than what you are looking at.',
  },
  {
    key: 'overrides',
    label: 'Response overrides',
    hint: 'Armed edits, replayed as queries register - before their first fetch. None is the default: a reload is how the app stops being lied to.',
    warn: {
      scopes: ['local'],
      text: 'Armed overrides now outlive closing the tab. An app that stays tampered with across days is hours of debugging the wrong thing - the bar above the tabs says when they came back.',
    },
  },
  {
    key: 'mocks',
    label: 'Designed mocks',
    hint: 'The library you authored, not whether any of it is armed - arming has its own scope below.',
  },
  {
    key: 'armedMocks',
    label: 'Armed mocks',
    hint: 'Which of the library is served. None is the default: a reload is how the app goes back to talking to the API.',
    warn: {
      scopes: ['session', 'local'],
      text: 'The next page load starts serving these routes from the panel, before anyone opens it. The bar above the tabs says when they came back.',
    },
  },
  {
    key: 'authSessions',
    label: 'Sessions and accounts',
    hint: 'The token pairs the Auth tab switches between, and the credentials it logs in with. Local is the default: a vault that forgets the other user on every reload is not one. None keeps nothing at all.',
    warn: {
      scopes: ['local'],
      text: 'Access and refresh tokens for every user you logged in as, plus what you typed into the account fields, stay in this browser until you forget them. They are never kept for an API env marked production.',
    },
  },
  {
    key: 'armedFaults',
    label: 'Armed faults',
    hint: 'The latency and failures injected per client, budgets included. None is the default, for the same reason as armed mocks.',
    warn: {
      scopes: ['session', 'local'],
      text: 'The next page load starts injecting these failures on its own, so an app that looks broken may only be armed. The bar above the tabs says when they came back.',
    },
  },
];

const SCOPES: { value: QueryDevtoolsStorageScope; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'session', label: 'session' },
  { value: 'local', label: 'local' },
];

/**
 * Why IndexedDB - the one store with the quota for a large library of designed data - is not on offer.
 * These are read synchronously: view state and pins in a field initializer of the panel, and overrides
 * inside query registration, before the first request. An async store cannot answer either in time, and a
 * scope that silently arrives late is worse than one that is missing. The mock library is the one that
 * could tolerate arriving late, since nothing is served until a mock is armed by hand.
 */
const INDEXED_DB_TITLE =
  'Unavailable: these are read synchronously - view state before the first render, overrides before the first fetch - and IndexedDB cannot answer in time. Only the mock library could tolerate an async store, and it is not wired to one yet.';

const LIMIT_ROWS: LimitRow[] = [
  {
    key: 'maxEvents',
    label: 'Events log',
    min: 10,
    max: 1000,
    step: 10,
    hint: 'rows the Events tab keeps. Lowering it trims the log now.',
  },
  {
    key: 'maxDroppedCacheEntries',
    label: 'Dropped cache entries',
    min: 0,
    max: 200,
    step: 5,
    hint: 'per client, remembered so the Cache tab can say why an entry went away. Applies as entries are dropped.',
  },
];

/**
 * Every panel-wide switch in one place - the storage each kind of state uses, the limits the panel would
 * otherwise hold as constants, and the toggles their own tabs also carry.
 */
@Component({
  selector: 'et-query-devtools-settings',
  templateUrl: './query-devtools-settings.component.html',
  styleUrl: './query-devtools-settings.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class QueryDevtoolsSettingsComponent {
  private document = inject(DOCUMENT);

  protected host = injectQueryDevtoolsHost();

  protected readonly SCOPE_ROWS = SCOPE_ROWS;
  protected readonly SCOPES = SCOPES;
  protected readonly INDEXED_DB_TITLE = INDEXED_DB_TITLE;
  protected readonly LIMIT_ROWS = LIMIT_ROWS;

  protected readonly ARM_ALL_MOCKS = armAllQueryDevtoolsMocks;
  protected readonly DISARM_ALL_MOCKS = clearQueryDevtoolsArmedMocks;
  protected readonly DISARM_ALL_FAULTS = clearQueryDevtoolsFaults;

  /** What queries actually retain, which is the application's value unless this panel raised it. */
  protected responseHistory = computed(queryDevtoolsResponseHistory);

  protected mockCount = computed(() => queryDevtoolsMocks().length);
  protected sessionCount = computed(() => queryDevtoolsAuthSessions().length);
  protected armedMockCount = computed(() => queryDevtoolsArmedMocks().size);
  protected armedFaultCount = computed(() => this.host.faultClients().filter((client) => client.armed).length);

  protected resetConfirming = signal(false);

  protected readonly FORGET_SESSIONS = clearQueryDevtoolsAuthSessions;

  /** The backends the application declared, or an empty list - the card renders only for a declared one. */
  protected apiEnvs = computed(queryDevtoolsApiEnvs);

  /** The env id (or typed URL) a switch's key holds, or `null` while the application picks for itself. */
  protected apiEnvValue(apiSwitch: QueryDevtoolsApiEnvSwitch) {
    return queryDevtoolsApiEnvValues()[apiSwitch.storageKey] ?? null;
  }

  /** The env a switch falls back to with nothing stored, described for the default button. */
  protected apiEnvFallback(apiSwitch: QueryDevtoolsApiEnvSwitch) {
    const fallback = apiSwitch.envs.find((env) => env.id === apiSwitch.fallback);

    return {
      label: fallback ? `default (${fallback.label ?? fallback.id})` : 'default',
      production: fallback?.production === true,
    };
  }

  /** Whether the pick in force - the stored env, or the fallback behind an unwritten key - is production. */
  protected apiEnvIsProduction(apiSwitch: QueryDevtoolsApiEnvSwitch) {
    const stored = this.apiEnvValue(apiSwitch);

    return apiSwitch.envs.find((env) => env.id === (stored ?? apiSwitch.fallback))?.production === true;
  }

  /** A stored value no declared env carries, which is a URL somebody typed in below. */
  protected apiEnvCustomUrl(apiSwitch: QueryDevtoolsApiEnvSwitch) {
    const stored = this.apiEnvValue(apiSwitch);

    return stored && !apiSwitch.envs.some((env) => env.id === stored) ? stored : '';
  }

  /** Writes the application's own key and reloads - it is read before Angular boots, so nothing else can. */
  protected pickApiEnv(apiSwitch: QueryDevtoolsApiEnvSwitch, value: string | null) {
    setQueryDevtoolsApiEnv(apiSwitch.storageKey, value);
    this.document.defaultView?.location.reload();
  }

  protected setCustomApiUrl(apiSwitch: QueryDevtoolsApiEnvSwitch, value: string) {
    const url = value.trim();

    if (url === this.apiEnvCustomUrl(apiSwitch)) return;

    this.pickApiEnv(apiSwitch, url || null);
  }

  protected settings() {
    return queryDevtoolsSettings();
  }

  protected scopeOf(key: ScopeKey) {
    return this.settings()[key];
  }

  protected limitOf(key: LimitKey) {
    return this.settings()[key];
  }

  /** What the picked scope means beyond where the state is kept, or `null` while it means nothing extra. */
  protected warningFor(row: ScopeRow, scope: QueryDevtoolsStorageScope) {
    return row.warn?.scopes.includes(scope) ? row.warn.text : null;
  }

  protected setScope(key: ScopeKey, scope: QueryDevtoolsStorageScope) {
    // Everything armed goes through its own module: changing the scope moves an existing store and
    // captures whatever is armed right now, so the choice reads as "keep these".
    if (key === 'overrides') return setQueryDevtoolsOverridesScope(scope);
    if (key === 'armedMocks') return setQueryDevtoolsArmedMocksScope(scope);
    if (key === 'armedFaults') return setQueryDevtoolsFaultsScope(scope);

    setQueryDevtoolsSettings(
      key === 'viewState'
        ? { viewState: scope }
        : key === 'pins'
          ? { pins: scope }
          : key === 'authSessions'
            ? { authSessions: scope }
            : { mocks: scope },
    );
  }

  protected setLimit(key: LimitKey, value: string) {
    const count = Number(value);

    setQueryDevtoolsSettings(key === 'maxEvents' ? { maxEvents: count } : { maxDroppedCacheEntries: count });
  }

  protected setResponseHistory(value: string) {
    setQueryDevtoolsSettings({ responseHistory: Number(value) });
  }

  /** Hands retention back to `provideQueryDevtools({ responseHistory })`. */
  protected clearResponseHistory() {
    setQueryDevtoolsSettings({ responseHistory: null });
  }

  protected reset() {
    this.host.resetDevtools();
    this.resetConfirming.set(false);
  }

  protected toggleGoneQueries() {
    this.host.toggleFacet('gone');
  }

  protected showsGoneQueries() {
    return this.host.queryFacets().has('gone');
  }
}
