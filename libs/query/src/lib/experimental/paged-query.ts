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
  responseNormalizer: (response: ResponseType<TArgs>) => NormalizedPagination<ResponseType<TArgs>>;
  queryCreator: QueryCreator<TArgs>;
  args: (page: number) => RequestArgs<TArgs>;
  initialPage?: number;
};

export type PagedQueryResetOptions = {
  initialPage?: number;
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

  const canFetchPreviousPage = computed(() => loadedMinPage() > 1);
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

  const execute = (options?: { where?: (items: ResponseType<TArgs>) => boolean; skipCache?: boolean }) => {
    if (options?.where) {
      const queriesToExecute: Query<TArgs>[] = [];

      for (const [index, query] of stack.queries().entries()) {
        // TODO: Use the where condition here.
        if (query.response()) {
          queriesToExecute.push(query);

          if (index !== 0) {
            const prevQuery = stack.queries()[index - 1];

            if (prevQuery) {
              queriesToExecute.push(prevQuery);
            }
          }

          if (index !== stack.queries().length - 1) {
            const nextQuery = stack.queries()[index + 1];

            if (nextQuery) {
              queriesToExecute.push(nextQuery);
            }
          }
        }
      }

      for (const query of queriesToExecute) {
        query.execute({ options: { skipCache: options.skipCache } });
      }
    } else {
      stack.execute({ skipCache: options?.skipCache });
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
