/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpErrorResponse } from '@angular/common/http';
import { computed, effect, isDevMode, Signal, signal, untracked } from '@angular/core';
import {
  ContentfulGqlLikePaginated,
  DynLikePaginated,
  GgLikePaginated,
  NormalizedPagination,
  Paginated,
} from '@ethlete/types';
import { AnyQuery, Query, QueryArgs, RequestArgs, ResponseType } from './query';
import { AnyQueryCreator, QueryArgsOf, QueryCreator } from './query-creator';
import {
  pagedQueryStackNextPageCalledWithoutPreviousPage,
  pagedQueryStackPageBiggerThanTotalPages,
  pagedQueryStackPreviousPageCalledButAlreadyAtFirstPage,
} from './query-errors';
import { QueryFeature } from './query-features';
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

export const fakePaginationAdapter = (totalHits = 10) => {
  return <T>(response: T) => {
    const pagination: NormalizedPagination<T> = {
      items: [response],
      totalPages: totalHits,
      currentPage: 1,
      itemsPerPage: 1,
      totalHits,
    };

    return pagination;
  };
};

export type CreatePagedQueryStackOptions<
  TArgs extends QueryArgs,
  TNormPagination extends NormalizedPagination<unknown>,
> = {
  /**
   * The normalizer function that will be used to normalize the response to a format that the paged query can understand.
   *
   * There are some built-in normalizers that can be used:
   * - `ethletePaginationAdapter`
   * - `ggLikePaginationAdapter`
   * - `dynLikePaginationAdapter`
   * - `contentfulGqlLikePaginationAdapter`
   * - `fakePaginationAdapter` (for testing purposes)
   *
   * @param currentResponse The current response that was fetched.
   * @param allResponses All responses that were fetched till now including the current response and pagination.
   */
  responseNormalizer: (
    currentResponse: ResponseType<TArgs>,
    allResponses: NonNullable<ResponseType<TArgs>>[],
  ) => TNormPagination;

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
   *
   * @param page The page to fetch next. **Do not modify this argument.**
   * @param allResponses All responses that were fetched till now including pagination.
   */
  args: (page: number, allResponses: NonNullable<ResponseType<TArgs>>[]) => RequestArgs<TArgs> | null;

  /**
   * The features that should be used for all queries in the stack.
   *
   * @throws If the `withArgs` feature is used. This feature is internally used.
   *
   * @example
   * // Due to limitations in TypeScript, you have to manually add the needed generic types if needed.
   * features: [E.withSuccessHandling<GetPostQueryArgs>({ handler: (post) => console.log(post.title) })]
   *
   * @example
   * // If typings are not needed, you can use the feature without generics.
   * features: [E.withPolling({ interval: 5000 })]
   */
  features?: QueryFeature<any>[];

  /**
   * The page to start this paged query from.
   * @default 1
   */
  initialPage?: number;
};

export type PagedQueryStackResetOptions = {
  /**
   * The page to reset this paged query to.
   * This will clear everything and start from this page.
   * @default 1 // or the value passed in the `initialPage` option when creating the paged query.
   */
  initialPage?: number;
};

export type PagedQueryStackExecuteOptions<TNormPagination extends NormalizedPagination<unknown>> = {
  /**
   * If provided, only the queries that match the condition will be executed.
   * This will also execute the previous and next query to the one that matched the condition.
   * If not provided, all queries will be executed.
   *
   * @example
   * myPagedQuery.execute({ where: (item) => item.id === 4 });
   */
  where?: (item: TNormPagination['items'][number], index: number, array: TNormPagination['items']) => boolean;

  /**
   * If true, the cache will be used (if not expired) and the request will not be made.
   * @default false
   */
  allowCache?: boolean;
};

export type PagedQueryStackDirection = 'next' | 'previous';

export type AnyPagedQueryStack = PagedQueryStack<AnyQuery, NormalizedPagination<unknown>>;

