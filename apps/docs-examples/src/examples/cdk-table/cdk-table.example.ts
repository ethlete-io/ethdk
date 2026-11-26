import { Component, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { SortImports, TableComponent, TableImports } from '@ethlete/cdk';
import { Sort } from '@ethlete/query';

type Element = { name: string; weight: number; symbol: string; firstLetter: string };

const ELEMENTS: Element[] = [
  { name: 'Hydrogen', weight: 1.0079, symbol: 'H', firstLetter: 'H' },
  { name: 'Helium', weight: 4.0026, symbol: 'He', firstLetter: 'H' },
  { name: 'Lithium', weight: 6.941, symbol: 'Li', firstLetter: 'L' },
  { name: 'Beryllium', weight: 9.0122, symbol: 'Be', firstLetter: 'B' },
  { name: 'Boron', weight: 10.811, symbol: 'B', firstLetter: 'B' },
  { name: 'Carbon', weight: 12.0107, symbol: 'C', firstLetter: 'C' },
  { name: 'Nitrogen', weight: 14.0067, symbol: 'N', firstLetter: 'N' },
];

@Component({
  selector: 'app-cdk-table-example',
  template: `
    <et-table [dataSource]="rows()" (etSortChange)="sortChange($event)" etSort>
      <ng-container etColumnDef="name" sticky>
        <et-header-cell *etHeaderCellDef>
          <p et-sort-header="name">Name</p>
          <p et-sort-header="firstLetter">First letter</p>
          <p>(sticky col)</p>
        </et-header-cell>
        <et-cell *etCellDef="let row">{{ row.name }} ({{ row.firstLetter }})</et-cell>
      </ng-container>

      <ng-container etColumnDef="weight">
        <et-header-cell *etHeaderCellDef et-sort-header>Weight</et-header-cell>
        <et-cell *etCellDef="let row">{{ row.weight }}</et-cell>
      </ng-container>

      <ng-container etColumnDef="symbol">
        <et-header-cell *etHeaderCellDef et-sort-header>Symbol</et-header-cell>
        <et-cell *etCellDef="let row">{{ row.symbol }}</et-cell>
      </ng-container>

      <et-header-row *etHeaderRowDef="['name', 'weight', 'symbol']" />
      <et-row *etRowDef="let row; columns: ['name', 'weight', 'symbol']" />
    </et-table>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TableImports, SortImports],
})
export class CdkTableExampleComponent {
  public table = viewChild.required(TableComponent);

  public rows = signal<Element[]>(ELEMENTS);

  public sortChange(sort: Sort) {
    if (!sort.direction) {
      this.rows.set(ELEMENTS);
    } else {
      const key = sort.active as keyof Element;
      const factor = sort.direction === 'asc' ? 1 : -1;

      this.rows.set([...ELEMENTS].sort((a, b) => (a[key] < b[key] ? -factor : a[key] > b[key] ? factor : 0)));
    }

    this.table().renderRows();
  }
}
