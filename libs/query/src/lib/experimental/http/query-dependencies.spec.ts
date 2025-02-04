import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideQueryClient } from './query-client';
import { createQueryClientConfig } from './query-client-config';
import { setupQueryDependencies } from './query-dependencies';

describe('setupQueryDependencies', () => {
  const queryClientConfig = createQueryClientConfig({ baseUrl: 'https://example.com', name: 'test' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideQueryClient(queryClientConfig), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create', () => {
    TestBed.runInInjectionContext(() => {
      const deps = setupQueryDependencies({ clientConfig: queryClientConfig });

      expect(deps).toBeTruthy();
    });
  });
});
