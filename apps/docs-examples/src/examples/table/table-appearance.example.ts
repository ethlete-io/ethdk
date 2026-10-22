import { Component, ViewEncapsulation } from '@angular/core';
import { TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person } from './table-appearance.data';

@Component({
  selector: 'app-table-appearance-example',
  template: `<et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" appearance="zebra" density="sm" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS],
})
export class TableAppearanceExampleComponent {
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
