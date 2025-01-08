import { computed, effect, isDevMode, signal, untracked } from '@angular/core';
import {
  ContentfulGqlLikePaginated,
  DynLikePaginated,
  GgLikePaginated,
  NormalizedPagination,
  Paginated,
} from '@ethlete/types';
import { Query, QueryArgs, RequestArgs, ResponseType } from './query';
import { QueryCreator } from './query-creator';
import {
  pagedQueryNextPageCalledWithoutPreviousPage,
  pagedQueryPageBiggerThanTotalPages,
  pagedQueryPreviousPageCalledButAlreadyAtFirstPage,
} from './query-errors';
import { withArgs } from './query-features';
import { createQueryStack, transformArrayResponse } from './query-stack';
import { shouldRetryRequest } from './query-utils';

export const ethletePaginationAdapter = <T>(response: Paginated<T>) => {
  const pagination: NormalizedPagination<T> = {
    items: response.items,
    totalPages: response.totalPageCount,
    currentPage: response.currentPage,
    itemsPerPage: response.itemsPerPage,
    totalHits: response.totalHits,
  };

  return pagination;
};

export const ggLikePaginationAdapter = <T>(response: GgLikePaginated<T>) => {
  const pagination: NormalizedPagination<T> = {
    items: response.items,
    totalPages: response.totalPageCount,
    currentPage: response.currentPage,
    itemsPerPage: response.itemsPerPage,
    totalHits: response.totalHits,
  };

  return pagination;
};

export const dynLikePaginationAdapter = <T>(response: DynLikePaginated<T>) => {
  const pagination: NormalizedPagination<T> = {
    items: response.items,
    totalPages: response.totalPages,
    currentPage: response.currentPage,
    itemsPerPage: response.limit,
    totalHits: response.totalHits,
  };

  return pagination;
};

export const contentfulGqlLikePaginationAdapter = <T>(response: ContentfulGqlLikePaginated<T>) => {
  const totalPages = Math.max(Math.ceil(response.total / response.limit), 1); // If there are no items, there is still one page
  const currentPage = Math.max(Math.ceil(response.skip / response.limit) + 1, 1);

  const pagination: NormalizedPagination<T> = {
    items: response.items,
    totalPages,
    currentPage,
    itemsPerPage: response.limit,
    totalHits: response.total,
  };

  return pagination;
};

export type CreatePagedQueryOptions<TArgs extends QueryArgs> = {
  /**
   * The normalizer function that will be used to normalize the response to a format that the paged query can understand.
   *
   * There are some built-in normalizers that can be used:
   * - `ethletePaginationAdapter`
   * - `ggLikePaginationAdapter`
   * - `dynLikePaginationAdapter`
   * - `contentfulGqlLikePaginationAdapter`
   */
  responseNormalizer: (response: ResponseType<TArgs>) => NormalizedPagination<ResponseType<TArgs>>;

  /**
   * The query creator function that will be used to create the paged query.
   */
  queryCreator: QueryCreator<TArgs>;

  /**
   * The arguments to create the query.
   * The current page will be passed as an argument.
   * This function can be treated like a computed function. It reacts to signal changes.
   * If a signal changes, the paged query will be reset to the initial page.
   *
   * @example (page) => ({ queryParams: { page, limit:20 } }),
   */
  args: (page: number) => RequestArgs<TArgs>;

  /**
   * The page to start this paged query from.
   * @default 1
   */
  initialPage?: number;
};

export type PagedQueryResetOptions = {
  /**
   * The page to reset this paged query to.
   * This will clear everything and start from this page.
   * @default 1 // or the value passed in the `initialPage` option when creating the paged query.
   */
  initialPage?: number;
};

export type PagedQueryExecuteOptions<TArgs extends QueryArgs> = {
  /**
   * If provided, only the queries that match the condition will be executed.
   * This will also execute the previous and next query to the one that matched the condition.
   * If not provided, all queries will be executed.
   *
   * @example
   * myPagedQuery.execute({ where: (item) => item.id === 4 });
   */
  where?: (item: ResponseType<TArgs>, index: number, array: ResponseType<TArgs>[]) => boolean;

  /**
   * If true, the cache will be used (if not expired) and the request will not be made.
   * @default false
   */
  allowCache?: boolean;
};

