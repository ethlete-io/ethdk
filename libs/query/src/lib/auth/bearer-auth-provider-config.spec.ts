import { createQueryClientConfig } from '../http/query-client-config';
import { createBearerAuthProviderConfig } from './bearer-auth-provider-config';

describe('createBearerAuthProviderConfig', () => {
  const queryClientRef = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

  it('should create', () => {
    const cfg = createBearerAuthProviderConfig({
      name: 'test',
      queryClientRef: queryClientRef.token,
    });

    expect(cfg).toBeTruthy();

    expect(cfg.name).toBe('test');
    expect(cfg.queryClientRef).toBe(queryClientRef.token);

    expect(cfg.token.toString()).toBe('InjectionToken BearerAuthProvider_test');
    expect(cfg.expiresInPropertyName).toBe('exp');
    expect(cfg.refreshBuffer).toBe(300000);
    expect(cfg.refreshOnUnauthorizedResponse).toBe(true);
  });

  it('should create with custom options', () => {
    const cfg2 = createBearerAuthProviderConfig({
      name: 'test_two',
      queryClientRef: queryClientRef.token,
      expiresInPropertyName: 'expires',
      refreshBuffer: 1000,
      refreshOnUnauthorizedResponse: false,
    });

    expect(cfg2).toBeTruthy();

    expect(cfg2.name).toBe('test_two');
    expect(cfg2.queryClientRef).toBe(queryClientRef.token);

    expect(cfg2.token.toString()).toBe('InjectionToken BearerAuthProvider_test_two');
    expect(cfg2.expiresInPropertyName).toBe('expires');
    expect(cfg2.refreshBuffer).toBe(1000);
    expect(cfg2.refreshOnUnauthorizedResponse).toBe(false);
  });
});
