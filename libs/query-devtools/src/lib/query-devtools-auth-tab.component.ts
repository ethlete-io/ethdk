import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import {
  addQueryDevtoolsAuthAccount,
  QueryDevtoolsAuthField,
  queryDevtoolsAuthFieldsFor,
  clearQueryDevtoolsAuthCredentials,
  clearQueryDevtoolsAuthSessions,
  clearQueryDevtoolsTokenTtl,
  forgetQueryDevtoolsAuthSession,
  forgetQueryDevtoolsAuthSessionsFor,
  loginQueryDevtoolsAuthAccount,
  logoutQueryDevtoolsAuthSession,
  QUERY_DEVTOOLS_TOKEN_TTL_LIMIT,
  QueryDevtoolsAuthAccountView,
  QueryDevtoolsAuthSession,
  queryDevtoolsApiEnvIsProduction,
  queryDevtoolsAuthAccountsFor,
  queryDevtoolsAuthActive,
  queryDevtoolsAuthOtherScopeCount,
  queryDevtoolsAuthSessionsFor,
  queryDevtoolsAuthTabLocal,
  queryDevtoolsSettings,
  QueryDevtoolsEntry,
  removeQueryDevtoolsAuthAccount,
  renameQueryDevtoolsAuthSession,
  setQueryDevtoolsAuthCredentials,
  setQueryDevtoolsAuthTabLocal,
  setQueryDevtoolsSettings,
  setQueryDevtoolsTokenTtl,
  switchQueryDevtoolsAuthSession,
} from '@ethlete/query';
import { QueryDevtoolsFeaturesComponent } from './query-devtools-features.component';
import { injectQueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

/** `username, password` as typed in the add row, into the fields the login args are built from. */
const parseAuthFields = (value: string): QueryDevtoolsAuthField[] =>
  [...new Set(value.split(/[\s,]+/).filter(Boolean))].map((name) => ({
    name,
    type: /pass|secret|token/i.test(name) ? ('password' as const) : ('text' as const),
  }));

/** The Auth tab: registered bearer auth providers, their tokens, their sessions and their queries. */
@Component({
  selector: 'et-query-devtools-auth-tab',
  templateUrl: './query-devtools-auth-tab.component.html',
  styleUrl: './query-devtools-auth-tab.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsFeaturesComponent, QueryDevtoolsJsonComponent],
})
export class QueryDevtoolsAuthTabComponent {
  protected host = injectQueryDevtoolsHost();

  protected readonly TTL_LIMIT = QUERY_DEVTOOLS_TOKEN_TTL_LIMIT;

  /** Which accounts show their credential fields. Nothing is expanded until somebody asks for it. */
  private expandedAccounts = signal<ReadonlySet<string>>(new Set());

  /** Which providers show the form that adds an account of your own. */
  private addingFor = signal<ReadonlySet<string>>(new Set());

  /** Nothing of a real user is ever kept on this machine, so the whole vault stands down. */
  protected production = computed(queryDevtoolsApiEnvIsProduction);

  protected reloadOnSwitch = computed(() => queryDevtoolsSettings().reloadOnAuthSwitch);

  protected sessionsFor(entry: QueryDevtoolsEntry) {
    return queryDevtoolsAuthSessionsFor(this.providerName(entry));
  }

  protected accountsFor(entry: QueryDevtoolsEntry) {
    return queryDevtoolsAuthAccountsFor(this.providerName(entry));
  }

  /** How many sessions this provider holds for a backend the app is not pointed at now. */
  protected otherScopeCount(entry: QueryDevtoolsEntry) {
    return queryDevtoolsAuthOtherScopeCount(this.providerName(entry));
  }

  protected isActive(entry: QueryDevtoolsEntry, session: QueryDevtoolsAuthSession) {
    return queryDevtoolsAuthActive()[this.providerName(entry)] === session.id;
  }

  protected isTabLocal(entry: QueryDevtoolsEntry) {
    return queryDevtoolsAuthTabLocal()[this.providerName(entry)] === true;
  }

  /** The provider's own auth queries, which is what an account added here can log in through. */
  protected loginQueries(entry: QueryDevtoolsEntry) {
    return (entry.meta.authQueries ?? []).filter((query) => query.kind === 'auth').map((query) => query.key);
  }

  protected sessionAge(session: QueryDevtoolsAuthSession) {
    if (!session.savedAt) return 'unknown';

    const seconds = Math.round((Date.now() - session.savedAt) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;

    return `${Math.round(seconds / 3600)}h ago`;
  }

  /** Whether the stored access token is spent, which the refresh token is expected to fix on a switch. */
  protected isExpired(session: QueryDevtoolsAuthSession) {
    return session.expiresAt !== null && session.expiresAt * 1000 < Date.now();
  }

  protected switchTo(session: QueryDevtoolsAuthSession) {
    switchQueryDevtoolsAuthSession({ sessionId: session.id });
  }

  protected rename(session: QueryDevtoolsAuthSession, label: string) {
    if (label.trim() === '' || label === session.label) return;

    renameQueryDevtoolsAuthSession({ sessionId: session.id, label: label.trim() });
  }

  protected forget(session: QueryDevtoolsAuthSession) {
    forgetQueryDevtoolsAuthSession(session.id);
  }

  protected forgetAll(entry: QueryDevtoolsEntry) {
    forgetQueryDevtoolsAuthSessionsFor(this.providerName(entry));
  }

  protected logout(entry: QueryDevtoolsEntry) {
    logoutQueryDevtoolsAuthSession(this.providerName(entry));
  }

  protected toggleTabLocal(entry: QueryDevtoolsEntry) {
    setQueryDevtoolsAuthTabLocal({ provider: this.providerName(entry), tabLocal: !this.isTabLocal(entry) });
  }

  protected login(account: QueryDevtoolsAuthAccountView) {
    loginQueryDevtoolsAuthAccount(account.id);
  }

  protected isExpanded(account: QueryDevtoolsAuthAccountView) {
    return this.expandedAccounts().has(account.id);
  }

  protected toggleCredentials(account: QueryDevtoolsAuthAccountView) {
    this.expandedAccounts.update((current) => {
      const next = new Set(current);

      if (!next.delete(account.id)) next.add(account.id);

      return next;
    });
  }

  /** One field at a time, merged into what is already there - a login form here would be a form to build. */
  protected setCredential(options: { account: QueryDevtoolsAuthAccountView; field: string; value: string }) {
    const { account, field, value } = options;

    setQueryDevtoolsAuthCredentials({ accountId: account.id, values: { ...account.values, [field]: value } });
  }

  protected clearCredentials(account: QueryDevtoolsAuthAccountView) {
    clearQueryDevtoolsAuthCredentials(account.id);
  }

  protected removeAccount(account: QueryDevtoolsAuthAccountView) {
    removeQueryDevtoolsAuthAccount(account.id);
  }

  protected isAdding(entry: QueryDevtoolsEntry) {
    return this.addingFor().has(this.providerName(entry));
  }

  protected toggleAdding(entry: QueryDevtoolsEntry) {
    this.addingFor.update((current) => {
      const next = new Set(current);

      if (!next.delete(this.providerName(entry))) next.add(this.providerName(entry));

      return next;
    });
  }

  /** The keys the application's own accounts send on this provider, which a new one starts from. */
  protected defaultFieldNames(entry: QueryDevtoolsEntry) {
    return queryDevtoolsAuthFieldsFor(this.providerName(entry))
      .map((field) => field.name)
      .join(', ');
  }

  protected addAccount(options: { entry: QueryDevtoolsEntry; label: string; loginQuery: string; fields: string }) {
    const { entry, label, loginQuery } = options;

    if (label.trim() === '' || !loginQuery) return;

    const fields = parseAuthFields(options.fields);

    const id = addQueryDevtoolsAuthAccount({
      provider: this.providerName(entry),
      label: label.trim(),
      loginQuery,
      fields: fields.length ? fields : undefined,
    });

    this.expandedAccounts.update((current) => new Set(current).add(id));
    this.toggleAdding(entry);
  }

  protected setReloadOnSwitch(reload: boolean) {
    setQueryDevtoolsSettings({ reloadOnAuthSwitch: reload });
  }

  public forgetEverything() {
    clearQueryDevtoolsAuthSessions();
  }

  /**
   * Arms an access-token lifetime from the input's raw value, or disarms on an empty one. Clamped here
   * rather than left to the input's `min`/`max`, which a typed-in (or pasted) value ignores.
   */
  protected armTokenTtl(options: { entry: QueryDevtoolsEntry; value: string }) {
    const { entry, value } = options;

    if (value.trim() === '') {
      this.clearTokenTtl(entry);

      return;
    }

    setQueryDevtoolsTokenTtl({ providerName: this.providerName(entry), seconds: Number(value) });
  }

  /** Presents the current token as long expired, which is what makes a refresh happen at once. */
  protected expireTokenNow(entry: QueryDevtoolsEntry) {
    setQueryDevtoolsTokenTtl({ providerName: this.providerName(entry), seconds: 0 });
  }

  protected clearTokenTtl(entry: QueryDevtoolsEntry) {
    clearQueryDevtoolsTokenTtl(this.providerName(entry));
  }

  private providerName(entry: QueryDevtoolsEntry) {
    return entry.meta.name ?? '';
  }
}
