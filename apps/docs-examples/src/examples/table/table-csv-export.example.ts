import { Component, computed, signal, viewChild, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  TABLE_CSV_EXPORT_IMPORTS,
  TABLE_IMPORTS,
  TABLE_SELECTION_IMPORTS,
  TableColumns,
  TableSelectionDirective,
} from '@ethlete/components';
import { PEOPLE as BASE_PEOPLE, Person } from './table-csv-export.data';

@Component({
  selector: 'app-table-csv-export-example',
  template: `
    <div class="app-toolbar">
      <button (click)="csv.export()" size="sm" variant="outline" et-button type="button">Export CSV</button>
      <button
        [disabled]="!selectedPeople().length"
        (click)="csv.export({ rows: selectedPeople(), filename: 'people-selection.csv' })"
        size="sm"
        variant="outline"
        et-button
        type="button"
      >
        Export selection
      </button>
    </div>

    <et-table
      #csv="etTableCsvExport"
      #selection="etTableSelection"
      [data]="PEOPLE"
      [columns]="COLUMNS"
      [rowKey]="rowKey"
      [etTableCsvExport]="{ filename: 'people.csv' }"
      [etTableSelection]="{ selection: selected }"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_CSV_EXPORT_IMPORTS, TABLE_SELECTION_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .app-toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class TableCsvExportExampleComponent {
  protected selection = viewChild<TableSelectionDirective<Person>>('selection');

  protected readonly PEOPLE = BASE_PEOPLE.map((person, index) =>
    index === 1 ? { ...person, name: 'Jürgen Habermas' } : person,
  );
  protected selected = signal<Set<unknown>>(new Set());
  protected selectedPeople = computed(() => this.selection()?.selectedRows() ?? []);

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name, sortable: true },
    email: { header: 'Email', value: (person) => person.email, sortable: true },
    role: { header: 'Role', value: (person) => person.role, exportValue: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, sortable: true, align: 'end' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
