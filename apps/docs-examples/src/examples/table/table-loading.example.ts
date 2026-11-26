import { Component, ViewEncapsulation } from '@angular/core';
import {
  CHIP_IMPORTS,
  SKELETON_IMPORTS,
  TABLE_IMPORTS,
  TABLE_SKELETON_IMPORTS,
  TableColumns,
} from '@ethlete/components';
import { Person } from './table-loading.data';

@Component({
  selector: 'app-table-loading-example',
  template: `
    <et-table [data]="ROWS" [columns]="COLUMNS" loading etTableSkeleton>
      <ng-template [etTableCell]="COLUMNS.role" let-value="value">
        <et-chip>{{ value }}</et-chip>
      </ng-template>

      <ng-template [etTableCellSkeleton]="COLUMNS.role">
        <et-skeleton-item class="app-chip-bone" shape="rect" />
      </ng-template>
    </et-table>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_SKELETON_IMPORTS, CHIP_IMPORTS, SKELETON_IMPORTS],
  styles: `
    .app-chip-bone {
      inline-size: 64px;
      block-size: 24px;
      --et-skeleton-radius: 999px;
    }
  `,
})
export class TableLoadingExampleComponent {
  protected readonly ROWS: Person[] = [];

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name },
    email: { header: 'Email', value: (person) => person.email },
    role: { header: 'Role', value: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, align: 'end' },
  } satisfies TableColumns<Person>;
}
