import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import {
  queryDevtoolsResponseHistory,
  queryDevtoolsSettings,
  QueryDevtoolsStorageScope,
  setQueryDevtoolsOverridesScope,
  setQueryDevtoolsSettings,
} from '@ethlete/query';
import { injectQueryDevtoolsHost } from './query-devtools-host';

type ScopeKey = 'viewState' | 'pins' | 'overrides';

type ScopeRow = {
  key: ScopeKey;
  label: string;

  /** What is kept, and what `none` costs - the one thing a scope picker cannot show on its own. */
  hint: string;
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
  },
];

const SCOPES: { value: QueryDevtoolsStorageScope; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'session', label: 'session' },
  { value: 'local', label: 'local' },
];

/**
 * Why IndexedDB - the one store with the quota for a large library of designed data - is not on offer.
 * All three keys are read synchronously: view state and pins in a field initializer of the panel, and
 * overrides inside query registration, before the first request. An async store cannot answer either in
 * time, and a scope that silently arrives late is worse than one that is missing.
 */
const INDEXED_DB_TITLE =
  'Unavailable: every one of these is read synchronously - view state before the first render, overrides before the first fetch - and IndexedDB cannot answer in time.';

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
  protected host = injectQueryDevtoolsHost();

  protected readonly SCOPE_ROWS = SCOPE_ROWS;
  protected readonly SCOPES = SCOPES;
  protected readonly INDEXED_DB_TITLE = INDEXED_DB_TITLE;
  protected readonly LIMIT_ROWS = LIMIT_ROWS;

  /** What queries actually retain, which is the application's value unless this panel raised it. */
  protected responseHistory = computed(queryDevtoolsResponseHistory);

  protected resetConfirming = signal(false);

  protected settings() {
    return queryDevtoolsSettings();
  }

  protected scopeOf(key: ScopeKey) {
    return this.settings()[key];
  }

  protected limitOf(key: LimitKey) {
    return this.settings()[key];
  }

  protected setScope(key: ScopeKey, scope: QueryDevtoolsStorageScope) {
    // Overrides go through their own module: changing their scope moves an existing store and captures
    // whatever is armed right now.
    if (key === 'overrides') {
      setQueryDevtoolsOverridesScope(scope);

      return;
    }

    setQueryDevtoolsSettings(key === 'viewState' ? { viewState: scope } : { pins: scope });
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
