import { CustomHeaderAuthProvider } from '../auth';
import { QueryClient } from './query-client';

describe('QueryClient', () => {
  let queryClient: QueryClient;
  let mockAuthProvider: CustomHeaderAuthProvider;
  let mockAuthProvider2: CustomHeaderAuthProvider;

  beforeEach(() => {
    queryClient = new QueryClient({
      baseRoute: 'http://localhost:3333',
    });
    mockAuthProvider = new CustomHeaderAuthProvider({ name: 'x-auth-token', value: '1234' });
    mockAuthProvider2 = new CustomHeaderAuthProvider({ name: 'x-auth-token-2', value: '12345' });
  });

  describe('setAuthProvider', () => {
    it('should set the auth provider', () => {
      queryClient.setAuthProvider(mockAuthProvider);
      expect(queryClient.authProvider).toBe(mockAuthProvider);
    });

    it('should cleanup the current auth provider if a new one gets supplied', () => {
      queryClient.setAuthProvider(mockAuthProvider);

      const mock = jest.spyOn(mockAuthProvider, 'cleanUp');

      queryClient.setAuthProvider(mockAuthProvider2);

      expect(mock).toHaveBeenCalled();
      expect(queryClient.authProvider).toBe(mockAuthProvider2);
    });
  });

  describe('_updateBaseRoute', () => {
    it('should update the base route', () => {
      expect(queryClient.config.baseRoute).toBe('http://localhost:3333');

      queryClient._updateBaseRoute('http://localhost:3334');

      expect(queryClient.config.baseRoute).toBe('http://localhost:3334');
    });
  });

  describe('clearAuthProvider', () => {
    it('should clear the auth provider', () => {
      // Set an auth provider first
      queryClient.setAuthProvider(mockAuthProvider);
      expect(queryClient.authProvider).toBe(mockAuthProvider);

      // Clear the auth provider
      queryClient.clearAuthProvider();
      expect(queryClient.authProvider).toBeNull();
    });

    it('should emit null to the authProvider$ observable', () => {
      // Set an auth provider first
      queryClient.setAuthProvider(mockAuthProvider);

      // Subscribe to the authProvider$ observable
      const mockSubscriber = jest.fn();
      queryClient.authProvider$.subscribe(mockSubscriber);

      // Clear the auth provider
      queryClient.clearAuthProvider();

      // Expect the mock subscriber to be called with null
      expect(mockSubscriber).toHaveBeenCalledWith(null);
    });

    it('should do nothing if there is no auth provider', () => {
      expect(queryClient.authProvider).toBeNull();
      queryClient.clearAuthProvider();
      expect(queryClient.authProvider).toBeNull();
    });
  });
});
