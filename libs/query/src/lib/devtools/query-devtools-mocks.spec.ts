import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQuery } from '../http/query';
import { createQueryClient, QueryClientRef } from '../http/query-client';
import {
  armAllQueryDevtoolsMocks,
  armQueryDevtoolsMock,
  clearQueryDevtoolsArmedMocks,
  clearQueryDevtoolsMockStore,
  deleteQueryDevtoolsMock,
  initQueryDevtoolsMocks,
  matchesQueryDevtoolsMockPattern,
  matchesQueryDevtoolsMockQuery,
  QueryDevtoolsMock,
  queryDevtoolsArmedMocks,
  queryDevtoolsArmedMocksRestored,
  queryDevtoolsMockId,
  queryDevtoolsMocks,
  queryDevtoolsRequestPath,
  saveQueryDevtoolsMock,
  setQueryDevtoolsArmedMocksScope,
} from './query-devtools-mocks';
import { provideQueryDevtools } from './query-devtools-registry';
import { initQueryDevtoolsSettings, setQueryDevtoolsSettings } from './query-devtools-settings';

const STORAGE_KEY = 'ethlete:query:devtools:mocks:v1';
const ARMED_STORAGE_KEY = 'ethlete:query:devtools:mocks:armed:v1';

const mockOf = (patch: Partial<QueryDevtoolsMock> = {}): QueryDevtoolsMock => {
  const base = {
    clientName: 'mock-test',
    method: 'GET',
    pattern: '/posts/:id',
    ...patch,
  };

  return {
    query: '',
    status: 200,
    body: { title: 'designed' },
    latencyMs: 0,
    capturedAt: null,
    ...base,
    id: patch.id ?? queryDevtoolsMockId(base),
  };
};

