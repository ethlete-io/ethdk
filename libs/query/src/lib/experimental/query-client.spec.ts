import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient, provideQueryClient } from './query-client';
import { createQueryClientConfig } from './query-client-config';

describe('createQueryClient', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create', () => {
    const queryClientConfig = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

    TestBed.runInInjectionContext(() => {
      const queryClient = createQueryClient(queryClientConfig);

      expect(queryClient).toBeTruthy();
      expect(queryClient.repository).toBeTruthy();
    });
  });
});

describe('provideQueryClient', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create', () => {
    const queryClientConfig = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });
    const provider = provideQueryClient(queryClientConfig);

    expect(provider).toBeTruthy();

    TestBed.runInInjectionContext(() => {
      const client = provider.useFactory();
      expect(client).toBeTruthy();
      expect(client.repository).toBeTruthy();
    });
  });
});
