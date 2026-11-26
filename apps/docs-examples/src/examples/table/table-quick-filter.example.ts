import { Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS, TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person } from './table-quick-filter.data';

@Component({
  selector: 'app-table-quick-filter-example',
  template: `
    <et-form-field appearance="box" size="sm">
      <et-label>Search people</et-label>
      <et-input [formField]="searchForm.query" type="search" />
    </et-form-field>

    <et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" [quickFilter]="searchForm.query().value()" />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, FormField],
})
export class TableQuickFilterExampleComponent {
  protected readonly PEOPLE = PEOPLE;
  protected searchForm = form(signal({ query: '' }));

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email, sortable: true },
    role: { header: 'Role', value: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, align: 'end' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
