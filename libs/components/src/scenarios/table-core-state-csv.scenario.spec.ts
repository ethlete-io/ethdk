import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import {
  createTableStateStorage,
  deserializeTableState,
  injectTableCsvExport,
  isRestorableTableState,
  mergeTableCsvExportOptions,
  reconcileColumnOrder,
  reconcileColumnWidths,
  reconcileHiddenColumns,
  resolveTableCsvRows,
  serializeTableState,
  TABLE_CSV_EXPORT_IMPORTS,
  TABLE_ERROR_CODES,
  TABLE_IMPORTS,
  TABLE_STATE_PERSISTENCE_IMPORTS,
  TableColumns,
  TableComponent,
  TableCsvExportDirective,
  tableCsvRowsFromPages,
  TableRowsSource,
  TableState,
  TableStatePersistenceConfig,
  TableStatePersistenceDirective,
  tableToCsv,
} from '../index';
import { useScenario } from './harness';

type Order = { id: number; customer: string; placed: Date; total: number; note: string };

const ORDERS: Order[] = [
  { id: 1, customer: 'Zoë Park', placed: new Date('2026-01-05T10:00:00Z'), total: 12.5, note: '=SUM(A1)' },
  { id: 2, customer: 'Lee, Sam', placed: new Date('2026-02-11T08:30:00Z'), total: -3, note: 'said "hi"' },
];

const COLUMNS = {
  id: { header: 'ID', value: (order: Order) => order.id, sortable: true },
  customer: { header: 'Customer', value: (order: Order) => order.customer, sortable: true },
  placed: { header: 'Placed', value: (order: Order) => order.placed, exportValue: (order: Order) => order.placed },
  total: {
    header: 'Total',
    value: (order: Order) => order.total.toFixed(2),
    exportValue: (order: Order) => order.total,
  },
  note: { header: 'Note', value: (order: Order) => order.note, hidden: true },
} satisfies TableColumns<Order>;

class MemoryStorage {
  entries = new Map<string, string>();
  getItem = (key: string) => this.entries.get(key) ?? null;
  setItem = (key: string, value: string) => void this.entries.set(key, value);
  removeItem = (key: string) => void this.entries.delete(key);
}

@Component({
  selector: 'et-scenario-persisted-orders',
  imports: [TABLE_IMPORTS, TABLE_STATE_PERSISTENCE_IMPORTS],
  template: ` <et-table [data]="orders" [columns]="columns" [etTableStatePersistence]="config()" /> `,
})
class PersistedOrdersComponent {
  columns = COLUMNS;
  orders = ORDERS;
  config = signal<TableStatePersistenceConfig>({ key: 'orders' });
  table = viewChild.required(TableComponent<Order>);
  persistence = viewChild.required(TableStatePersistenceDirective);
}

@Component({
  selector: 'et-scenario-exported-orders',
  imports: [TABLE_IMPORTS, TABLE_CSV_EXPORT_IMPORTS],
  template: `
    <et-table
      #csv="etTableCsvExport"
      [data]="orders"
      [rowsSource]="source()"
      [columns]="columns"
      [etTableCsvExport]="{ filename: 'orders' }"
    />
    <button (click)="csv.export()" class="export" type="button">Export</button>
  `,
})
class ExportedOrdersComponent {
  columns = COLUMNS;
  orders = ORDERS;
  source = signal<TableRowsSource<Order> | undefined>(undefined);
  table = viewChild.required(TableComponent<Order>);
  csv = viewChild.required(TableCsvExportDirective<Order>);
  download = injectTableCsvExport();
}

const query = (host: HTMLElement, selector: string) => {
  const element = host.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const captureDownloads = () => {
  const files: { name: string; blob: Blob }[] = [];
  let pending: Blob | null = null;

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    if (!(blob instanceof Blob)) throw new Error('expected a Blob');

    pending = blob;

    return 'blob:scenario';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (pending) files.push({ name: this.download, blob: pending });

    pending = null;
  });

  return files;
};

const bytes = async (blob: Blob | undefined) => {
  if (!blob) throw new Error('nothing was downloaded');

  return [...new Uint8Array(await blob.arrayBuffer())];
};

const text = async (blob: Blob | undefined) => new TextDecoder().decode(new Uint8Array(await bytes(blob)));

