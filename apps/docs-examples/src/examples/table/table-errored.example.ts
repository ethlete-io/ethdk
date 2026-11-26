import { Component, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person } from './table-errored.data';

@Component({
  selector: 'app-table-errored-example',
  template: `
    <et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" [error]="error()" [errorTemplate]="failure">
      <ng-template #failure let-error>
        {{ error }}
        <button (click)="error.set(null)" et-button size="sm" type="button">Retry</button>
      </ng-template>
    </et-table>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, BUTTON_IMPORTS],
})
export class TableErroredExampleComponent {
  protected readonly PEOPLE = PEOPLE;
  protected error = signal<string | null>('Request failed with status 500');

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name },
    email: { header: 'Email', value: (person) => person.email },
    role: { header: 'Role', value: (person) => person.role },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
