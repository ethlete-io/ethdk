/* eslint-disable @typescript-eslint/no-explicit-any */
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewChild, ViewEncapsulation } from '@angular/core';
import { clone } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { Sort, SortImports } from '../../../sort';
import { TableComponent } from '../../components';
import { TableImports } from '../../table.imports';

@Component({
  selector: 'et-sb-table',
  template: `
    <div class="example-container">
      <et-table [dataSource]="(dataSource$ | async)!" (etSortChange)="sortChange($event)" etSort>
        <ng-container etColumnDef="name" sticky>
          <et-header-cell *etHeaderCellDef et-sort-header> Name (sticky) </et-header-cell>
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
    </div>
  `,
  standalone: true,
  imports: [TableImports, SortImports, AsyncPipe],
  styles: [
    `
      .example-container {
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
      }

      et-table {
        min-width: 800px;
        background-color: #121212;
      }

      et-cell.et-column-weight,
      et-header-cell.et-column-weight {
        padding-left: 8px;
      }

      .et-table-sticky-border-elem-right {
        border-left: 1px solid #e0e0e0;
      }

      .et-table-sticky-border-elem-left {
        border-right: 1px solid #e0e0e0;
      }
    `,
  ],
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
    if (!sort.direction) {
      this.dataSource$.next(this.dataSource);
      return;
    }

    const propertyName = sort.active;
    const direction = sort.direction;

    const cl = clone(this.dataSource);

    cl.sort((a, b) => {
      if (a[propertyName] < b[propertyName]) {
        return direction === 'asc' ? -1 : 1;
      }
      if (a[propertyName] > b[propertyName]) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.dataSource$.next(cl);
    this.table.renderRows();
  }
}
