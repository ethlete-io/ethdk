import { TestBed } from '@angular/core/testing';
import { def, RequestError, V2QueryClient } from '@ethlete/query';
import '../../../test-helpers';
import { tableRowsFromV2Query } from './table-rows-from-v2-query';
import { TableRowsQueryState } from './table-rows-source';

type User = { id: string; name: string };
type UsersResponse = { items: User[]; totalHits: number; hasMore: boolean };
type UsersArgs = { queryParams: { sortBy?: string; sortOrder?: string; page: number } };

const page1: User[] = [{ id: '1', name: 'Ada' }];
const page2: User[] = [{ id: '2', name: 'Alan' }];

const mockError: RequestError = {
  url: 'https://api.example.com/users',
  status: 500,
  statusText: 'Server Error',
  detail: { message: 'Boom' },
  httpErrorResponse: null as never,
};

describe('tableRowsFromV2Query', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  const captured: { sortBy?: string; page: number }[] = [];

  const createSource = (
    // Only the two signals the fixtures actually branch on - a full TableRowsQueryState would make
    // every call site pass a `filters` signal it doesn't read.
    respond: (state: Pick<TableRowsQueryState, 'sort' | 'page'>) => { response?: UsersResponse; error?: RequestError },
  ) => {
    captured.length = 0;
    const client = new V2QueryClient({ baseRoute: 'https://api.example.com' });
    const getUsers = client.get({ route: '/users', types: { args: def<UsersArgs>(), response: def<UsersResponse>() } });

    return TestBed.runInInjectionContext(() =>
      tableRowsFromV2Query({
        queryCreator: getUsers,
        args: ({ sort, page }) => {
          captured.push({ sortBy: sort()[0]?.key, page: page() });

          return {
            queryParams: { sortBy: sort()[0]?.key, sortOrder: sort()[0]?.direction, page: page() },
            mock: { delay: 0, ...respond({ sort, page }) },
          };
        },
        toRows: (response) => response.items,
        toTotal: (response) => response.totalHits,
        toHasMore: (response) => response.hasMore,
      }),
    );
  };

  // One request hop: prepare/execute on tick, mock resolves on settle, propagate on tick.
  const flush = async () => {
    TestBed.tick();
    await settle();
    TestBed.tick();
  };

  it('maps the response to rows and total', async () => {
    const source = createSource(() => ({ response: { items: page1, totalHits: 42, hasMore: true } }));
    await flush();

    expect(source.rows()).toEqual(page1);
    expect(source.total()).toBe(42);
    expect(source.hasMore()).toBe(true);
    expect(source.error()).toBeNull();
  });

  it('re-executes with the new sort and resets the page on setSort', async () => {
    const source = createSource(({ page }) => ({
      response: { items: page() === 1 ? page1 : page2, totalHits: 42, hasMore: true },
    }));
    await flush();

    source.setPage(3);
    await flush();
    expect(source.page()).toBe(3);

    source.setSort([{ key: 'name', direction: 'desc' }]);
    await flush();

    expect(source.page()).toBe(1);
    expect(captured.at(-1)).toEqual({ sortBy: 'name', page: 1 });
  });

  it('surfaces a query error as text', async () => {
    const source = createSource(() => ({ error: mockError }));
    await flush();

    expect(source.error()).toBe('Boom');
  });
});
