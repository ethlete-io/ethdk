import { Component, ViewEncapsulation } from '@angular/core';
import { TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person } from './table-shift-multi-sort.data';

@Component({
  selector: 'app-table-shift-multi-sort-example',
  template: `<et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" multiSort="shift" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS],
})
export class TableShiftMultiSortExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    role: { header: 'Role', value: (person) => person.role, sortable: true },
    joined: { header: 'Joined', value: (person) => person.joinedAt, sortable: true, align: 'end' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
