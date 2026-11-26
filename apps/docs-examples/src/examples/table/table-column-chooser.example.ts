import { Component, ViewEncapsulation } from '@angular/core';
import {
  TABLE_COLUMN_CHOOSER_IMPORTS,
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_IMPORTS,
  TableColumns,
} from '@ethlete/components';
import { PEOPLE, Person } from './table-column-chooser.data';

@Component({
  selector: 'app-table-column-chooser-example',
  template: `
    <div class="app-toolbar">
      <et-table-column-chooser [table]="table" />
    </div>

    <et-table #table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" etTableColumnMenu />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_COLUMN_MENU_IMPORTS, TABLE_COLUMN_CHOOSER_IMPORTS],
  styles: `
    .app-toolbar {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class TableColumnChooserExampleComponent {
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
