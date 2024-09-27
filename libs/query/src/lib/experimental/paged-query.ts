import { computed } from '@angular/core';
import {
  ContentfulGqlLikePaginated,
  DynLikePaginated,
  GgLikePaginated,
  NormalizedPagination,
  Paginated,
} from '@ethlete/types';
import { QueryArgs, ResponseType } from './query';
import { QueryCreator } from './query-creator';
import { createQueryStack } from './query-stack';

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
};

export const createdPagedQuery = <TArgs extends QueryArgs>(options: CreatePagedQueryOptions<TArgs>) => {
  const { responseNormalizer, queryCreator } = options;

  const stack = createQueryStack(
    () => {
      const query = queryCreator({ onlyManualExecution: true });

      return query;
    },
    {
      append: true,
      // TODO: Based on the page we are on, we either want to append the new queries at the end or at the beginning.
      //   appendFn: (oldQueries, newQueries) => {
      //     const newQuery = newQueries[0];

      //     if (!newQuery) {
      //       const lastQuery = oldQueries[oldQueries.length - 1] ?? null;
      //       return { queries: oldQueries, lastQuery };
      //     }

      //   },
    },
  );

  const pagination = computed(() => {
    const res = stack.lastQuery()?.response();

    if (!res) return null;

    return responseNormalizer(res);
  });
};
