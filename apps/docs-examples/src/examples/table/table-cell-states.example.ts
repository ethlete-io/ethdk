import { Component, ViewEncapsulation } from '@angular/core';
import {
  TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
  TABLE_IMPORTS,
  TABLE_SKELETON_IMPORTS,
  TableCellStateValue,
  TableColumns,
} from '@ethlete/components';
import { PEOPLE, Person } from './table-cell-states.data';

@Component({
  selector: 'app-table-cell-states-example',
  template: `
    <et-table
      [data]="PEOPLE"
      [columns]="COLUMNS"
      [rowKey]="rowKey"
      [cellState]="cellState"
      etTableSkeleton
      etTableCellErrorTooltip
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_SKELETON_IMPORTS, TABLE_CELL_ERROR_TOOLTIP_IMPORTS],
})
export class TableCellStatesExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name },
    email: { header: 'Email', value: (person) => person.email },
    role: { header: 'Role', value: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, align: 'end' },
  } satisfies TableColumns<Person>;

  protected cellState(person: Person, key: string): TableCellStateValue | null {
    if (person.id === 2 && key === 'email') return 'loading';

    if (person.id === 4 && key === 'role') return { state: 'error', message: 'Role could not be saved: 409 conflict' };

    return null;
  }

  protected rowKey(person: Person) {
    return person.id;
  }
}
