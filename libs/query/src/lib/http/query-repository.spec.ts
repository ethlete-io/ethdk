import { HttpClient, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DestroyRef, ErrorHandler, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createQueryRepository,
  CreateQueryRepositoryConfig,
  MAX_UNUSED_ENTRIES,
  QueryRepository,
  QueryRepositoryEvent,
} from './query-repository';

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

  describe('events$ on error -> retry -> success', () => {
    it('emits exactly one request-error then one request-success, with no spurious events', () => {
      const httpTesting = TestBed.inject(HttpTestingController);
      const events: QueryRepositoryEvent[] = [];
      repo.events$.subscribe((e) => events.push(e));

      const { request } = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });

      // 1. First attempt fails.
      httpTesting.expectOne((r) => r.url.includes('/test')).flush('boom', { status: 500, statusText: 'Server Error' });
      TestBed.tick();

      // 2. Re-execute the same request -> succeeds.
      request.execute();
      httpTesting.expectOne((r) => r.url.includes('/test')).flush({ ok: true });
      TestBed.tick();

      const types = events.map((e) => e.type);
      expect(types).toEqual(['request-error', 'request-success']);
    });
  });
});

describe('createQueryRepository — keepUnusedFor (unused entry retention)', () => {
  let destroyRef: DestroyRef;
  let httpTesting: HttpTestingController;

  const createRepo = (options: Partial<CreateQueryRepositoryConfig> = {}) => {
    let repo!: QueryRepository;

    TestBed.runInInjectionContext(() => {
      repo = createQueryRepository({
        baseUrl: 'https://example.com',
        name: 'test',
        dependencies: {
          httpClient: TestBed.inject(HttpClient),
          ngErrorHandler: TestBed.inject(ErrorHandler),
          injector: TestBed.inject(Injector),
        },
        ...options,
      });
    });

    return repo;
  };

  /** Settles every request the repository has in flight, so entries actually hold a response. */
  const flushAll = (body: unknown = { ok: true }) => {
    for (const req of httpTesting.match(() => true)) {
      req.flush(body);
    }

    TestBed.tick();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });

    destroyRef = TestBed.inject(DestroyRef);
    httpTesting = TestBed.inject(HttpTestingController);

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps an entry that holds a response after its last consumer unbound', () => {
    const repo = createRepo({ keepUnusedFor: 1000 });

    const first = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    flushAll({ id: 1 });

    repo.unbind(first.key, destroyRef);

    const entries = repo.subtle.cacheEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.isUnused).toBe(true);
    // The point of retention: the response survives, so a returning consumer renders it immediately.
    expect(entries[0]?.request.response()).toEqual({ id: 1 });

    const second = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });

    expect(second.request).toBe(first.request);
    expect(second.request.response()).toEqual({ id: 1 });
    expect(repo.subtle.cacheEntries()[0]?.isUnused).toBe(false);
  });

  it('evicts the entry once the window elapsed', () => {
    const repo = createRepo({ keepUnusedFor: 1000 });

    const first = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    flushAll();

    let completed = false;
    first.request.events$.subscribe({ complete: () => (completed = true) });

    repo.unbind(first.key, destroyRef);
    vi.advanceTimersByTime(999);
    expect(repo.subtle.cacheEntries()).toHaveLength(1);

    vi.advanceTimersByTime(1);

    expect(repo.subtle.cacheEntries()).toHaveLength(0);
    expect(completed).toBe(true);

    // A consumer arriving after the eviction gets a brand new request.
    const second = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    expect(second.request).not.toBe(first.request);
  });

  it('cancels the pending eviction when a consumer binds again', () => {
    const repo = createRepo({ keepUnusedFor: 1000 });

    const first = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    flushAll();

    repo.unbind(first.key, destroyRef);
    vi.advanceTimersByTime(500);

    repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    vi.advanceTimersByTime(5000);

    expect(repo.subtle.cacheEntries()).toHaveLength(1);
  });

  it('destroys an entry that never produced a response, regardless of the window', () => {
    const repo = createRepo({ keepUnusedFor: 60_000 });

    const req = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });

    // Unbound while still in flight — there is no data worth keeping, so the request is aborted.
    repo.unbind(req.key, destroyRef);

    expect(repo.subtle.cacheEntries()).toHaveLength(0);
  });

  it('destroys immediately when keepUnusedFor is 0', () => {
    const repo = createRepo({ keepUnusedFor: 0 });

    const req = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    flushAll();

    repo.unbind(req.key, destroyRef);

    expect(repo.subtle.cacheEntries()).toHaveLength(0);
  });

  it('lets a query creator override the client level window', () => {
    const repo = createRepo({ keepUnusedFor: 60_000 });

    const req = repo.request({
      consumerDestroyRef: destroyRef,
      method: 'GET',
      route: '/test',
      creatorOptions: { keepUnusedFor: 0 },
    });
    flushAll();

    repo.unbind(req.key, destroyRef);

    expect(repo.subtle.cacheEntries()).toHaveLength(0);
  });

  it('never retains uncacheable requests', () => {
    const repo = createRepo({ keepUnusedFor: 60_000 });

    const req = repo.request({ consumerDestroyRef: destroyRef, method: 'POST', route: '/test' });
    flushAll();

    repo.unbind(req.key, destroyRef);

    expect(repo.subtle.cacheEntries()).toHaveLength(0);
  });

  it('does not retain anything when retention is disabled (server)', () => {
    const repo = createRepo({ keepUnusedFor: 60_000, retentionEnabled: false });

    const req = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test' });
    flushAll();

    repo.unbind(req.key, destroyRef);

    expect(repo.subtle.cacheEntries()).toHaveLength(0);
  });

  it('caps the number of unused entries, dropping the least recently orphaned first', () => {
    const repo = createRepo({ keepUnusedFor: 600_000 });

    const overflow = 5;
    const keys: string[] = [];

    for (let i = 0; i < MAX_UNUSED_ENTRIES + overflow; i++) {
      keys.push(repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: `/test-${i}` }).key);
    }

    flushAll();

    for (const key of keys) {
      repo.unbind(key, destroyRef);
      // Keep the orphaning timestamps distinct so the eviction order is unambiguous.
      vi.advanceTimersByTime(1);
    }

    const remaining = repo.subtle.cacheEntries().map((entry) => entry.key);

    expect(remaining).toHaveLength(MAX_UNUSED_ENTRIES);
    expect(remaining).not.toContain(keys[0]);
    expect(remaining).not.toContain(keys[overflow - 1]);
    expect(remaining).toContain(keys[overflow]);
    expect(remaining).toContain(keys.at(-1));
  });

  it('force destroys retained secure entries on unbindAllSecure', () => {
    const repo = createRepo({ keepUnusedFor: 600_000 });

    const req = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/test', isSecure: true });
    flushAll();

    let completed = false;
    req.request.events$.subscribe({ complete: () => (completed = true) });

    repo.unbind(req.key, destroyRef);
    expect(repo.subtle.cacheEntries()).toHaveLength(1);

    // Logging out must not leave an authenticated response body sitting out its window.
    repo.unbindAllSecure();

    expect(repo.subtle.cacheEntries()).toHaveLength(0);
    expect(completed).toBe(true);

    // The cancelled eviction timer must not fire against the now missing entry either.
    expect(() => vi.advanceTimersByTime(600_000)).not.toThrow();
  });

  it('keeps unsecure entries when secure ones are unbound', () => {
    const repo = createRepo({ keepUnusedFor: 600_000 });

    const secure = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/secure', isSecure: true });
    const open = repo.request({ consumerDestroyRef: destroyRef, method: 'GET', route: '/open' });
    flushAll();

    repo.unbind(secure.key, destroyRef);
    repo.unbind(open.key, destroyRef);

    repo.unbindAllSecure();

    expect(repo.subtle.cacheEntries().map((entry) => entry.key)).toEqual([open.key]);
  });
});
