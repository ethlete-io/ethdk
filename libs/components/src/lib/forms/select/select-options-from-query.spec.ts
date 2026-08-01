import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import '../../../test-helpers';
import { SelectOptionsFromQuery } from './select-options-from-query';
import { selectOptionsFromQuery } from './select-options-from-query';

type Item = { id: string; name: string };
type ItemsResponse = { items: Item[]; hasMore: boolean };
type ItemsArgs = { queryParams: { q: string; page: number }; response: ItemsResponse };

const euro: Item = { id: 'euro', name: 'Euro' };
const eurovision: Item = { id: 'eurovision', name: 'Eurovision' };

describe('selectOptionsFromQuery', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  const createSource = (overrides?: { minQueryLength?: number }) => {
    const client = createQueryClient({ baseUrl: 'https://api.example.com', name: `select-${Math.random()}` });
    const searchItems = createGetQuery(client)<ItemsArgs>('/items');

    return TestBed.runInInjectionContext(() =>
      selectOptionsFromQuery({
        queryCreator: searchItems,
        args: (query, page) => (query() ? { queryParams: { q: query(), page: page() } } : null),
        toOptions: (response) => response.items,
        toHasMore: (response) => response.hasMore,
        minQueryLength: overrides?.minQueryLength,
        debounceTime: 0,
      }),
    );
  };

  // Flush the one pending `/items` request with `body` (or an error). Returns the request's `page`
  // query param so the caller can respond page-appropriately.
  const respond = (body: ItemsResponse | { error: true }) => {
    const req = httpMock.expectOne((r) => r.url.includes('/items'));

    if ('error' in body) {
      req.flush({ message: 'Search failed' }, { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(body);
    }
  };

  // A search hop: raw query reaches the debounce observable (tick) -> debounce fires (settle) ->
  // withArgs re-executes (tick) -> flush the request -> response propagates + the keepalive fold
  // runs (tick).
  const search = async (source: SelectOptionsFromQuery<Item>, query: string, body: ItemsResponse | { error: true }) => {
    source.setQuery(query);
    TestBed.tick();
    await settle();
    TestBed.tick();
    respond(body);
    TestBed.tick();
  };

  // A loadMore hop: not debounced - bump the page, withArgs re-executes (tick) -> flush ->
  // response propagates + the keepalive fold runs (tick).
  const loadMore = async (source: SelectOptionsFromQuery<Item>, body: ItemsResponse) => {
    source.loadMore();
    TestBed.tick();
    respond(body);
    TestBed.tick();
  };

  it('maps the response to options once the query succeeds', async () => {
    const source = createSource();

    expect(source.options()).toEqual([]);

    await search(source, 'eu', { items: [euro], hasMore: false });

    expect(source.options()).toEqual([euro]);
    expect(source.loading()).toBe(false);
    expect(source.error()).toBeNull();
    expect(source.query()).toBe('eu');
  });

  it('skips requests below the minimum query length', async () => {
    const source = createSource({ minQueryLength: 3 });

    source.setQuery('ab');
    TestBed.tick();
    await settle();
    TestBed.tick();
    httpMock.expectNone((r) => r.url.includes('/items'));
    expect(source.options()).toEqual([]);

    await search(source, 'abc', { items: [euro], hasMore: false });
    expect(source.options()).toEqual([euro]);
  });

  it('surfaces the error message on failure and recovers on the next search', async () => {
    const source = createSource();

    await search(source, 'boom', { error: true });
    expect(source.error()).toBe('Search failed');
    expect(source.options()).toEqual([]);

    await search(source, 'eu', { items: [euro], hasMore: false });
    expect(source.error()).toBeNull();
    expect(source.options()).toEqual([euro]);
  });

  it('derives hasMore from the response', async () => {
    const source = createSource();

    await search(source, 'more', { items: [euro], hasMore: true });
    expect(source.hasMore()).toBe(true);

    await search(source, 'eu', { items: [euro], hasMore: false });
    expect(source.hasMore()).toBe(false);
  });

  describe('pagination', () => {
    const page1: Item[] = [euro, eurovision];
    const page2: Item[] = [
      { id: 'europa', name: 'Europa' },
      { id: 'europe', name: 'Europe' },
    ];

    it('appends the next page on loadMore and resets on a new query', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });
      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(true);

      await loadMore(source, { items: page2, hasMore: false });
      expect(source.options()).toEqual([...page1, ...page2]);
      expect(source.hasMore()).toBe(false);

      // a fresh query drops the accumulated pages and starts from page 1 again
      await search(source, 'euro', { items: page1, hasMore: true });
      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(true);
    });

    // The end-of-list signal a consumer can derive is often inexact ("a full page means there is more"),
    // and an API asked for a page past the end usually clamps to the last one. Both must dead-end here
    // rather than duplicating the tail and leaving a load-more control behind.
    it('ends pagination when a page repeats the previous one (a clamped out-of-range page)', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });
      expect(source.hasMore()).toBe(true);

      // the API clamps page 2 to the last page and re-serves it
      await loadMore(source, { items: page1, hasMore: true });

      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(false);

      source.loadMore();
      TestBed.tick();
      httpMock.expectNone((r) => r.url.includes('/items'));
    });

    it('ends pagination when a page comes back empty', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });

      await loadMore(source, { items: [], hasMore: true });

      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(false);

      source.loadMore();
      TestBed.tick();
      httpMock.expectNone((r) => r.url.includes('/items'));
    });

    it('ignores loadMore once the last page is loaded', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: false });
      expect(source.options()).toEqual(page1);

      // hasMore is false - this must not fire a (non-existent) page 2 request
      source.loadMore();
      TestBed.tick();
      httpMock.expectNone((r) => r.url.includes('/items'));
      expect(source.options()).toEqual(page1);
    });
  });
});
