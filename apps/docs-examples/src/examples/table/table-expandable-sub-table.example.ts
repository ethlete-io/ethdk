import { Component, signal, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { TABLE_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS, TableColumns } from '@ethlete/components';
import { PEOPLE, Person, Project, PROJECTS_BY_PERSON } from './table-expandable-sub-table.data';

@Component({
  selector: 'app-table-expandable-sub-table-example',
  template: `
    <et-table
      [data]="PEOPLE"
      [columns]="COLUMNS"
      [rowKey]="rowKey"
      [expandedRowTemplate]="detail"
      [etTableRowExpansion]="{ expanded: expanded }"
    />

    <ng-template #detail let-person>
      <p class="app-detail-title">{{ person.name }}'s projects</p>

      <et-table
        [data]="projectsOf(person)"
        [columns]="PROJECT_COLUMNS"
        [rowKey]="projectKey"
        [labels]="{ empty: 'No projects' }"
        density="sm"
        etAutoSurface
      />
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS, AutoSurfaceDirective],
  styles: `
    .app-detail-title {
      margin: 0 0 8px;
      font-weight: 500;
    }
  `,
})
export class TableExpandableSubTableExampleComponent {
  protected readonly PEOPLE = PEOPLE;
  protected expanded = signal<Set<unknown>>(new Set());

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email },
    role: { header: 'Role', value: (person) => person.role },
  } satisfies TableColumns<Person>;

  protected readonly PROJECT_COLUMNS = {
    name: { header: 'Project', value: (project) => project.name, sortable: true, width: 'minmax(96px, 2fr)' },
    status: { header: 'Status', value: (project) => project.status, width: 'minmax(96px, 1fr)' },
    hours: { header: 'Hours', value: (project) => `${project.hours} h`, sortable: true, align: 'end' },
  } satisfies TableColumns<Project>;

  protected rowKey(person: Person) {
    return person.id;
  }

  protected projectKey(project: Project) {
    return project.id;
  }

  protected projectsOf(person: Person) {
    return PROJECTS_BY_PERSON.get(person.id) ?? [];
  }
}
