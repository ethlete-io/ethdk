import { Component, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_IMPORTS,
  TABLE_KEYBOARD_NAV_IMPORTS,
  TableColumns,
} from '@ethlete/components';
import { PEOPLE, Person } from './table-keyboard-navigation.data';

@Component({
  selector: 'app-table-keyboard-navigation-example',
  template: `
    <et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" etTableKeyboardNav etTableColumnMenu>
      <ng-template [etTableCell]="COLUMNS.joined" let-value="value">
        <button type="button" et-text-button>{{ value }}</button>
      </ng-template>
    </et-table>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_KEYBOARD_NAV_IMPORTS, TABLE_COLUMN_MENU_IMPORTS, BUTTON_IMPORTS],
})
export class TableKeyboardNavigationExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email, sortable: true },
    role: { header: 'Role', value: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, sortable: true, align: 'end' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
