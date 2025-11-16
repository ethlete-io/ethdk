import { _isNumberValue } from '@angular/cdk/coercion';
import { DataSource } from '@angular/cdk/collections';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { Sort } from '@ethlete/query';
import { BehaviorSubject, Observable, Subject, Subscription, combineLatest, map, merge, of } from 'rxjs';
import { SortDirective } from '../../sort/partials/sort';
import { MAX_SAFE_INTEGER } from '../constants';
import { TableDataSourcePageEvent, TableDataSourcePaginator } from '../types';

export class TableDataSource<T, P extends TableDataSourcePaginator = TableDataSourcePaginator> extends DataSource<T> {
  private readonly _data: BehaviorSubject<T[]>;
  private readonly _renderData = new BehaviorSubject<T[]>([]);
  private readonly _filter = new BehaviorSubject<string>('');
  private readonly _internalPageChanges = new Subject<void>();

  _renderChangesSubscription: Subscription | null = null;
  filteredData: T[] = [];

  get data() {
    return this._data.value;
  }
  set data(data: T[]) {
    data = Array.isArray(data) ? data : [];
    this._data.next(data);

    if (!this._renderChangesSubscription) {
      this._filterData(data);
    }
  }

  get filter(): string {
    return this._filter.value;
  }
  set filter(filter: string) {
    this._filter.next(filter);

    if (!this._renderChangesSubscription) {
      this._filterData(this.data);
    }
  }

  get sort(): SortDirective | null {
    return this._sort;
  }
  set sort(sort: SortDirective | null) {
    this._sort = sort;
    this._updateChangeSubscription();
  }
  private _sort: SortDirective | null = null;

  get paginator(): P | null {
    return this._paginator;
  }
  set paginator(paginator: P | null) {
    this._paginator = paginator;
    this._updateChangeSubscription();
  }
  private _paginator: P | null = null;

  sortingDataAccessor: (data: T, sortHeaderId: string) => string | number = (
    data: T,
    sortHeaderId: string,
  ): string | number => {
    const value = (data as unknown as Record<string, unknown>)[sortHeaderId];

    if (_isNumberValue(value)) {
      const numberValue = Number(value);

      return numberValue < MAX_SAFE_INTEGER ? numberValue : (value as number);
    }

    return value as string;
  };

  sortData: (data: T[], sort: SortDirective) => T[] = (data: T[], sort: SortDirective): T[] => {
    const active = sort.active;
    const direction = sort.direction;
    if (!active || direction == '') {
      return data;
    }

    return data.sort((a, b) => {
      let valueA = this.sortingDataAccessor(a, active);
      let valueB = this.sortingDataAccessor(b, active);

      const valueAType = typeof valueA;
      const valueBType = typeof valueB;

      if (valueAType !== valueBType) {
        if (valueAType === 'number') {
          valueA += '';
        }
        if (valueBType === 'number') {
          valueB += '';
        }
      }

      let comparatorResult = 0;
      if (valueA != null && valueB != null) {
        if (valueA > valueB) {
          comparatorResult = 1;
        } else if (valueA < valueB) {
          comparatorResult = -1;
        }
      } else if (valueA != null) {
        comparatorResult = 1;
      } else if (valueB != null) {
        comparatorResult = -1;
      }

      return comparatorResult * (direction == 'asc' ? 1 : -1);
    });
  };

  filterPredicate: (data: T, filter: string) => boolean = (data: T, filter: string): boolean => {
    const dataStr = Object.keys(data as unknown as Record<string, unknown>)
      .reduce((currentTerm: string, key: string) => {
        return currentTerm + (data as unknown as Record<string, unknown>)[key] + '◬';
      }, '')
      .toLowerCase();

    const transformedFilter = filter.trim().toLowerCase();

    return dataStr.indexOf(transformedFilter) != -1;
  };

  constructor(initialData: T[] = []) {
    super();
    this._data = new BehaviorSubject<T[]>(initialData);
    this._updateChangeSubscription();
  }

  _updateChangeSubscription() {
    const sortChange: Observable<Sort | null | void> = this._sort
      ? (merge(outputToObservable(this._sort.sortChange), this._sort.initialized) as Observable<Sort | void>)
      : of(null);
    const pageChange: Observable<TableDataSourcePageEvent | null | void> = this._paginator
      ? (merge(
          this._paginator.page,
          this._internalPageChanges,
          this._paginator.initialized,
        ) as Observable<TableDataSourcePageEvent | void>)
      : of(null);
    const dataStream = this._data;

    const filteredData = combineLatest([dataStream, this._filter]).pipe(map(([data]) => this._filterData(data)));

    const orderedData = combineLatest([filteredData, sortChange]).pipe(map(([data]) => this._orderData(data)));

    const paginatedData = combineLatest([orderedData, pageChange]).pipe(map(([data]) => this._pageData(data)));

    this._renderChangesSubscription?.unsubscribe();
    this._renderChangesSubscription = paginatedData.subscribe((data) => this._renderData.next(data));
  }

  _filterData(data: T[]) {
    this.filteredData =
      this.filter == null || this.filter === '' ? data : data.filter((obj) => this.filterPredicate(obj, this.filter));

    if (this.paginator) {
      this._updatePaginator(this.filteredData.length);
    }

    return this.filteredData;
  }

  _orderData(data: T[]): T[] {
    if (!this.sort) {
      return data;
    }

    return this.sortData(data.slice(), this.sort);
  }

  _pageData(data: T[]): T[] {
    if (!this.paginator) {
      return data;
    }

    const startIndex = this.paginator.pageIndex * this.paginator.pageSize;
    return data.slice(startIndex, startIndex + this.paginator.pageSize);
  }

  _updatePaginator(filteredDataLength: number) {
    Promise.resolve().then(() => {
      const paginator = this.paginator;

      if (!paginator) {
        return;
      }

      paginator.length = filteredDataLength;

      if (paginator.pageIndex > 0) {
        const lastPageIndex = Math.ceil(paginator.length / paginator.pageSize) - 1 || 0;
        const newPageIndex = Math.min(paginator.pageIndex, lastPageIndex);

        if (newPageIndex !== paginator.pageIndex) {
          paginator.pageIndex = newPageIndex;

          this._internalPageChanges.next();
        }
      }
    });
  }

  connect() {
    if (!this._renderChangesSubscription) {
      this._updateChangeSubscription();
    }

    return this._renderData;
  }

  disconnect() {
    this._renderChangesSubscription?.unsubscribe();
    this._renderChangesSubscription = null;
  }
}
