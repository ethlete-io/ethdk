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
              delay: query === 'euro' ? 40 : 0,
            }
          : null,
    });

    await search(source, 'eu');
    expect(source.options()).toEqual([euro]);

    await search(source, 'euro');

    expect(source.loading()).toBe(true);
    expect(source.options()).toEqual([euro]);

    await settle(60);

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
});
