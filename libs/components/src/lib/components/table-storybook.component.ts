/* eslint-disable @typescript-eslint/no-explicit-any */
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewChild, ViewEncapsulation } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Sort, SortModule } from './sort';
import { TableModule } from './table/module';
import { TableComponent } from './table/table';

@Component({
  selector: 'et-sb-table',
  template: `
    <et-table [dataSource]="(dataSource$ | async)!" (etSortChange)="sortChange($event)" etSort>
      <ng-container etColumnDef="name">
        <et-header-cell *etHeaderCellDef et-sort-header> Name </et-header-cell>
        <et-cell *etCellDef="let row"> {{ row.name }} </et-cell>
      </ng-container>

      <ng-container etColumnDef="weight">
        <et-header-cell *etHeaderCellDef et-sort-header> Weight </et-header-cell>
        <et-cell *etCellDef="let row"> {{ row.weight }} </et-cell>
      </ng-container>

      <ng-container etColumnDef="symbol">
        <et-header-cell *etHeaderCellDef et-sort-header> Symbol </et-header-cell>
        <et-cell *etCellDef="let row"> {{ row.symbol }} </et-cell>
      </ng-container>

      <et-header-row *etHeaderRowDef="['name', 'weight', 'symbol']"></et-header-row>
      <et-row *etRowDef="let row; columns: ['name', 'weight', 'symbol']"></et-row>
    </et-table>
  `,
  standalone: true,
  imports: [TableModule, SortModule, AsyncPipe],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableStorybookComponent {
  @Input()
  get dataSource(): any[] {
    return this._dataSource;
  }
  set dataSource(v: any[]) {
    this._dataSource = v;
    this.dataSource$.next(v);
  }
  private _dataSource: any[] = [];

  @ViewChild(TableComponent, { static: true })
  table!: TableComponent<any>;

  dataSource$ = new BehaviorSubject<any[]>(this.dataSource);

  // This is only for demo purposes. Please don't do this in your app.
  // The change detection inside storybook is a bit weird.
  sortChange(sort: Sort) {
    const propertyName = sort.active;
    const direction = sort.direction;

    this.dataSource = this._dataSource.sort((a, b) => {
      if (a[propertyName] < b[propertyName]) {
        return direction === 'asc' ? -1 : 1;
      }
      if (a[propertyName] > b[propertyName]) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.table.renderRows();
  }
}
