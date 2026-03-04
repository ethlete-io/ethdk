import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQuery } from './query';
import { createQueryClient, QueryClientRef } from './query-client';

describe('createQuery', () => {
  let client: QueryClientRef;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  const make = () =>
    TestBed.runInInjectionContext(() =>
      createQuery({
        creatorInternals: { client, method: 'GET', route: '/test' },
        features: [],
        queryConfig: {},
      }),
    );

  it('should create a query with all expected properties', () => {
    const query = make();
    expect(query.args).toBeDefined();
    expect(query.response).toBeDefined();
    expect(query.loading).toBeDefined();
    expect(query.error).toBeDefined();
    expect(query.execute).toBeDefined();
    expect(query.subtle).toBeDefined();
    expect(typeof query.asReadonly).toBe('function');
    expect(typeof query.reset).toBe('function');
  });

  it('asReadonly should return a query without mutating methods', () => {
    const ro = make().asReadonly();
    expect(ro.args).toBeDefined();
    expect(ro.response).toBeDefined();
    expect((ro as unknown as { execute: unknown }).execute).toBeUndefined();
    expect((ro as unknown as { subtle: unknown }).subtle).toBeUndefined();
  });
});
