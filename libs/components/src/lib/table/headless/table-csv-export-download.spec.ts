import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../test-helpers';
import { TableColumnDef } from '../table.types';
import { injectTableCsvExport, TableCsvExportOptions, TableCsvSource } from './table-csv-export';

type Row = { name: string };

const ROWS: Row[] = [{ name: 'Ada' }, { name: 'Grace' }];

const COLUMNS: TableColumnDef<Row>[] = [{ key: 'name', header: 'Name', value: (row) => row.name }];

const source = (config: Partial<TableCsvSource<Row>> = {}): TableCsvSource<Row> => ({
  rows: () => ROWS,
  visibleColumns: () => COLUMNS,
  allColumns: () => COLUMNS,
  ...config,
});

/** The blob parts the download handed to `URL.createObjectURL`, so a test can read the written file. */
let written: BlobPart[][];

const download = () => runInInjectionContext(TestBed.inject(Injector), () => injectTableCsvExport());

// The export writes nothing until it is subscribed to, so every test subscribes - and gets back a
// promise that settles when the file has been written.
const exportWith = (options: TableCsvExportOptions<Row>, table = source()) =>
  firstValueFrom(download()(table, options), { defaultValue: undefined });

/** Start an export without waiting for it, for the tests that drive its source by hand. */
const startExport = (options: TableCsvExportOptions<Row>, table = source()) => exportWith(options, table);

const writtenText = async (index = 0) => {
  const parts = written[index];

  if (!parts) throw new Error('nothing was written');

  return new Blob(parts).text();
};

beforeEach(() => {
  written = [];
  // jsdom has no object URLs, and this is also how the file's content is read back.
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    written.push([blob]);

    return 'blob:test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

describe('injectTableCsvExport', () => {
  it('writes the table’s own rows when nothing says otherwise', async () => {
    await exportWith({ filename: 'people.csv' });

    await expect(writtenText()).resolves.toBe('Name\r\nAda\r\nGrace');
  });

  describe('rows as a provider', () => {
    it('awaits a promise of rows', async () => {
      await exportWith({ rows: () => Promise.resolve([{ name: 'Katherine' }]) });

      await expect(writtenText()).resolves.toBe('Name\r\nKatherine');
    });

    it('reads an observable of rows', async () => {
      await exportWith({ rows: () => of([{ name: 'Katherine' }]) });

      await expect(writtenText()).resolves.toBe('Name\r\nKatherine');
    });

    it('does not call the provider until the export is subscribed to', () => {
      const provider = vi.fn(() => Promise.resolve(ROWS));
      const run = download()(source(), { rows: provider });

      // Building the export asks for nothing - which is what a
      // `[etTableCsvExport]="{ rows: allPeople }"` binding relies on.
      expect(provider).not.toHaveBeenCalled();

      run.subscribe();
      expect(provider).toHaveBeenCalledTimes(1);
    });

    it('writes nothing when the provider rejects, rather than a short file', async () => {
      await expect(exportWith({ rows: () => Promise.reject(new Error('502')) })).rejects.toThrow('502');
      expect(written).toHaveLength(0);
    });
  });

  describe('a server-built file', () => {
    it('saves a promised blob as it came', async () => {
      await exportWith({ file: Promise.resolve(new Blob(['a;b\r\n1;2'])), filename: 'server.csv' });

      await expect(writtenText()).resolves.toBe('a;b\r\n1;2');
    });

    it('saves a string from an observable', async () => {
      await exportWith({ file: of('a;b') });

      await expect(writtenText()).resolves.toBe('a;b');
    });

    it('follows a query rather than executing it', async () => {
      const executionState = signal<{ type: string; response?: unknown; error?: unknown } | null>(null);
      const query = { executionState } as never;
      const done = startExport({ file: query });

      // Nothing is written while the query is still out.
      expect(written).toHaveLength(0);

      executionState.set({ type: 'loading' });
      expect(written).toHaveLength(0);

      executionState.set({ type: 'success', response: 'a;b' });
      TestBed.tick();
      await done;

      await expect(writtenText()).resolves.toBe('a;b');
    });

    it('rejects when the query fails', async () => {
      const executionState = signal<{ type: string; error?: unknown } | null>(null);
      const done = startExport({ file: { executionState } as never });

      executionState.set({ type: 'failure', error: new Error('500') });
      TestBed.tick();

      await expect(done).rejects.toThrow('500');
      expect(written).toHaveLength(0);
    });

    it('writes no BOM of its own - the server decided the encoding', async () => {
      await exportWith({ file: Promise.resolve('Näme') });

      await expect(writtenText()).resolves.toBe('Näme');
    });

    it('refuses options that describe how to build a file, since the server already did', async () => {
      // Thrown on the way in, not through the stream: the mistake is in the call.
      expect(() => download()(source(), { file: of('a'), delimiter: ';' })).toThrow(/ET3507/);
      expect(() => download()(source(), { file: of('a'), columns: 'all' })).toThrow(/`columns`/);
    });
  });

  describe('the partial-export guard', () => {
    const paginated = (total: number | null) => source({ totalRows: () => total });

    it('throws when the table is holding fewer rows than its source says exist', async () => {
      await expect(exportWith({}, paginated(4312))).rejects.toThrow(/ET3506/);
      await expect(exportWith({}, paginated(4312))).rejects.toThrow(/2 of 4312 rows/);
      expect(written).toHaveLength(0);
    });

    it('writes the loaded page when `partial` says so on purpose', async () => {
      await exportWith({ partial: true }, paginated(4312));

      await expect(writtenText()).resolves.toBe('Name\r\nAda\r\nGrace');
    });

    it('stays quiet for an explicit row list - a selection is already deliberate', async () => {
      await exportWith({ rows: [{ name: 'Ada' }] }, paginated(4312));

      await expect(writtenText()).resolves.toBe('Name\r\nAda');
    });

    it('stays quiet once the provider has fetched every row', async () => {
      await exportWith({ rows: () => Promise.resolve(ROWS) }, paginated(2));

      await expect(writtenText()).resolves.toBe('Name\r\nAda\r\nGrace');
    });

    it('stays quiet for a table with no total - it was given its rows outright', async () => {
      await exportWith({}, paginated(null));

      await expect(writtenText()).resolves.toBe('Name\r\nAda\r\nGrace');
    });

    it('stays quiet when the table holds everything', async () => {
      await exportWith({}, paginated(2));

      await expect(writtenText()).resolves.toBe('Name\r\nAda\r\nGrace');
    });
  });

  it('appends .csv to a filename that lacks it', async () => {
    const anchors: HTMLAnchorElement[] = [];
    const create = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = create(tag);

      if (tag === 'a') anchors.push(element as HTMLAnchorElement);

      return element;
    });

    await exportWith({ filename: 'people' });

    expect(anchors[0]?.getAttribute('download')).toBe('people.csv');
  });

  it('leaves a completed but empty file source as an empty file rather than hanging', async () => {
    const file = new Subject<string>();
    const done = startExport({ file });

    file.next('a;b');
    file.complete();

    await done;
    await expect(writtenText()).resolves.toBe('a;b');
  });
});
