import { AuthProvider, AuthProviderBasicConfig } from './auth-provider.types';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export class BasicAuthProvider implements AuthProvider {
  constructor(public _config: AuthProviderBasicConfig) {}
  get header() {
    return { Authorization: `Basic ${this.basicAuthString}` };
  }

  cleanUp() {
    // noop
  }

  private get basicAuthString() {
    return btoa(`${this._config.username}:${this._config.password}`);
  }
}
