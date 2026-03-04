import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  contentfulGqlLikePaginationAdapter,
  createPagedQueryStack,
  dynLikePaginationAdapter,
  ethletePaginationAdapter,
  fakePaginationAdapter,
  ggLikePaginationAdapter,
} from './paged-query-stack';
import { createQueryClient } from './query-client';
import { createQueryCreator } from './query-creator';

type PageItem = { id: number };

type PagedArgs = {
  response: { items: PageItem[]; currentPage: number; totalPages: number };
  queryParams: { page: number };
};

const normalizer = (response: PagedArgs['response']) => ({
  items: response.items,
  currentPage: response.currentPage,
  totalPages: response.totalPages,
  itemsPerPage: response.items.length,
  totalHits: response.totalPages * response.items.length,
});

const makeResponse = (currentPage: number, totalPages: number): PagedArgs['response'] => ({
  items: [{ id: currentPage * 10 }],
  currentPage,
  totalPages,
});

const queryAt = <T>(queries: T[], index: number): T => {
  const q = queries[index];
  if (q === undefined) throw new Error(`Expected query at index ${index}`);
  return q;
};

describe('createPagedQueryStack', () => {
  let client: ReturnType<typeof createQueryClient>;
  let queryCreator: ReturnType<typeof createQueryCreator<PagedArgs>>;

  beforeEach(() => {
    client = createQueryClient({ baseUrl: 'https://api.example.com', name: 'test' });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    queryCreator = createQueryCreator<PagedArgs>(undefined, { client, method: 'GET', route: '/items' });
  });

  const makeStack = () =>
    TestBed.runInInjectionContext(() =>
      createPagedQueryStack({
        queryCreator,
        responseNormalizer: normalizer,
        args: (page) => ({ queryParams: { page } }),
      }),
    );

  it('should create an initial query after initialisation', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();
      expect(stack.queries()).toHaveLength(1);
    });
  });

  it('canFetchNextPage and canFetchPreviousPage should both be false before a response is received', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();
      expect(stack.canFetchNextPage()).toBe(false);
      expect(stack.canFetchPreviousPage()).toBe(false);
    });
  });

  it('canFetchNextPage should be true after a response with multiple pages', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 3));

      expect(stack.canFetchNextPage()).toBe(true);
      expect(stack.canFetchPreviousPage()).toBe(false);
    });
  });

  it('canFetchNextPage should be false when on the last page', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 1));

      expect(stack.canFetchNextPage()).toBe(false);
    });
  });

  it('isLastPageLoaded and isFirstPageLoaded should be true when there is only one page', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 1));

      expect(stack.isLastPageLoaded()).toBe(true);
      expect(stack.isFirstPageLoaded()).toBe(true);
    });
  });

  it('isLastPageLoaded should be false when there are more pages to fetch', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 5));

      expect(stack.isLastPageLoaded()).toBe(false);
    });
  });

  it('fetchNextPage should add a second query to the stack', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 3));
      stack.fetchNextPage();
      TestBed.tick();

      expect(stack.queries()).toHaveLength(2);
    });
  });

  it('fetchNextPage should throw when called beyond the last page', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 1));

      expect(() => stack.fetchNextPage()).toThrow();
      expect(stack.queries()).toHaveLength(1);
    });
  });

  it('direction should default to next', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();
      expect(stack.direction()).toBe('next');
    });
  });

  it('direction should switch to previous when fetchPreviousPage is called', () => {
    TestBed.runInInjectionContext(() => {
      const stack = TestBed.runInInjectionContext(() =>
        createPagedQueryStack({
          queryCreator,
          responseNormalizer: normalizer,
          args: (page) => ({ queryParams: { page } }),
          initialPage: 2,
        }),
      );
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(2, 5));
      stack.fetchPreviousPage();

      expect(stack.direction()).toBe('previous');
    });
  });

  it('items should aggregate items across all loaded pages', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 2));
      stack.fetchNextPage();
      TestBed.tick();

      queryAt(stack.queries(), 1).subtle.setResponse(makeResponse(2, 2));

      expect(stack.items()).toHaveLength(2);
      expect(stack.items()[0]).toEqual({ id: 10 }); // page 1
      expect(stack.items()[1]).toEqual({ id: 20 }); // page 2
    });
  });

  it('reset should clear queries and restart from the initial page', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      queryAt(stack.queries(), 0).subtle.setResponse(makeResponse(1, 3));
      stack.fetchNextPage();
      TestBed.tick();
      expect(stack.queries()).toHaveLength(2);

      stack.reset();
      TestBed.tick();

      expect(stack.queries()).toHaveLength(1);
    });
  });

  it('reset with a custom initialPage should start from that page', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      stack.reset({ initialPage: 3 });
      TestBed.tick();

      expect(stack.queries()).toHaveLength(1);
    });
  });

  it('loading should be true while the initial request is in flight', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();

      // The init effect fires an HTTP request — loading is true until a response arrives
      expect(stack.loading()).toBe(true);
    });
  });

  it('error should be null when no errors have occurred', () => {
    TestBed.runInInjectionContext(() => {
      const stack = makeStack();
      TestBed.tick();
      expect(stack.error()).toBeNull();
    });
  });
});

