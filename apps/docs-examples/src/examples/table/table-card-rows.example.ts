import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, CHIP_IMPORTS, TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person } from './table-card-rows.data';

@Component({
  selector: 'app-table-card-rows-example',
  template: `
    <et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" [rowLink]="personLink" appearance="cards">
      <ng-template [etTableCell]="COLUMNS.role" let-value="value">
        <et-chip>{{ value }}</et-chip>
      </ng-template>

      <ng-template [etTableCell]="COLUMNS.joined">
        <button size="sm" variant="outline" et-button type="button">Archive</button>
      </ng-template>
    </et-table>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, CHIP_IMPORTS, BUTTON_IMPORTS],
})
export class TableCardRowsExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email, sortable: true },
    role: { header: 'Role', value: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, interactive: true, align: 'end' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }

  protected personLink(person: Person) {
    return '#/people/' + person.id;
  }
}
