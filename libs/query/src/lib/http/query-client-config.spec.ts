import { createQueryClientConfig } from './query-client-config';

describe('createQueryClientConfig', () => {
  it('should create', () => {
    const queryClientRef = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

    expect(queryClientRef).toBeTruthy();

    expect(queryClientRef.name).toBe('test');

    expect(queryClientRef.token.toString()).toBe('InjectionToken QueryClient_test');
  });
});
