import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import '../../../test-helpers';
import { tableRowsFromQuery } from './table-rows-from-query';
import { TableRowsFromQuery } from './table-rows-source';

type User = { id: string; name: string };
type UsersResponse = { items: User[]; totalHits: number; hasMore: boolean };
type UsersArgs = { queryParams: { sortBy?: string; sortOrder?: string; page: number }; response: UsersResponse };

const page1: User[] = [{ id: '1', name: 'Ada' }];
const page2: User[] = [{ id: '2', name: 'Alan' }];

describe('tableRowsFromQuery', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const createSource = () => {
    const client = createQueryClient({ baseUrl: 'https://api.example.com', name: `table-${Math.random()}` });
    const getUsers = createGetQuery(client)<UsersArgs>('/users');

    return TestBed.runInInjectionContext(() =>
      tableRowsFromQuery({
        queryCreator: getUsers,
        args: ({ sort, page }) => ({
          queryParams: { sortBy: sort()[0]?.key, sortOrder: sort()[0]?.direction, page: page() },
        }),
        toRows: (response) => response.items,
        toTotal: (response) => response.totalHits,
        toHasMore: (response) => response.hasMore,
      }),
    );
  };

  // Flush the one pending /users request; returns its query params. Body optional → error.
  const respond = (body: UsersResponse | { error: true }) => {
    TestBed.tick();
    const req = httpMock.expectOne((r) => r.url.includes('/users'));
    const params = new URL(req.request.urlWithParams, 'https://api.example.com').searchParams;
    const captured = { sortBy: params.get('sortBy'), sortOrder: params.get('sortOrder'), page: params.get('page') };

    if ('error' in body) {
      req.flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });
    } else {
      req.flush(body);
    }

    TestBed.tick();

    return captured;
  };

  it('maps the response to rows and total on first load', () => {
    const source = createSource();

    respond({ items: page1, totalHits: 42, hasMore: true });

    expect(source.rows()).toEqual(page1);
    expect(source.total()).toBe(42);
    expect(source.hasMore()).toBe(true);
    expect(source.error()).toBeNull();
  });

  it('re-executes with the new sort and resets the page when setSort is called', () => {
    const source = createSource();
    respond({ items: page1, totalHits: 42, hasMore: true });

    source.setPage(3);
    respond({ items: page2, totalHits: 42, hasMore: true });
    expect(source.page()).toBe(3);

    source.setSort([{ key: 'name', direction: 'desc' }]);
    const captured = respond({ items: page2, totalHits: 42, hasMore: false });

    expect(captured.sortBy).toBe('name');
    expect(captured.sortOrder).toBe('desc');
    expect(captured.page).toBe('1'); // reset to initialPage
    expect(source.page()).toBe(1);
  });

  it('keeps the previous rows visible while the next page loads', () => {
    const source = createSource();
    respond({ items: page1, totalHits: 42, hasMore: true });

    source.setPage(2);
    TestBed.tick();

    // request in flight, not yet flushed → previous rows remain
    expect(source.rows()).toEqual(page1);
    expect(source.loading()).toBe(true);

    respond({ items: page2, totalHits: 42, hasMore: false });
    expect(source.rows()).toEqual(page2);
    expect(source.loading()).toBe(false);
  });

  it('surfaces a query error as text', () => {
    const source: TableRowsFromQuery<User> = createSource();
    respond({ error: true });

    expect(source.error()).toBe('Boom');
  });
});
