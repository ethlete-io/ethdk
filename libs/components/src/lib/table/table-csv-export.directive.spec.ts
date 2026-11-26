import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../test-helpers';
import * as tableExports from './index';
import { TableCsvExportConfig, TableCsvExportDirective } from './table-csv-export.directive';
import { TableComponent } from './table.component';
import { TABLE_CSV_EXPORT_IMPORTS, TABLE_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { name: string; role: string };

const PEOPLE: Person[] = [
  { name: 'Ada', role: 'Admin' },
  { name: 'Bob', role: 'Editor' },
];

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    role: { header: 'Role', value: (person) => person.role },
  }) satisfies TableColumns<Person>;

@Component({
  template: `<et-table [columns]="cols" [data]="data" [etTableCsvExport]="config()" />`,
  imports: [TABLE_IMPORTS, TABLE_CSV_EXPORT_IMPORTS],
})
class HostComponent {
  public cols = columns();
  public data = PEOPLE;
  public config = signal<TableCsvExportConfig<Person>>({});
  public csv = viewChild.required<TableCsvExportDirective<Person>>(TableCsvExportDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);
}

/** The blob parts the download handed to `URL.createObjectURL`, so a test can read the written file. */
let written: BlobPart[][];

const create = (config: TableCsvExportConfig<Person> = {}) => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.componentInstance.config.set(config);
  fixture.detectChanges();

  return fixture.componentInstance.csv();
};

const writtenText = async (index = 0) => {
  const parts = written[index];

  if (!parts) throw new Error('nothing was written');

  return new Blob(parts).text();
};

beforeEach(() => {
  written = [];
  // jsdom has no object URLs, and this is also how the file's content is read back.
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (!(blob instanceof Blob)) throw new Error('expected a Blob');

    written.push([blob]);

    return 'blob:test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

describe('TableCsvExportDirective', () => {
  it('starts every export from the bound config', async () => {
    create({ delimiter: ';' }).export();

    await expect(writtenText()).resolves.toBe('Name;Role\r\nAda;Admin\r\nBob;Editor');
  });

  it('lets a per-call override win over the config', async () => {
    create({ delimiter: ';' }).export({ delimiter: '|' });

    await expect(writtenText()).resolves.toContain('Name|Role');
  });

  describe('a config next to a per-call `file`', () => {
    it('drops the serializer options the config bound rather than calling them a conflict', async () => {
      const csv = create({ bom: false, delimiter: ';' });

      expect(() => csv.export({ file: of('a;b'), filename: 'server.csv' })).not.toThrow();
      await expect(writtenText()).resolves.toBe('a;b');
    });

    it('still refuses `file` together with a serializer option in the same call', () => {
      const csv = create();

      expect(() => csv.export({ file: of('a'), delimiter: ';' })).toThrow(/ET3507/);
    });

    it('drops a config `file` for a call that asks for rows', async () => {
      const csv = create({ file: of('from the server') });

      expect(() => csv.export({ rows: [PEOPLE[0]!] })).not.toThrow();
      await expect(writtenText()).resolves.toBe('Name,Role\r\nAda,Admin');
    });
  });
});

describe('the CSV export functions the directive docs point at', () => {
  it('are both on the table barrel, under the names the docs use', () => {
    expect(typeof tableExports.tableToCsv).toBe('function');
    expect(typeof tableExports.injectTableCsvExport).toBe('function');
    expect(Object.keys(tableExports)).not.toContain('exportTableToCsv');
  });

  it('serialize without downloading, and download the same bytes', async () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.detectChanges();

    const table = fixture.componentInstance.table();

    expect(tableExports.tableToCsv(table)).toBe('Name,Role\r\nAda,Admin\r\nBob,Editor');

    const download = TestBed.runInInjectionContext(() => tableExports.injectTableCsvExport());

    await new Promise<void>((resolve) => download(table).subscribe({ complete: () => resolve() }));

    await expect(writtenText()).resolves.toBe('Name,Role\r\nAda,Admin\r\nBob,Editor');
  });
});