describe('table state persistence scenarios', () => {
  const scenario = useScenario();

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores a stored setup after the first render and saves every change back', () => {
    const s = scenario();
    const storage = new MemoryStorage();
    const stored: TableState = {
      v: 3,
      columns: [
        { key: 'customer', hidden: false, sort: 'desc' },
        { key: 'id', hidden: true },
        { key: 'placed', hidden: false, width: 180 },
        { key: 'total', hidden: false },
        { key: 'note', hidden: false },
      ],
    };

    storage.setItem('orders', serializeTableState(stored));

    const fixture = TestBed.createComponent(PersistedOrdersComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.config.set({ key: 'orders', storage });
    s.flush();

    const table = fixture.componentInstance.table();

    expect(
      [...host.querySelectorAll('.et-table-header-cell[data-col-key]')].map((cell) =>
        cell.getAttribute('data-col-key'),
      ),
    ).toEqual(['customer', 'placed', 'total', 'note']);
    expect(table.sort()).toEqual([{ key: 'customer', direction: 'desc' }]);
    expect(table.columnWidths()).toEqual({ placed: 180 });
    expect(storage.getItem('orders')).toBe(serializeTableState(stored));

    query(host, '.et-table-header-cell[data-col-key="customer"] button').click();
    s.tick();

    expect(deserializeTableState(storage.getItem('orders'))?.columns[0]).toEqual({ key: 'customer', hidden: false });

    fixture.componentInstance.persistence().clear();
    expect(storage.getItem('orders')).toBeNull();
  });

  it('writes to localStorage or sessionStorage and stops while disabled', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PersistedOrdersComponent);
    const host = fixture.nativeElement as HTMLElement;
    const persisted = fixture.componentInstance;

    s.flush();

    const sortById = () => {
      query(host, '.et-table-header-cell[data-col-key="id"] button').click();
      s.tick();
    };

    sortById();
    expect(deserializeTableState(localStorage.getItem('orders'))?.columns[0]?.sort).toBe('asc');
    expect(
      persisted
        .persistence()
        .storage()
        .load()
        ?.columns.find((column) => column.key === 'note')?.hidden,
    ).toBe(true);

    persisted.config.set({ key: 'orders', kind: 'session' });
    sortById();
    expect(deserializeTableState(sessionStorage.getItem('orders'))?.columns[0]?.sort).toBe('desc');

    persisted.config.set({ key: 'orders', kind: 'session', enabled: false });
    sortById();
    expect(deserializeTableState(sessionStorage.getItem('orders'))?.columns[0]?.sort).toBe('desc');
  });

  it('skips the restore while disabled and ignores a stored value it cannot read', () => {
    const s = scenario();

    localStorage.setItem('orders', '{"v":9,"columns":[]}');

    const fixture = TestBed.createComponent(PersistedOrdersComponent);

    s.flush();
    expect(
      fixture.componentInstance
        .table()
        .state()
        .columns.map((column) => column.key),
    ).toEqual(['id', 'customer', 'placed', 'total', 'note']);

    const second = createTableStateStorage({ key: 'orders' });

    second.save({ v: 3, columns: [{ key: 'total', hidden: false, sort: 'asc' }] });

    const disabled = TestBed.createComponent(PersistedOrdersComponent);

    disabled.componentInstance.config.set({ key: 'orders', enabled: false });
    s.flush();
    expect(disabled.componentInstance.table().sort()).toEqual([]);
  });

  it('round-trips a state through storage and reconciles it against changed columns', () => {
    const storage = new MemoryStorage();
    const store = createTableStateStorage({ key: 'k', storage });
    const state: TableState = { v: 3, columns: [{ key: 'a', hidden: true, width: 90 }], features: { note: 'x' } };

    store.save(state);
    expect(store.load()).toEqual(state);
    store.clear();
    expect(store.load()).toBeNull();

    const throwing = createTableStateStorage({
      key: 'k',
      storage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('quota');
        },
        removeItem: () => undefined,
      },
    });

    expect(() => throwing.save(state)).not.toThrow();
    expect(throwing.load()).toBeNull();
    expect(createTableStateStorage({ key: 'k', storage: null }).load()).toBeNull();

    expect(deserializeTableState('not json')).toBeNull();
    expect(deserializeTableState(null)).toBeNull();
    expect(isRestorableTableState({ v: 1, columns: [{ key: 'a', hidden: false }] })).toBe(true);
    expect(isRestorableTableState({ v: 3, columns: [{ hidden: false }] })).toBe(false);

    expect(reconcileColumnOrder(['a', 'b', 'c', 'd'], ['c', 'x', 'a'])).toEqual(['c', 'd', 'a', 'b']);
    expect(reconcileColumnOrder(['b', 'a'], ['a'])).toEqual(['b', 'a']);
    expect(reconcileColumnOrder(['a'], undefined)).toEqual(['a']);
    expect(
      reconcileHiddenColumns([{ key: 'a' }, { key: 'b', hidden: true }, { key: 'c', hidden: true }], {
        columns: [{ key: 'a' }, { key: 'b' }],
        hidden: new Set(['a']),
      }),
    ).toEqual(new Set(['a', 'c']));
    expect(reconcileHiddenColumns([{ key: 'a', hidden: true }], undefined)).toEqual(new Set(['a']));
    expect(reconcileColumnWidths([{ key: 'a' }], { a: 120, gone: 80 })).toEqual({ a: 120 });
    expect(reconcileColumnWidths([{ key: 'a' }], undefined)).toEqual({});
  });
});

