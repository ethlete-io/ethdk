import { Component, ViewEncapsulation } from '@angular/core';
import { TABLE_FILTER_IMPORTS, TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person, ROLES } from './table-single-select-filter.data';

@Component({
  selector: 'app-table-single-select-filter-example',
  template: `<et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" etTableFilters />`,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_FILTER_IMPORTS],
})
export class TableSingleSelectFilterExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email },
    role: {
      header: 'Role',
      value: (person) => person.role,
      filterable: true,
      filterSelection: 'single',
      filterOptions: ROLES.map((role) => ({ label: role, value: role })),
    },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
