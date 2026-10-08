import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createGetQuery, createQueryClient } from '@ethlete/query';
import '../../../test-helpers';
import { silenceExpectedConsole } from '../../testing/expected-console';
import { tableRowsFromQuery } from './table-rows-from-query';
import { filterValues } from './table-filter';
import { TableRowsFromQuery, TableRowsStateConfig } from './table-rows-source';
import { TableColumns, TableSort } from '../table.types';

type User = { id: string; name: string };
type UsersResponse = { items: User[]; totalHits: number; hasMore: boolean };
type UsersArgs = {
  queryParams: { sortBy?: string; sortOrder?: string; search?: string; page: number; limit?: number };
  response: UsersResponse;
};

const page1: User[] = [{ id: '1', name: 'Ada' }];
const page2: User[] = [{ id: '2', name: 'Alan' }];

describe('tableRowsFromQuery', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const createSource = (queryConfig: { keepPreviousResponse?: boolean } = {}, state: TableRowsStateConfig = {}) => {
    const client = createQueryClient({ baseUrl: 'https://api.example.com', name: `table-${Math.random()}` });
    const getUsers = createGetQuery(client)<UsersArgs>('/users');
    const queryCreator = ((...features: Parameters<typeof getUsers>) =>
      getUsers(queryConfig, ...(features as never[]))) as typeof getUsers;

    return TestBed.runInInjectionContext(() =>
      tableRowsFromQuery({
        queryCreator,
        ...state,
        args: ({ sort, page, pageSize, quickFilter }) => ({
          queryParams: {
            sortBy: sort()[0]?.key,
            sortOrder: sort()[0]?.direction,
            search: quickFilter() || undefined,
            page: page(),
            limit: pageSize(),
          },
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
    const captured = {
      sortBy: params.get('sortBy'),
      sortOrder: params.get('sortOrder'),
      search: params.get('search'),
      page: params.get('page'),
      limit: params.get('limit'),
    };

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

  it('reports no more pages once a page comes back empty, whatever the response claims', () => {
    const source = createSource();

    respond({ items: [], totalHits: 0, hasMore: true });

    expect(source.rows()).toEqual([]);
    expect(source.hasMore()).toBe(false);
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

  it('re-executes with the quick filter and resets the page when setQuickFilter is called', () => {
    const source = createSource();
    respond({ items: page1, totalHits: 42, hasMore: true });

    source.setPage(3);
    respond({ items: page2, totalHits: 42, hasMore: true });

    source.setQuickFilter('ada');
    const captured = respond({ items: page1, totalHits: 1, hasMore: false });

    expect(captured.search).toBe('ada');
    expect(captured.page).toBe('1');
    expect(source.quickFilter()).toBe('ada');
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

  it('keeps hasMore while the next page loads for a query that drops its previous response', () => {
    const source = createSource({ keepPreviousResponse: false });
    respond({ items: page1, totalHits: 42, hasMore: true });

    source.setPage(2);
    TestBed.tick();

    expect(source.loading()).toBe(true);
    expect(source.hasMore()).toBe(true);

    respond({ items: page2, totalHits: 42, hasMore: false });
    expect(source.hasMore()).toBe(false);
  });

  it('surfaces a query error as text', () => {
    silenceExpectedConsole('error');

    const source: TableRowsFromQuery<User> = createSource();
    respond({ error: true });

    expect(source.error()).toBe('Boom');
  });

  it('settles a failed next page into the error, not a stuck loading state, and recovers on the next page', () => {
    silenceExpectedConsole('error');

    const source = createSource();
    respond({ items: page1, totalHits: 42, hasMore: true });

    source.setPage(2);
    respond({ error: true });

    expect(source.loading()).toBe(false);
    expect(source.error()).toBe('Boom');
    expect(source.page()).toBe(2);
    expect(source.total()).toBe(42);

    source.setPage(3);
    respond({ items: page2, totalHits: 42, hasMore: false });

    expect(source.error()).toBeNull();
    expect(source.rows()).toEqual(page2);
    expect(source.hasMore()).toBe(false);
  });

  it('reports no rows for a first page that fails', () => {
    silenceExpectedConsole('error');

    const source = createSource();
    respond({ error: true });

    expect(source.rows()).toEqual([]);
    expect(source.total()).toBeNull();
    expect(source.hasMore()).toBe(false);
    expect(source.loading()).toBe(false);
  });

  it('re-executes with the new page size and resets the page when setPageSize is called', () => {
    const source = createSource({}, { initialPageSize: 10 });
    expect(respond({ items: page1, totalHits: 420, hasMore: true }).limit).toBe('10');

    source.setPage(9);
    respond({ items: page2, totalHits: 420, hasMore: true });

    source.setPageSize(100);
    const captured = respond({ items: page1, totalHits: 420, hasMore: true });

    expect(captured.limit).toBe('100');
    expect(captured.page).toBe('1');
    expect(source.pageSize()).toBe(100);
    expect(source.page()).toBe(1);
  });

  it('reads and writes external state signals driven from outside', () => {
    const sort = signal<TableSort[]>([{ key: 'name', direction: 'asc' }]);
    const page = signal(4);
    const pageSize = signal(50);
    const quickFilter = signal('ada');
    const source = createSource({}, { sort, page, pageSize, quickFilter, initialSort: [] });

    expect(respond({ items: page1, totalHits: 420, hasMore: true })).toEqual({
      sortBy: 'name',
      sortOrder: 'asc',
      search: 'ada',
      page: '4',
      limit: '50',
    });

    sort.set([{ key: 'name', direction: 'desc' }]);
    page.set(7);
    const captured = respond({ items: page2, totalHits: 420, hasMore: true });

    expect(captured.sortOrder).toBe('desc');
    expect(captured.page).toBe('7');
    expect(source.sort()).toEqual([{ key: 'name', direction: 'desc' }]);

    source.setQuickFilter('alan');
    respond({ items: page2, totalHits: 1, hasMore: false });

    expect(quickFilter()).toBe('alan');
    expect(page()).toBe(1);
  });

  it('types the state keys from the columns, sortKey and filterKey included', () => {
    const columns = {
      name: { value: (user: User) => user.name, sortable: true },
      joined: { value: (user: User) => user.id, sortable: true, sortKey: 'joined_at' as const },
    } satisfies TableColumns<User>;

    const source = TestBed.runInInjectionContext(() =>
      tableRowsFromQuery({
        queryCreator: createGetQuery(
          createQueryClient({ baseUrl: 'https://api.example.com', name: 'typed' }),
        )<UsersArgs>('/users'),
        columns,
        args: ({ sort, filters }) => {
          const key: 'name' | 'joined' | 'joined_at' | undefined = sort()[0]?.key;
          const statuses: ('active' | 'banned')[] = filterValues<'active' | 'banned'>(filters(), 'name');

          // @ts-expect-error - not a column or source key
          filterValues(filters(), 'email');

          return { queryParams: { sortBy: key, search: statuses.join(','), page: 1 } };
        },
        toRows: (response) => response.items,
      }),
    );

    // @ts-expect-error - not a column or source key
    source.setSort([{ key: 'email', direction: 'asc' }]);
    source.setSort([{ key: 'joined_at', direction: 'asc' }]);

    expect(respond({ items: page1, totalHits: 1, hasMore: false }).sortBy).toBe('joined_at');
  });
});
