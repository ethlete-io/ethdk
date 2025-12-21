import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from './query-client';

describe('createQueryClient', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create', () => {
    const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });
    const [provideClient, injectClient, clientToken] = client;

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const queryClient = TestBed.inject(clientToken);
    expect(queryClient).toBeTruthy();
    expect(queryClient.repository).toBeTruthy();
  });

  it('should create using inject function', () => {
    const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });
    const [provideClient, injectClient] = client;

    TestBed.configureTestingModule({
      providers: [provideClient(), provideHttpClient(), provideHttpClientTesting()],
    });

    TestBed.runInInjectionContext(() => {
      const queryClient = injectClient();
      expect(queryClient).toBeTruthy();
      expect(queryClient.repository).toBeTruthy();
    });
  });
});
