import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from './query-client';
import { setupQueryDependencies } from './query-dependencies';

describe('setupQueryDependencies', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'test' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('should create', () => {
    TestBed.runInInjectionContext(() => {
      const deps = setupQueryDependencies({ client, queryConfig: {} });

      expect(deps).toBeTruthy();
    });
  });
});
