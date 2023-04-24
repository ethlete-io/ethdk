import { Observable, Subject } from 'rxjs';

export interface TableDataSourcePageEvent {
  pageIndex: number;
  pageSize: number;
  length: number;
}

export interface TableDataSourcePaginator {
  page: Subject<TableDataSourcePageEvent>;
  pageIndex: number;
  initialized: Observable<void>;
  pageSize: number;
  length: number;
  firstPage: () => void;
  lastPage: () => void;
}
