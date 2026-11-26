import { Component, ViewEncapsulation } from '@angular/core';
import {
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_FILTER_IMPORTS,
  TABLE_IMPORTS,
  TABLE_RESIZE_IMPORTS,
  TABLE_STICKY_COLUMNS_IMPORTS,
  TableColumns,
} from '@ethlete/components';
import { PEOPLE, Person, ROLES } from './table-column-menu.data';

@Component({
  selector: 'app-table-column-menu-example',
  template: `
    <et-table
      [data]="PEOPLE"
      [columns]="COLUMNS"
      [rowKey]="rowKey"
      etTableColumnMenu
      etTableFilters
      etTableResize
      etTableStickyColumns
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    TABLE_IMPORTS,
    TABLE_COLUMN_MENU_IMPORTS,
    TABLE_FILTER_IMPORTS,
    TABLE_RESIZE_IMPORTS,
    TABLE_STICKY_COLUMNS_IMPORTS,
  ],
})
export class TableColumnMenuExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true, width: 'minmax(96px, 2fr)' },
    email: { header: 'Email', value: (person) => person.email, sortable: true, width: 'minmax(96px, 2fr)' },
    role: {
      header: 'Role',
      value: (person) => person.role,
      filterable: true,
      filterOptions: ROLES.map((role) => ({ label: role, value: role })),
      width: 'minmax(96px, 1fr)',
    },
    joined: {
      header: 'Joined',
      value: (person) => person.joinedAt,
      sortable: true,
      align: 'end',
      width: 'minmax(96px, 1fr)',
    },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
