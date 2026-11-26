import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person } from './table-row-links.data';

@Component({
  selector: 'app-table-row-links-example',
  template: `
    <et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" [rowLink]="personLink">
      <ng-template [etTableCell]="COLUMNS.joined">
        <button size="sm" variant="outline" et-button type="button">Archive</button>
      </ng-template>
    </et-table>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, BUTTON_IMPORTS],
})
export class TableRowLinksExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email },
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
