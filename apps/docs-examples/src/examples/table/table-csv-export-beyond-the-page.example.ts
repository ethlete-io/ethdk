import { Component, computed, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  TABLE_CSV_EXPORT_IMPORTS,
  TABLE_IMPORTS,
  TableColumns,
  tableCsvRowsFromPages,
  TableRowsSource,
} from '@ethlete/components';
import { map, timer } from 'rxjs';
import { PEOPLE, Person } from './table-csv-export-beyond-the-page.data';

const PAGE_SIZE = 4;
const LATENCY_MS = 500;

@Component({
  selector: 'app-table-csv-export-beyond-the-page-example',
  template: `
    <div class="app-toolbar">
      <button
        [disabled]="csv.exporting()"
        (click)="csv.export({ rows: allPeople, filename: 'people-all.csv' })"
        size="sm"
        variant="outline"
        et-button
        type="button"
      >
        {{ csv.exporting() ? 'Exporting…' : 'Export all pages' }}
      </button>
      <button
        [disabled]="csv.exporting()"
        (click)="csv.export({ partial: true, filename: 'people-page.csv' })"
        size="sm"
        variant="outline"
        et-button
        type="button"
      >
        Export this page
      </button>
    </div>

    <et-table
      #csv="etTableCsvExport"
      [rowsSource]="pageSource"
      [columns]="COLUMNS"
      [rowKey]="rowKey"
      [etTableCsvExport]="{ filename: 'people.csv' }"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TABLE_IMPORTS, TABLE_CSV_EXPORT_IMPORTS, BUTTON_IMPORTS],
  styles: `
    .app-toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class TableCsvExportBeyondThePageExampleComponent {
  protected pageSource: TableRowsSource<Person> = {
    rows: computed(() => PEOPLE.slice(0, PAGE_SIZE)),
    total: computed(() => PEOPLE.length),
  };

  protected allPeople = tableCsvRowsFromPages<Person>({
    fetchPage: (page) => timer(LATENCY_MS).pipe(map(() => PEOPLE.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))),
  });

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (person) => person.name },
    email: { header: 'Email', value: (person) => person.email },
    role: { header: 'Role', value: (person) => person.role },
    joined: { header: 'Joined', value: (person) => person.joinedAt, align: 'end' },
  } satisfies TableColumns<Person>;

  protected rowKey(person: Person) {
    return person.id;
  }
}
