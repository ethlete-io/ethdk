import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_IMPORTS,
  TABLE_STICKY_COLUMNS_IMPORTS,
  TableColumns,
} from '@ethlete/components';
import { PEOPLE, Person } from './table-pin-columns-at-runtime.data';

@Component({
  selector: 'app-table-pin-columns-at-runtime-example',
  template: `
    <div class="app-toolbar">
      <button (click)="table.pinColumn('email', 'start')" size="sm" variant="outline" et-button type="button">
        Pin email
      </button>
      <button (click)="table.pinColumn('email', null)" size="sm" variant="outline" et-button type="button">
        Unpin email
      </button>
    </div>

    <et-table
      #table
      [data]="PEOPLE"
      [columns]="COLUMNS"
      [rowKey]="rowKey"
      class="app-pin-table"
      etTableStickyColumns
      etTableColumnMenu
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_STICKY_COLUMNS_IMPORTS, TABLE_COLUMN_MENU_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .app-toolbar {
      display: flex;
      gap: 8px;
    }

    .app-pin-table {
      max-inline-size: 700px;
    }
  `,
})
export class TablePinColumnsAtRuntimeExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, width: '220px' },
    email: { header: 'Email', value: (person) => person.email, width: '280px' },
    role: { header: 'Role', value: (person) => person.role, width: '200px' },
    joined: { header: 'Joined', value: (person) => person.joinedAt, align: 'end', width: '160px' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