describe('query devtools mocks', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    initQueryDevtoolsSettings();
    initQueryDevtoolsMocks();
  });

  describe('matching', () => {
    it('should read the path out of a request url, without origin or query string', () => {
      expect(queryDevtoolsRequestPath('https://api.example.com/posts/12?draft=true')).toBe('/posts/12');
      expect(queryDevtoolsRequestPath('/posts/12')).toBe('/posts/12');
      expect(queryDevtoolsRequestPath('https://api.example.com')).toBe('/');
    });

    it('should match a param segment against any single segment', () => {
      expect(matchesQueryDevtoolsMockPattern('/posts/:id', '/posts/12')).toBe(true);
      expect(matchesQueryDevtoolsMockPattern('/posts/:id', '/posts/anything')).toBe(true);
      expect(matchesQueryDevtoolsMockPattern('/posts/:id/comments', '/posts/12/comments')).toBe(true);
    });

    it('should not match a different route of the same shape', () => {
      expect(matchesQueryDevtoolsMockPattern('/posts/:id', '/users/12')).toBe(false);
      expect(matchesQueryDevtoolsMockPattern('/posts/:id', '/posts/12/comments')).toBe(false);
      expect(matchesQueryDevtoolsMockPattern('/posts/:id', '/posts')).toBe(false);
    });

    it('should require every query parameter it declares, and ignore the rest', () => {
      const url = 'https://api.example.com/posts?page=2&limit=10';

      expect(matchesQueryDevtoolsMockQuery('', url)).toBe(true);
      expect(matchesQueryDevtoolsMockQuery('page=2', url)).toBe(true);
      expect(matchesQueryDevtoolsMockQuery('page=2&limit=10', url)).toBe(true);
      expect(matchesQueryDevtoolsMockQuery('page=3', url)).toBe(false);
      expect(matchesQueryDevtoolsMockQuery('draft=true', url)).toBe(false);
      expect(matchesQueryDevtoolsMockQuery('page=2', 'https://api.example.com/posts')).toBe(false);
    });
  });

  describe('the library', () => {
    it('should persist a designed mock and read it back on the next load', () => {
      saveQueryDevtoolsMock(mockOf());

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);

      initQueryDevtoolsMocks();

      expect(queryDevtoolsMocks()).toHaveLength(1);
      expect(queryDevtoolsMocks()[0]?.body).toEqual({ title: 'designed' });
    });

    it('should replace the mock already under an id rather than adding a second', () => {
      saveQueryDevtoolsMock(mockOf());
      saveQueryDevtoolsMock(mockOf({ status: 404 }));

      expect(queryDevtoolsMocks()).toHaveLength(1);
      expect(queryDevtoolsMocks()[0]?.status).toBe(404);
    });

    it('should not keep which mocks are armed, unless the setting asks for it', () => {
      const mock = mockOf();
      saveQueryDevtoolsMock(mock);
      armQueryDevtoolsMock(mock.id, true);

      expect(queryDevtoolsArmedMocks().has(mock.id)).toBe(true);

      initQueryDevtoolsMocks();

      expect(queryDevtoolsMocks()).toHaveLength(1);
      expect(queryDevtoolsArmedMocks().size).toBe(0);
      expect(queryDevtoolsArmedMocksRestored()).toBe(false);
    });

    it('should arm every mock in the library at once', () => {
      saveQueryDevtoolsMock(mockOf());
      saveQueryDevtoolsMock(mockOf({ pattern: '/users/:id' }));

      armAllQueryDevtoolsMocks();

      expect(queryDevtoolsArmedMocks().size).toBe(2);

      clearQueryDevtoolsArmedMocks();

      expect(queryDevtoolsArmedMocks().size).toBe(0);
    });

    it('should keep the armed set at a scope that asks for it, and say it came back', () => {
      const mock = mockOf();
      saveQueryDevtoolsMock(mock);
      setQueryDevtoolsArmedMocksScope('local');
      armQueryDevtoolsMock(mock.id, true);

      initQueryDevtoolsMocks();

      expect(queryDevtoolsArmedMocks().has(mock.id)).toBe(true);
      expect(queryDevtoolsArmedMocksRestored()).toBe(true);

      armQueryDevtoolsMock(mock.id, false);

      expect(queryDevtoolsArmedMocksRestored()).toBe(false);
    });

    it('should capture what is armed when the scope starts keeping it, and drop it again on none', () => {
      const mock = mockOf();
      saveQueryDevtoolsMock(mock);
      armQueryDevtoolsMock(mock.id, true);

      setQueryDevtoolsArmedMocksScope('session');

      expect(JSON.parse(sessionStorage.getItem(ARMED_STORAGE_KEY) ?? '[]')).toEqual([mock.id]);

      setQueryDevtoolsArmedMocksScope('none');

      expect(sessionStorage.getItem(ARMED_STORAGE_KEY)).toBeNull();
      expect(queryDevtoolsArmedMocks().has(mock.id)).toBe(true);
    });

    it('should drop an armed id the library no longer holds', () => {
      setQueryDevtoolsArmedMocksScope('local');
      localStorage.setItem(ARMED_STORAGE_KEY, JSON.stringify(['gone|GET|/posts', 42]));

      initQueryDevtoolsMocks();

      expect(queryDevtoolsArmedMocks().size).toBe(0);
    });

    it('should refuse to arm a mock that is not in the library', () => {
      armQueryDevtoolsMock('nothing|GET|/posts', true);

      expect(queryDevtoolsArmedMocks().size).toBe(0);
    });

    it('should disarm a mock it deletes', () => {
      const mock = mockOf();
      saveQueryDevtoolsMock(mock);
      armQueryDevtoolsMock(mock.id, true);

      deleteQueryDevtoolsMock(mock.id);

      expect(queryDevtoolsMocks()).toEqual([]);
      expect(queryDevtoolsArmedMocks().size).toBe(0);
    });

    it('should store nothing at a scope of none', () => {
      setQueryDevtoolsSettings({ mocks: 'none' });
      saveQueryDevtoolsMock(mockOf());

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(queryDevtoolsMocks()).toHaveLength(1);
    });

    it('should ignore entries a hand-edited store left unusable', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([mockOf(), { nonsense: true }, null]));
      initQueryDevtoolsMocks();

      expect(queryDevtoolsMocks()).toHaveLength(1);
    });
  });

  describe('serving one', () => {
    let client: QueryClientRef;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
      vi.useFakeTimers();

      client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'mock-test' });

      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), provideQueryDevtools()],
      });

      httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      clearQueryDevtoolsMockStore();
      vi.useRealTimers();
    });

    const makeQuery = (route: string | ((args: { pathParams: { id: string } }) => string) = '/posts/12') =>
      TestBed.runInInjectionContext(() =>
        createQuery({
          creatorInternals: { client, method: 'GET', route },
          features: [],
          queryConfig: {},
        }),
      );

    const arm = (patch: Partial<QueryDevtoolsMock> = {}) => {
      const mock = mockOf(patch);
      saveQueryDevtoolsMock(mock);
      armQueryDevtoolsMock(mock.id, true);

      return mock;
    };

    it('should answer with the designed body without touching the network', () => {
      arm();

      const query = makeQuery();
      vi.advanceTimersByTime(0);

      httpTesting.expectNone('https://api.example.com/posts/12');
      expect(query.response()).toEqual({ title: 'designed' });
      expect(query.error()).toBeNull();
    });

    it('should never settle in the tick that started the request', () => {
      arm();

      const query = makeQuery();

      expect(query.response()).toBeNull();
      expect(query.loading()).not.toBeNull();
    });

    it('should hold the loading state for the designed latency', () => {
      arm({ latencyMs: 400 });

      const query = makeQuery();
      vi.advanceTimersByTime(399);

      expect(query.response()).toBeNull();

      vi.advanceTimersByTime(1);

      expect(query.response()).toEqual({ title: 'designed' });
    });

    it('should deliver a designed failure as a real error, body and all', () => {
      arm({ status: 422, body: { message: 'nope' } });

      const query = makeQuery();
      vi.advanceTimersByTime(0);

      httpTesting.expectNone('https://api.example.com/posts/12');
      expect(query.error()?.code).toBe(422);
    });

    it('should let a request through once the mock is disarmed', () => {
      const mock = arm();

      const query = makeQuery();
      vi.advanceTimersByTime(0);

      expect(query.response()).toEqual({ title: 'designed' });

      armQueryDevtoolsMock(mock.id, false);
      query.execute();

      httpTesting.expectOne('https://api.example.com/posts/12').flush({ title: 'real' });
      expect(query.response()).toEqual({ title: 'real' });
    });

    it('should leave a route the pattern does not describe alone', () => {
      arm({ pattern: '/users/:id' });

      makeQuery();

      httpTesting.expectOne('https://api.example.com/posts/12').flush({ title: 'real' });
    });

    it('should answer only the query string it declares', () => {
      arm({ pattern: '/posts', query: 'page=2' });

      const query = makeQuery('/posts?page=1');
      vi.advanceTimersByTime(0);

      httpTesting.expectOne('https://api.example.com/posts?page=1').flush({ title: 'real' });
      expect(query.response()).toEqual({ title: 'real' });

      const matching = makeQuery('/posts?page=2');
      vi.advanceTimersByTime(0);

      expect(matching.response()).toEqual({ title: 'designed' });
    });

    it('should prefer the armed mock that names the most query parameters', () => {
      arm({ pattern: '/posts', body: { title: 'any page' } });
      arm({ pattern: '/posts', query: 'page=2', body: { title: 'page two' } });

      const query = makeQuery('/posts?page=2');
      vi.advanceTimersByTime(0);

      expect(query.response()).toEqual({ title: 'page two' });
    });

    it('should leave another client alone', () => {
      arm({ clientName: 'someone-else' });

      makeQuery();

      httpTesting.expectOne('https://api.example.com/posts/12').flush({ title: 'real' });
    });

    it('should stop serving everything at once', () => {
      arm();
      clearQueryDevtoolsArmedMocks();

      makeQuery();

      httpTesting.expectOne('https://api.example.com/posts/12').flush({ title: 'real' });
    });
  });
});
