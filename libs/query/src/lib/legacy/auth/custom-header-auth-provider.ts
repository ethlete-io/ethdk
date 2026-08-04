import { AuthProvider, AuthProviderCustomHeaderConfig } from './auth-provider.types';

/**
 * @deprecated Part of the legacy (v2) query system. Migrate to the current query API - see https://ethlete-sdk-docs.web.app/query/migrating-from-v2, and run `nx g @ethlete/query:migrate-to-query-v3` to rewrite the mechanical parts. Intent to remove in v7.
 */
export class CustomHeaderAuthProvider implements AuthProvider {
  constructor(public _config: AuthProviderCustomHeaderConfig) {}
  get header() {
    return { [this._config.name]: this._config.value };
  }

  cleanUp() {
    // noop
  }
}
