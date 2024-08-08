import { createBearerAuthProviderConfig } from './bearer-auth-provider-config';
import { createQueryClientConfig } from './query-client-config';

describe('createBearerAuthProviderConfig', () => {
  const queryClientRef = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

  it('should create', () => {
    const cfg = createBearerAuthProviderConfig({ name: 'test', queryClientRef: queryClientRef.token });

    expect(cfg).toBeTruthy();

    expect(cfg.name).toBe('test');
    expect(cfg.queryClientRef).toBe(queryClientRef.token);

    expect(cfg.token.toString()).toBe('InjectionToken BearerAuthProvider_test');
  });
});
