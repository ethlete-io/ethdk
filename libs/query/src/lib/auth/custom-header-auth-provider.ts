import { QueryClient } from '../query-client';
import { AuthProvider, AuthProviderCustomHeaderConfig } from './auth-provider.types';

export class CustomHeaderAuthProvider implements AuthProvider {
  get header() {
    return { [this._config.name]: this._config.value };
  }

  queryClient: QueryClient | null = null;

  constructor(private _config: AuthProviderCustomHeaderConfig) {}

  cleanUp(): void {
    // noop
  }
}
