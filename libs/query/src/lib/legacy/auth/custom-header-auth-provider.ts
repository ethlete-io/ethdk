import { AuthProvider, AuthProviderCustomHeaderConfig } from './auth-provider.types';

export class CustomHeaderAuthProvider implements AuthProvider {
  constructor(public _config: AuthProviderCustomHeaderConfig) {}
  get header() {
    return { [this._config.name]: this._config.value };
  }

  cleanUp() {
    // noop
  }
}
