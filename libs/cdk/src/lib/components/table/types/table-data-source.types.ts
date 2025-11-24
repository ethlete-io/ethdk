import { Observable, Subject } from 'rxjs';

export type TableDataSourcePageEvent = {
  pageIndex: number;
  pageSize: number;
  length: number;
};

export type TableDataSourcePaginator = {
  page: Subject<TableDataSourcePageEvent>;
  pageIndex: number;
  initialized: Observable<void>;
  pageSize: number;
  length: number;
  firstPage: () => void;
  lastPage: () => void;
};
