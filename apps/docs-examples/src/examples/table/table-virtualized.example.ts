import { Component, ViewEncapsulation } from '@angular/core';
import { TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person } from './table-virtualized.data';

@Component({
  selector: 'app-table-virtualized-example',
  template: `<et-table
    [data]="PEOPLE"
    [columns]="COLUMNS"
    [rowKey]="rowKey"
    class="app-virtual-table"
    etTableVirtualScroll
  />`,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS],
  styles: `
    .app-virtual-table {
      block-size: 400px;
    }
  `,
})
export class TableVirtualizedExampleComponent {
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
