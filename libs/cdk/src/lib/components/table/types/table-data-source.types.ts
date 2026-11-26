import { Observable, Subject } from 'rxjs';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type TableDataSourcePageEvent = {
  pageIndex: number;
  pageSize: number;
  length: number;
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type TableDataSourcePaginator = {
  page: Subject<TableDataSourcePageEvent>;
  pageIndex: number;
  initialized: Observable<void>;
  pageSize: number;
  length: number;
  firstPage: () => void;
  lastPage: () => void;
};
