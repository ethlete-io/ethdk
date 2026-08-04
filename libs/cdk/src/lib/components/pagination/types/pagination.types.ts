/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type PaginateOptions = {
  currentPage: number;
  totalPageCount: number;

  /**
   * @default false
   */
  omitFirstLast?: boolean;

  /**
   * @default false
   */
  omitPreviousNext?: boolean;

  /**
   * @default 2
   */
  pagesBeforeAfter?: number;

  /**
   * @default 1
   */
  firstPage?: number;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type PaginationItem = {
  current: boolean;
  page: number;
  ariaLabel: string;
  disabled: boolean;
  type: 'page' | 'hotLink';
  explicitType: 'first' | 'last' | 'previous' | 'next' | 'current' | 'page-number-close' | 'page-number-far';
  url: string;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type PaginationHeadServiceConfig = {
  firstPageTitle: string | null;
  titleTemplate: string | null;
  addCanonicalTag: boolean;
};
