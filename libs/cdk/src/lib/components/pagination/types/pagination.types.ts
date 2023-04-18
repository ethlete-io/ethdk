export interface PaginateOptions {
  currentPage: number;
  totalPageCount: number;
}

export interface PaginationItem {
  current: boolean;
  page: number;
  ariaLabel: string;
  disabled: boolean;
  type: 'page' | 'hotLink';
  explicitType: 'first' | 'last' | 'previous' | 'next' | 'current' | 'page-number-close' | 'page-number-far';
  url: string;
}

export interface PaginationHeadServiceConfig {
  firstPageTitle: string | null;
  titleTemplate: string | null;
  addCanonicalTag: boolean;
}
