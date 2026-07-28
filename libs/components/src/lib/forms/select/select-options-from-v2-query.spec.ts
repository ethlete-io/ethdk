import { TestBed } from '@angular/core/testing';
import { RequestError, V2QueryClient, def } from '@ethlete/query';
import '../../../test-helpers';
import { selectOptionsFromV2Query } from './select-options-from-v2-query';

type Item = { id: string; name: string };
type ItemsResponse = { items: Item[]; hasMore: boolean };
type ItemsArgs = { queryParams: { q: string } };

const euro: Item = { id: 'euro', name: 'Euro' };
const eurovision: Item = { id: 'eurovision', name: 'Eurovision' };

const mockError: RequestError = {
  url: 'https://api.example.com/items',
  status: 500,
  statusText: 'Server Error',
  detail: { message: 'Search failed' },
  httpErrorResponse: null as never,
};

describe('selectOptionsFromV2Query', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

  const createSource = (overrides?: {
    minQueryLength?: number;
    respond?: (query: string) => { response?: ItemsResponse; error?: RequestError; delay?: number } | null;
  }) => {
    const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    const searchItems = client.get({
      route: '/items',
      types: {
        args: def<ItemsArgs>(),
        response: def<ItemsResponse>(),
      },
    });

    const respond =
      overrides?.respond ??
      ((query: string) =>
        query ? { response: { items: query.startsWith('euro') ? [euro, eurovision] : [euro], hasMore: false } } : null);

    const source = TestBed.runInInjectionContext(() =>
      selectOptionsFromV2Query({
        queryCreator: searchItems,
        args: (query) => {
          const mock = respond(query());

          return mock === null ? null : { queryParams: { q: query() }, mock: { delay: 0, ...mock } };
        },
        toOptions: (response) => response.items,
        toHasMore: (response) => response.hasMore,
        minQueryLength: overrides?.minQueryLength,
        debounceTime: 0,
      }),
    );

    return { source, searchItems };
  };

  const search = async (source: { setQuery: (query: string) => void }, query: string) => {
    source.setQuery(query);

    // each hop needs its own flush: the raw query reaches the debounce timer on the first tick,
    // the query effect prepares + executes on the second, and the mock timer resolves last
    TestBed.tick();
    await settle();
    TestBed.tick();
    await settle();
  };

  it('maps the response to options once the query succeeds', async () => {
    const { source } = createSource();

    expect(source.options()).toEqual([]);

    await search(source, 'eu');

    expect(source.options()).toEqual([euro]);
    expect(source.loading()).toBe(false);
    expect(source.error()).toBeNull();
    expect(source.query()).toBe('eu');
  });

  it('keeps the previous options rendered while the next request loads', async () => {
    const { source } = createSource({
      respond: (query) =>
        query
          ? {
              response: { items: query === 'euro' ? [euro, eurovision] : [euro], hasMore: false },
              // generous, because `search()` awaits real macrotasks: a short delay can elapse while the
              // helper flushes (the suite is not on fake timers), and the request settles before the
              // "still loading" assertion below.
              delay: query === 'euro' ? 500 : 0,
            }
          : null,
    });

    await search(source, 'eu');
    expect(source.options()).toEqual([euro]);

    await search(source, 'euro');

    expect(source.loading()).toBe(true);
    expect(source.options()).toEqual([euro]);

    await settle(600);

    expect(source.loading()).toBe(false);
    expect(source.options()).toEqual([euro, eurovision]);
  });

  it('skips requests below the minimum query length', async () => {
    const { source, searchItems } = createSource({ minQueryLength: 3 });
    const prepare = vi.spyOn(searchItems, 'prepare');

    await search(source, 'ab');

    expect(prepare).not.toHaveBeenCalled();
    expect(source.options()).toEqual([]);

    await search(source, 'abc');

    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('skips the request when args returns null', async () => {
    const { source, searchItems } = createSource();
    const prepare = vi.spyOn(searchItems, 'prepare');

    await search(source, '');

    expect(prepare).not.toHaveBeenCalled();
    expect(source.options()).toEqual([]);
  });

  it('surfaces the first error message on failure and recovers on the next search', async () => {
    const { source } = createSource({
      respond: (query) => (query === 'boom' ? { error: mockError } : { response: { items: [euro], hasMore: false } }),
    });

    await search(source, 'boom');

    expect(source.error()).toBe('Search failed');
    expect(source.options()).toEqual([]);

    await search(source, 'eu');

    expect(source.error()).toBeNull();
    expect(source.options()).toEqual([euro]);
  });

  it('derives hasMore from the response', async () => {
    const { source } = createSource({
      respond: (query) => (query ? { response: { items: [euro], hasMore: query === 'more' } } : null),
    });

    await search(source, 'more');
    expect(source.hasMore()).toBe(true);

    await search(source, 'eu');
    expect(source.hasMore()).toBe(false);
  });

  describe('pagination', () => {
    const page1: Item[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const page2: Item[] = [
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
    ];
    const pagesByNumber: Record<number, Item[]> = { 1: page1, 2: page2 };

    const createPagedSource = () => {
      const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
      // `page` is part of the request args so each page is a distinct query (not a cache hit).
      const searchItems = client.get({
        route: '/items',
        types: {
          args: def<{ queryParams: { q: string; page: number } }>(),
          response: def<ItemsResponse>(),
        },
      });

      return TestBed.runInInjectionContext(() =>
        selectOptionsFromV2Query({
          queryCreator: searchItems,
          args: (query, page) => {
            if (!query()) {
              return null;
            }

            const items = pagesByNumber[page()] ?? [];

            return {
              queryParams: { q: query(), page: page() },
              mock: { delay: 0, response: { items, hasMore: page() < 2 } },
            };
          },
          toOptions: (response) => response.items,
          toHasMore: (response) => response.hasMore,
          debounceTime: 0,
        }),
      );
    };

    // loadMore isn't debounced — flush the query effect + mock timer like a search hop does.
    const flush = async () => {
      TestBed.tick();
      await settle();
      TestBed.tick();
      await settle();
    };

    it('appends the next page on loadMore and resets on a new query', async () => {
      const source = createPagedSource();

      await search(source, 'eu');
      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(true);

      source.loadMore();
      await flush();
      expect(source.options()).toEqual([...page1, ...page2]);
      expect(source.hasMore()).toBe(false);

      // a fresh query drops the accumulated pages and starts from page 1 again
      await search(source, 'euro');
      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(true);
    });

    it('ends pagination when a page repeats the previous one or comes back empty', async () => {
      // page 2 clamps back to page 1's items, as an API asked for a page past the end tends to
      const clampedPages: Record<number, Item[]> = { 1: page1, 2: page1 };
      const source = TestBed.runInInjectionContext(() => {
        const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
        const searchItems = client.get({
          route: '/items',
          types: { args: def<ItemsArgs & { queryParams: { page: number } }>(), response: def<ItemsResponse>() },
        });

        return selectOptionsFromV2Query({
          queryCreator: searchItems,
          args: (query, page) =>
            query()
              ? {
                  queryParams: { q: query(), page: page() },
                  // claims there is always more, which is what makes the fold's own verdict matter
                  mock: { delay: 0, response: { items: clampedPages[page()] ?? [], hasMore: true } },
                }
              : null,
          toOptions: (response) => response.items,
          toHasMore: (response) => response.hasMore,
          debounceTime: 0,
        });
      });

      await search(source, 'eu');
      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(true);

      source.loadMore();
      await flush();

      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(false);
    });

    it('ignores loadMore once the last page is loaded', async () => {
      const source = createPagedSource();

      await search(source, 'eu');
      // read options (as a rendered panel would) so page 1 is folded before advancing
      expect(source.options()).toEqual(page1);
      source.loadMore();
      await flush();
      expect(source.options()).toEqual([...page1, ...page2]);
      expect(source.hasMore()).toBe(false);

      // hasMore is false — this must not request a (non-existent) page 3
      source.loadMore();
      await flush();
      expect(source.options()).toEqual([...page1, ...page2]);
    });
  });
});
