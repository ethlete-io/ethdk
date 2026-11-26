import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from './query-client';
import { withMultiTabSync, withQueryPersistence } from './query-client-features';

describe('createQueryClient', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create', () => {
    const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });
    const { token: clientToken } = client;

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const queryClient = TestBed.inject(clientToken);
    expect(queryClient).toBeTruthy();
    expect(queryClient.repository).toBeTruthy();
  });

  it('should create using inject function', () => {
    const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });
    const { provide: provideClient, inject: injectClient } = client;

    TestBed.configureTestingModule({
      providers: [provideClient(), provideHttpClient(), provideHttpClientTesting()],
    });

    TestBed.runInInjectionContext(() => {
      const queryClient = injectClient();
      expect(queryClient).toBeTruthy();
      expect(queryClient.repository).toBeTruthy();
    });
  });

  describe('features', () => {
    it('has neither sync nor persistence without features', async () => {
      const client = createQueryClient({ baseUrl: 'https://example.com', name: 'no-features' });
      const queryClient = TestBed.inject(client.token);

      expect(queryClient.subtle.sync).toBeNull();
      expect(queryClient.subtle.persistence).toBeNull();

      await expect(queryClient.whenPersistenceReady).resolves.toBeUndefined();
      await expect(queryClient.clearPersistedQueries()).resolves.toBeUndefined();
    });

    it('sets up the features it is given', () => {
      const client = createQueryClient({
        baseUrl: 'https://example.com',
        name: 'featured',
        features: [withMultiTabSync(), withQueryPersistence()],
      });
      const queryClient = TestBed.inject(client.token);

      expect(queryClient.subtle.sync).not.toBeNull();
      expect(queryClient.subtle.persistence).not.toBeNull();
    });

    it('throws when a feature is used twice', () => {
      const client = createQueryClient({
        baseUrl: 'https://example.com',
        name: 'duplicate',
        features: [withMultiTabSync(), withMultiTabSync()],
      });

      expect(() => TestBed.inject(client.token)).toThrow(/used multiple times/);
    });
  });
});
