import { AuthProvider, AuthProviderBasicConfig } from './auth-provider.types';

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
