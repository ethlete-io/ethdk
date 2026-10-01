import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import '../../../test-helpers';
import { silenceExpectedConsole } from '../../testing/expected-console';
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
    silenceExpectedConsole('error');

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

      await search(source, 'euro', { items: page1, hasMore: true });
      expect(source.options()).toEqual(page1);
      expect(source.hasMore()).toBe(true);
    });

    it('ends pagination when a page repeats the previous one (a clamped out-of-range page)', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });
      expect(source.hasMore()).toBe(true);

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

      source.loadMore();
      TestBed.tick();
      httpMock.expectNone((r) => r.url.includes('/items'));
      expect(source.options()).toEqual(page1);
    });

    const param = (request: HttpRequest<unknown>, name: string) =>
      new URL(request.urlWithParams).searchParams.get(name);
    const pageParam = (request: HttpRequest<unknown>) => param(request, 'page');

    it('requests the next page on loadMore and appends it', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });

      source.loadMore();
      TestBed.tick();
      httpMock.expectOne((r) => pageParam(r) === '2').flush({ items: page2, hasMore: true });
      TestBed.tick();

      expect(source.options()).toEqual([...page1, ...page2]);
      expect(source.hasMore()).toBe(true);
    });

    it('restarts at the first page when the query changes', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });
      await loadMore(source, { items: page2, hasMore: true });

      source.setQuery('euro');
      TestBed.tick();
      await settle();
      TestBed.tick();
      const request = httpMock.expectOne((r) => r.url.includes('/items'));
      expect(param(request.request, 'q')).toBe('euro');
      expect(pageParam(request.request)).toBe('1');
      request.flush({ items: [euro], hasMore: false });
      TestBed.tick();

      expect(source.options()).toEqual([euro]);
      expect(source.hasMore()).toBe(false);
    });

    it('keeps hasMore while the next page loads and turns it off on the last page', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });

      source.loadMore();
      TestBed.tick();
      expect(source.loading()).toBe(true);
      expect(source.hasMore()).toBe(true);

      respond({ items: page2, hasMore: false });
      TestBed.tick();

      expect(source.loading()).toBe(false);
      expect(source.hasMore()).toBe(false);

      source.loadMore();
      TestBed.tick();
      httpMock.expectNone((r) => r.url.includes('/items'));
    });

    it('ignores a second loadMore while a page loads', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });

      source.loadMore();
      source.loadMore();
      TestBed.tick();

      respond({ items: page2, hasMore: true });
      TestBed.tick();
      expect(source.options()).toEqual([...page1, ...page2]);
    });

    it('sends no request and ignores loadMore below the minimum query length', async () => {
      const source = createSource({ minQueryLength: 3 });

      await search(source, 'eur', { items: page1, hasMore: true });

      source.setQuery('eu');
      TestBed.tick();
      await settle();
      TestBed.tick();
      source.loadMore();
      TestBed.tick();

      httpMock.expectNone((r) => r.url.includes('/items'));
      expect(source.options()).toEqual([]);
      expect(source.hasMore()).toBe(false);
    });

    it('discards a page still in flight when the query changes', async () => {
      const source = createSource();

      await search(source, 'eu', { items: page1, hasMore: true });

      source.loadMore();
      TestBed.tick();
      const stalePage = httpMock.expectOne((r) => pageParam(r) === '2');

      source.setQuery('euro');
      TestBed.tick();
      await settle();
      TestBed.tick();

      if (!stalePage.cancelled) {
        stalePage.flush({ items: page2, hasMore: true });
        TestBed.tick();
      }

      expect(source.options()).not.toContainEqual(page2[0]);

      httpMock
        .expectOne((r) => param(r, 'q') === 'euro' && pageParam(r) === '1')
        .flush({ items: [euro], hasMore: false });
      TestBed.tick();

      expect(source.options()).toEqual([euro]);
      expect(source.hasMore()).toBe(false);
    });
  });
});