describe('table csv export scenarios', () => {
  const scenario = useScenario();

  it('downloads the visible columns from a button with a guarded, quoted and BOM-prefixed file', async () => {
    const s = scenario();
    const files = captureDownloads();
    const fixture = TestBed.createComponent(ExportedOrdersComponent);

    s.flush();

    const exporter = fixture.componentInstance.csv();

    expect(exporter.exporting()).toBe(false);
    query(fixture.nativeElement as HTMLElement, '.export').click();

    expect(files.map((file) => file.name)).toEqual(['orders.csv']);
    expect(files[0]?.blob.type).toBe('text/csv;charset=utf-8');
    expect((await bytes(files[0]?.blob)).slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    expect((await text(files[0]?.blob)).replace('﻿', '')).toBe(
      [
        'ID,Customer,Placed,Total',
        '1,Zoë Park,2026-01-05T10:00:00.000Z,12.5',
        '2,"Lee, Sam",2026-02-11T08:30:00.000Z,-3',
      ].join('\r\n'),
    );
    expect(exporter.exporting()).toBe(false);

    await expect(firstValueFrom(exporter.toCsv({ columns: ['id', 'note'], delimiter: ';' }))).resolves.toBe(
      ['ID;Note', "1;'=SUM(A1)", '2;"said ""hi"""'].join('\r\n'),
    );
    await expect(
      firstValueFrom(exporter.toCsv({ columns: 'all', header: false, formulaGuard: false })),
    ).resolves.toContain(',=SUM(A1)');
  });

  it('exports every page of a server-backed table and refuses a silent partial export', async () => {
    const s = scenario();
    const files = captureDownloads();
    const fixture = TestBed.createComponent(ExportedOrdersComponent);
    const pages: number[] = [];

    fixture.componentInstance.source.set({ rows: signal(ORDERS.slice(0, 1)), total: signal(2) });
    s.flush();

    const exported = fixture.componentInstance;
    const table = exported.table();
    let failure: unknown = null;

    exported.download(table, { bom: false }).subscribe({ error: (error: unknown) => (failure = error) });
    expect(String(failure)).toContain(`ET${TABLE_ERROR_CODES.PARTIAL_EXPORT}`);
    expect(files).toHaveLength(0);

    const allPages = tableCsvRowsFromPages<Order>({
      fetchPage: (page) => {
        pages.push(page);

        return of(ORDERS.slice(page - 1, page));
      },
    });

    await firstValueFrom(exported.download(table, { rows: allPages, columns: ['id'], filename: 'all' }), {
      defaultValue: undefined,
    });
    expect(pages).toEqual([1, 2, 3]);
    expect(files[0]?.name).toBe('all.csv');
    expect(await text(files[0]?.blob)).toBe('ID\r\n1\r\n2');

    await firstValueFrom(exported.download(table, { partial: true, columns: ['id'] }), { defaultValue: undefined });
    expect(await text(files[1]?.blob)).toBe('ID\r\n1');

    const capped = tableCsvRowsFromPages<Order>({
      fetchPage: () => Promise.resolve(ORDERS),
      hasMore: (rows, page) => page < 5,
      initialPage: 0,
      maxPages: 2,
    });

    await expect(firstValueFrom(resolveTableCsvRows(capped, () => []))).resolves.toHaveLength(4);
  });

  it('saves a server-built file as is and rejects build options next to it', async () => {
    const s = scenario();
    const files = captureDownloads();
    const fixture = TestBed.createComponent(ExportedOrdersComponent);

    s.flush();

    const exported = fixture.componentInstance;

    await firstValueFrom(exported.download(exported.table(), { file: of('server,built'), filename: 'report.CSV' }), {
      defaultValue: undefined,
    });
    expect(files[0]?.name).toBe('report.CSV');
    expect(await text(files[0]?.blob)).toBe('server,built');

    expect(() => exported.download(exported.table(), { file: of('x'), delimiter: ';' })).toThrow(
      `ET${TABLE_ERROR_CODES.CONFLICTING_EXPORT_OPTIONS}`,
    );

    expect(mergeTableCsvExportOptions<Order>({ delimiter: ';', filename: 'a' }, { file: of('x') })).toEqual({
      filename: 'a',
      file: expect.anything(),
    });
    expect(mergeTableCsvExportOptions<Order>({ file: of('x'), filename: 'a' }, { columns: 'all' })).toEqual({
      filename: 'a',
      columns: 'all',
    });
    expect(mergeTableCsvExportOptions<Order>({ delimiter: ';' }, { filename: 'b' })).toEqual({
      delimiter: ';',
      filename: 'b',
    });

    expect(() => tableToCsv(exported.table(), { columns: ['missing'] })).toThrow(
      `ET${TABLE_ERROR_CODES.UNKNOWN_EXPORT_COLUMN}`,
    );
    expect(
      tableToCsv(
        { rows: () => [], visibleColumns: () => [], allColumns: () => [{ key: 'bare', value: () => null }] },
        { columns: 'all', rows: [{}] },
      ),
    ).toBe('bare\r\n');
    await expect(
      firstValueFrom(
        resolveTableCsvRows(
          () => Promise.resolve([1, 2]),
          () => [],
        ),
      ),
    ).resolves.toEqual([1, 2]);
  });
});