export type PagedQueryStack<TQuery extends AnyQuery, TNormPagination extends NormalizedPagination<unknown>> = {
  /**
   * The current pagination state of the paged query.
   */
  pagination: Signal<TNormPagination | null>;

  /**
   * Fetches the previous page of the paged query.
   *
   * @throws If the paged query is already at the first page.
   */
  fetchPreviousPage: () => void;

  /**
   * Fetches the next page of the paged query.
   *
   * @throws If the paged query is already at the last page.
   */
  fetchNextPage: () => void;

  /**
   * Whether the previous page can be fetched or not.
   *
   * This will be false if the paged query is already at the first page or if the paged query is loading.
   */
  canFetchPreviousPage: Signal<boolean>;

  /**
   * Whether the next page can be fetched or not.
   *
   * This will be false if the paged query is already at the last page or if the paged query is loading.
   */
  canFetchNextPage: Signal<boolean>;

  /**
   * The items of the paged query.
   */
  items: Signal<TNormPagination['items']>;

  /**
   * Whether the paged query is loading or not.
   */
  loading: Signal<boolean>;

  /**
   * The error that occurred during the last execution of the paged query.
   */
  error: Signal<HttpErrorResponse | null>;

  /**
   * The last query executed in the paged query.
   */
  lastQuery: Signal<Query<QueryArgsOf<TQuery>> | null>;

  /**
   * Whether the paged query is on its first load or not.
   */
  isFirstLoad: Signal<boolean>;

  /**
   * The queries in the paged query stack.
   */
  queries: Signal<TQuery[]>;

  /**
   * Resets the paged query to the initial page.
   */
  reset: (resetOptions?: PagedQueryStackResetOptions) => void;

  /**
   * Executes the paged query.
   */
  execute: (options?: PagedQueryStackExecuteOptions<TNormPagination>) => void;

  /**
   * The current direction of the paged query.
   */
  direction: Signal<PagedQueryStackDirection>;
};

export const createPagedQueryStack = <
  TCreator extends AnyQueryCreator,
  TArgs extends QueryArgsOf<TCreator>,
  TNormPagination extends NormalizedPagination<unknown>,
>(
  options: CreatePagedQueryStackOptions<TArgs, TNormPagination>,
) => {
  const { responseNormalizer, queryCreator, features } = options;

  const currentPageArgs = signal<RequestArgs<TArgs> | null>(null);
  const initialPage = signal(options.initialPage ?? 1);
  const loadedMinPage = signal(initialPage());
  const loadedMaxPage = signal(initialPage());
  const lastResetTimestamp = signal(Date.now());

  const pageDirection = signal<PagedQueryStackDirection>('next');

  const stack = createQueryStack({
    args: () => currentPageArgs(),
    queryCreator,
    append: true,
    features,
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
  });

  effect(() => {
    lastResetTimestamp();

    const args = options.args(initialPage(), []);

    untracked(() => {
      stack.clear();
      currentPageArgs.set(args);
      loadedMinPage.set(initialPage());
      loadedMaxPage.set(initialPage());
    });
  });

  const pagination = computed(() => {
    const res = stack.lastQuery()?.response();
    const all = stack.response();

    if (!res) return null;

    return responseNormalizer(res, all);
  });

  const fetchPreviousPage = () => {
    const page = loadedMinPage() - 1;
    const allResponses = stack.response();

    if (page < 1) {
      if (isDevMode()) {
        throw pagedQueryStackPreviousPageCalledButAlreadyAtFirstPage();
      }

      return;
    }

    currentPageArgs.set(options.args(page, allResponses));
    loadedMinPage.set(page);
    pageDirection.set('previous');
  };

  const fetchNextPage = () => {
    const page = loadedMaxPage() + 1;
    const currentPagination = pagination();
    const allResponses = stack.response();

    if (!currentPagination) {
      if (isDevMode()) {
        throw pagedQueryStackNextPageCalledWithoutPreviousPage();
      }

      return;
    }

    if (page > currentPagination.totalPages) {
      if (isDevMode()) {
        throw pagedQueryStackPageBiggerThanTotalPages(page, currentPagination.totalPages);
      }

      return;
    }

    currentPageArgs.set(options.args(page, allResponses));
    loadedMaxPage.set(page);
    pageDirection.set('next');
  };

  const reset = (resetOptions?: PagedQueryStackResetOptions) => {
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
    const res = stack.response();
    return res.map((r) => responseNormalizer(r, res).items).flat();
  });

  const isFirstLoad = computed(() => {
    return stack.queries().length === 1 && !!stack.lastQuery()?.loading();
  });

  const execute = (options?: PagedQueryStackExecuteOptions<TArgs>) => {
    const whereFn = options?.where;

    if (whereFn) {
      const queriesToExecute = new Set<Query<TArgs>>();
      const all = stack.response();

      for (const [index, query] of stack.queries().entries()) {
        const res = query.response();
        const err = query.error();
        const isErroredAndCanBeRetried = err && shouldRetryRequest(err);

        if (isErroredAndCanBeRetried) {
          queriesToExecute.add(query);
        } else if (res) {
          if (responseNormalizer(res, all).items.some((item, i, a) => whereFn(item, i, a))) {
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

  const pagedQuery: PagedQueryStack<Query<TArgs>, TNormPagination> = {
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
    queries: stack.queries,
    reset,
    execute,
  };

  return pagedQuery;
};
