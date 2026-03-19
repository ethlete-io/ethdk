import { PaginationView } from './api';

export type Paginated<T> = Omit<PaginationView, 'items'> & {
  items: T[];
};

export type GgLikePaginated<T> = {
  items: T[];
  totalHits: number;
  currentPage: number;
  totalPageCount: number;
  itemsPerPage: number;
};

export type DynLikePaginated<T> = {
  items: T[];
  totalHits: number;
  currentPage: number;
  totalPages: number;
  limit: number;
};

export type NormalizedPagination<T> = {
  items: T[];
  totalPages: number;
  totalHits: number;
  currentPage: number;
  itemsPerPage: number;
};

export type ContentfulGqlLikePaginated<T> = {
  items: T[];
  limit: number;
  skip: number;
  total: number;
};
