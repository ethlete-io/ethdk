import { Component, ViewEncapsulation } from '@angular/core';
import { TABLE_FILTER_IMPORTS, TABLE_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person, ROLES } from './table-templated-filter-options.data';

@Component({
  selector: 'app-table-templated-filter-options-example',
  template: `
    <et-table [data]="PEOPLE" [columns]="COLUMNS" [rowKey]="rowKey" etTableFilters>
      <ng-template [etTableFilterOption]="COLUMNS.role" let-option let-selected="selected">
        <span class="app-filter-option">
          <span>{{ option.label }}</span>
          <span class="app-filter-option-hint">{{ ROLE_HINTS[option.label] }}{{ selected ? ' · active' : '' }}</span>
        </span>
      </ng-template>
    </et-table>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_FILTER_IMPORTS],
  styles: `
    .app-filter-option {
      display: flex;
      flex-direction: column;
    }

    .app-filter-option-hint {
      font-size: 1.2rem;
      opacity: 0.6;
    }
  `,
})
export class TableTemplatedFilterOptionsExampleComponent {
  protected readonly PEOPLE = PEOPLE;

  protected readonly ROLE_HINTS: Record<string, string> = {
    Admin: 'Full access',
    Editor: 'Can publish',
    Viewer: 'Read only',
  };

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email },
    role: {
      header: 'Role',
      value: (person) => person.role,
      filterable: true,
      filterOptions: ROLES.map((role) => ({ label: role, value: role })),
    },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