export const createPagedQuery = <TArgs extends QueryArgs>(options: CreatePagedQueryOptions<TArgs>) => {
  const { responseNormalizer, queryCreator } = options;

  const currentPageArgs = signal<RequestArgs<TArgs> | null>(null);
  const initialPage = signal(options.initialPage ?? 1);
  const loadedMinPage = signal(initialPage());
  const loadedMaxPage = signal(initialPage());
  const lastResetTimestamp = signal(Date.now());

  const pageDirection = signal<'next' | 'previous'>('next');

  const stack = createQueryStack(
    () => {
      const args = currentPageArgs();

      if (!args) return null;

      return queryCreator(
        withArgs(() => {
          return args;
        }),
      );
    },
    {
      append: true,
      appendFn: (oldQueries, newQueries) => {
        const newQuery = newQueries[0];
        const dir = pageDirection();

        if (!newQuery) {
          const lastQuery = oldQueries[oldQueries.length - 1] ?? null;
          return { queries: oldQueries, lastQuery };
        } else if (dir === 'previous') {
          return { queries: [newQuery, ...oldQueries], lastQuery: newQuery };
        } else {
          return { queries: [...oldQueries, newQuery], lastQuery: newQuery };
        }
      },
      transform: transformArrayResponse,
    },
  );

  effect(() => {
    lastResetTimestamp();

    const args = options.args(initialPage());

    untracked(() => {
      stack.clear();
      currentPageArgs.set(args);
      loadedMinPage.set(initialPage());
      loadedMaxPage.set(initialPage());
    });
  });

  const pagination = computed(() => {
    const res = stack.lastQuery()?.response();

    if (!res) return null;

    return responseNormalizer(res);
  });

  const fetchPreviousPage = () => {
    const page = loadedMinPage() - 1;

    if (page < 1) {
      if (isDevMode()) {
        throw pagedQueryPreviousPageCalledButAlreadyAtFirstPage();
      }

      return;
    }

    currentPageArgs.set(options.args(page));
    loadedMinPage.set(page);
    pageDirection.set('previous');
  };

  const fetchNextPage = () => {
    const page = loadedMaxPage() + 1;
    const currentPagination = pagination();

    if (!currentPagination) {
      if (isDevMode()) {
        throw pagedQueryNextPageCalledWithoutPreviousPage();
      }

      return;
    }

    if (page > currentPagination.totalPages) {
      if (isDevMode()) {
        throw pagedQueryPageBiggerThanTotalPages(page, currentPagination.totalPages);
      }

      return;
    }

    currentPageArgs.set(options.args(page));
    loadedMaxPage.set(page);
    pageDirection.set('next');
  };

  const reset = (resetOptions?: PagedQueryResetOptions) => {
    const page = resetOptions?.initialPage ?? initialPage();

    initialPage.set(page);
    pageDirection.set('next');
    lastResetTimestamp.set(Date.now());
  };

  const canFetchPreviousPage = computed(() => {
    const currentPagination = pagination();

    if (!currentPagination) return false;

    return loadedMinPage() > 1;
  });
  const canFetchNextPage = computed(() => {
    const currentPagination = pagination();

    return currentPagination ? loadedMaxPage() < currentPagination.totalPages : false;
  });

  const items = computed(() => {
    return stack
      .response()
      .map((r) => responseNormalizer(r).items)
      .flat();
  });

  const isFirstLoad = computed(() => {
    return stack.queries().length === 1 && !!stack.lastQuery()?.loading();
  });

  const execute = (options?: PagedQueryExecuteOptions<TArgs>) => {
    const whereFn = options?.where;

    if (whereFn) {
      const queriesToExecute = new Set<Query<TArgs>>();

      for (const [index, query] of stack.queries().entries()) {
        const res = query.response();
        const err = query.error();
        const isErroredAndCanBeRetried = err && shouldRetryRequest(err);

        if (isErroredAndCanBeRetried) {
          queriesToExecute.add(query);
        } else if (res) {
          if (responseNormalizer(res).items.some((item, i, a) => whereFn(item, i, a))) {
            queriesToExecute.add(query);

            // Also execute the previous and next query to the one that matched the condition.

            if (index !== 0) {
              const prevQuery = stack.queries()[index - 1];

              if (prevQuery) {
                queriesToExecute.add(prevQuery);
              }
            }

            if (index !== stack.queries().length - 1) {
              const nextQuery = stack.queries()[index + 1];

              if (nextQuery) {
                queriesToExecute.add(nextQuery);
              }
            }
          }
        }
      }

      for (const query of queriesToExecute) {
        query.execute({ options: { allowCache: options.allowCache } });
      }
    } else {
      stack.execute({ allowCache: options?.allowCache });
    }
  };

  const pagedQuery = {
    pagination,
    fetchPreviousPage,
    fetchNextPage,
    canFetchPreviousPage,
    canFetchNextPage,
    items,
    direction: pageDirection.asReadonly(),
    loading: stack.loading,
    error: stack.error,
    lastQuery: stack.lastQuery,
    isFirstLoad,
    queries: stack.queries(),
    reset,
    execute,
  };

  return pagedQuery;
};
