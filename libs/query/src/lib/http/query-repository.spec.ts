import { HttpClient, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef, ErrorHandler, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createQueryRepository, QueryRepository } from './query-repository';

describe('createQueryRepository', () => {
  let repo: QueryRepository;
  let destroyRef: DestroyRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    TestBed.runInInjectionContext(() => {
      repo = createQueryRepository({
        baseUrl: 'https://example.com',
        name: 'test',
        dependencies: {
          httpClient: TestBed.inject(HttpClient),
          ngErrorHandler: TestBed.inject(ErrorHandler),
          injector: TestBed.inject(Injector),
        },
      });
    });

    destroyRef = TestBed.inject(DestroyRef);
  });

  it('should create', () => {
    expect(repo).toBeTruthy();
  });

  it('should return a request if request gets called', () => {
    const req = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    const req2 = repo.request({ consumerDestroyRef: destroyRef, method: 'OPTIONS', route: '/test' });
    const req3 = repo.request({ consumerDestroyRef: destroyRef, method: 'HEAD', route: '/test' });

    expect(req).toBeTruthy();

    const expectedKey = '441402764';

    expect(req.key).toBe(expectedKey);
    expect(req2.key).toBe(expectedKey);
    expect(req3.key).toBe(expectedKey);

    let headers = new HttpHeaders();
    headers = headers.append('Authorization ', 'Bearer token');
    const req4 = repo.request({
      consumerDestroyRef: destroyRef,
      method: 'GET',
      route: '/test',
      args: { body: { foo: true }, headers, pathParams: { userId: 'abc123' }, queryParams: { page: 1 } },
    });

    const expectedKey2 = '2137832378';
    expect(req4.key).toBe(expectedKey2);
  });

  it('should return a request with a UUID key if request cant be cached', () => {
    const req = repo.request({ consumerDestroyRef: destroyRef, method: 'POST', route: '/test' });
    const req2 = repo.request({ consumerDestroyRef: destroyRef, method: 'PUT', route: '/test' });
    const req3 = repo.request({ consumerDestroyRef: destroyRef, method: 'PATCH', route: '/test' });
    const req4 = repo.request({ consumerDestroyRef: destroyRef, method: 'DELETE', route: '/test' });

    // Uncacheable requests should have UUID keys (not false)
    expect(typeof req.key).toBe('string');
    expect(typeof req2.key).toBe('string');
    expect(typeof req3.key).toBe('string');
    expect(typeof req4.key).toBe('string');

    // Each UUID should be unique
    expect(req.key).not.toBe(req2.key);
    expect(req.key).not.toBe(req3.key);
    expect(req.key).not.toBe(req4.key);
  });

  it('should change the resulting key if a prefix if set', () => {
    const req1 = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    const expectedKey1 = '441402764';

    expect(req1.key).toBe(expectedKey1);

    const req2 = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test', key: 'custom' });
    const expectedKey2 = '3672919614';

    expect(req2.key).toBe(expectedKey2);
  });

  it('unbind should work', () => {
    const req1 = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });

    const res = repo.unbind(req1.key, destroyRef);

    expect(res).toBe(true);

    const res2 = repo.unbind(req1.key, destroyRef);

    expect(res2).toBe(false);

    const res4 = repo.unbind('not existing key', destroyRef);

    expect(res4).toBe(false);
  });

  it('allowCache should work', () => {
    const req1 = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    const req2 = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });

    expect(req1.request).toBe(req2.request);

    const req3 = repo.request({
      consumerDestroyRef: destroyRef,
      method: 'GET',
      route: '/test',
      runQueryOptions: { allowCache: true },
    });

    expect(req3.request).toBe(req3.request);
  });

  it('should throw if allowCache is used on a uncacheable request', () => {
    expect(() =>
      repo.request({
        consumerDestroyRef: destroyRef,
        method: 'POST',
        route: '/test',
        runQueryOptions: { allowCache: true },
      }),
    ).toThrow();
  });

  it('should throw if key is used on a uncacheable request', () => {
    expect(() =>
      repo.request({ consumerDestroyRef: destroyRef, method: 'POST', route: '/test', key: 'my_key' }),
    ).toThrow();
  });
});