describe('pagination adapters', () => {
  describe('ethletePaginationAdapter', () => {
    it('should normalize an ethlete paginated response', () => {
      const result = ethletePaginationAdapter({
        items: ['a'],
        totalPageCount: 5,
        currentPage: 2,
        itemsPerPage: 10,
        totalHits: 42,
        nextPage: 3,
      });
      expect(result).toEqual({ items: ['a'], totalPages: 5, currentPage: 2, itemsPerPage: 10, totalHits: 42 });
    });
  });

  describe('ggLikePaginationAdapter', () => {
    it('should normalize a GG-like paginated response', () => {
      const result = ggLikePaginationAdapter({
        items: ['b'],
        totalPageCount: 3,
        currentPage: 1,
        itemsPerPage: 20,
        totalHits: 60,
      });
      expect(result).toEqual({ items: ['b'], totalPages: 3, currentPage: 1, itemsPerPage: 20, totalHits: 60 });
    });
  });

  describe('dynLikePaginationAdapter', () => {
    it('should normalize a Dyn-like paginated response', () => {
      const result = dynLikePaginationAdapter({
        items: ['c'],
        totalPages: 4,
        currentPage: 2,
        limit: 15,
        totalHits: 55,
      });
      expect(result).toEqual({ items: ['c'], totalPages: 4, currentPage: 2, itemsPerPage: 15, totalHits: 55 });
    });
  });

  describe('contentfulGqlLikePaginationAdapter', () => {
    it('should compute currentPage and totalPages from skip and limit', () => {
      const result = contentfulGqlLikePaginationAdapter({ items: ['d'], total: 100, skip: 40, limit: 20 });
      expect(result.totalPages).toBe(5);
      expect(result.currentPage).toBe(3);
      expect(result.itemsPerPage).toBe(20);
      expect(result.totalHits).toBe(100);
    });

    it('should return at least 1 page even when total is 0', () => {
      const result = contentfulGqlLikePaginationAdapter({ items: [], total: 0, skip: 0, limit: 20 });
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
    });
  });

  describe('fakePaginationAdapter', () => {
    it('should wrap a single item and use provided totalHits', () => {
      const adapter = fakePaginationAdapter(7);
      const result = adapter('item');
      expect(result.items).toEqual(['item']);
      expect(result.totalHits).toBe(7);
      expect(result.totalPages).toBe(7);
      expect(result.currentPage).toBe(1);
    });

    it('should default totalHits to 10', () => {
      const adapter = fakePaginationAdapter();
      const result = adapter('x');
      expect(result.totalHits).toBe(10);
    });
  });
});
