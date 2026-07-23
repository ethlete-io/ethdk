import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuntimeError } from '@ethlete/core';
import { tableColumns } from './table-columns';
import { TABLE_ERROR_CODES } from './table-errors';
import { filterRows } from './table-filter';
import { sortRows } from './table-sort';
import { TableComponent } from './table.component';
import { AnyTableColumn } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Alan', role: 'Viewer' },
];

const UNSORTED: Person[] = [
  { id: 3, name: 'Charlie', role: 'Viewer' },
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Bob', role: 'Editor' },
];

const columns = (roleHidden = false) =>
  tableColumns<Person>([
    { key: 'name', header: 'Name', value: (person) => person.name, width: '200px' },
    { key: 'role', header: 'Role', value: (person) => person.role, hidden: roleHidden },
  ]);

const create = (cols: AnyTableColumn<Person>[], data: Person[] = PEOPLE): ComponentFixture<TableComponent<Person>> => {
  const fixture = TestBed.createComponent<TableComponent<Person>>(TableComponent);
  fixture.componentRef.setInput('columns', cols);
  fixture.componentRef.setInput('data', data);
  fixture.detectChanges();

  return fixture;
};

describe('TableComponent', () => {
  it('exposes the columns in declared order', () => {
    const { componentInstance: table } = create(columns());

    expect(table.visibleColumns().map((c) => c.key)).toEqual(['name', 'role']);
  });

  it('builds grid-template-columns from column widths, defaulting the rest', () => {
    const { componentInstance: table } = create(columns());

    expect(table.templateColumns()).toBe('200px minmax(0, 1fr)');
  });

  it('excludes hidden columns from the visible set and the track template', () => {
    const { componentInstance: table } = create(columns(true));

    expect(table.visibleColumns().map((c) => c.key)).toEqual(['name']);
    expect(table.templateColumns()).toBe('200px');
  });

  it('captures a versioned state snapshot of order + visibility', () => {
    const { componentInstance: table } = create(columns(true));

    expect(table.state()).toEqual({
      v: 1,
      columns: [
        { key: 'name', hidden: false },
        { key: 'role', hidden: true },
      ],
    });
  });

  it('restores column order and visibility', () => {
    const { componentInstance: table } = create(columns());

    table.restoreState({
      v: 1,
      columns: [
        { key: 'role', hidden: false },
        { key: 'name', hidden: true },
      ],
    });

    expect(table.visibleColumns().map((c) => c.key)).toEqual(['role']);
  });

  it('throws ET3500 on duplicate column keys in dev mode', () => {
    const dupes = tableColumns<Person>([
      { key: 'name', value: (p) => p.name },
      { key: 'name', value: (p) => p.role },
    ]);

    const fixture = TestBed.createComponent<TableComponent<Person>>(TableComponent);
    fixture.componentRef.setInput('columns', dupes);

    let error: unknown;
    try {
      fixture.detectChanges();
      fixture.componentInstance.visibleColumns();
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(RuntimeError);
    expect((error as RuntimeError<number>).code).toBe(TABLE_ERROR_CODES.DUPLICATE_COLUMN_KEY);
  });

  describe('sorting', () => {
    const sortableColumns = () =>
      tableColumns<Person>([
        { key: 'name', header: 'Name', value: (person) => person.name, sortable: true },
        { key: 'role', header: 'Role', value: (person) => person.role, sortable: true },
      ]);

    it('sortRows sorts ascending and descending by a column key', () => {
      const cols = sortableColumns();

      expect(
        sortRows({ rows: UNSORTED, sort: [{ key: 'name', direction: 'asc' }], columns: cols }).map((r) => r.name),
      ).toEqual(['Ada', 'Bob', 'Charlie']);
      expect(
        sortRows({ rows: UNSORTED, sort: [{ key: 'name', direction: 'desc' }], columns: cols }).map((r) => r.name),
      ).toEqual(['Charlie', 'Bob', 'Ada']);
    });

    it('sortRows sinks nullish values to the bottom regardless of direction', () => {
      const rows = [{ v: 2 }, { v: null }, { v: 1 }] as { v: number | null }[];
      const cols = tableColumns<{ v: number | null }>([{ key: 'v', value: (r) => r.v }]);

      expect(sortRows({ rows, sort: [{ key: 'v', direction: 'asc' }], columns: cols }).map((r) => r.v)).toEqual([
        1,
        2,
        null,
      ]);
      expect(sortRows({ rows, sort: [{ key: 'v', direction: 'desc' }], columns: cols }).map((r) => r.v)).toEqual([
        2,
        1,
        null,
      ]);
    });

    it('client sort mode reorders the rendered rows when a header is toggled', () => {
      const { componentInstance: table } = create(sortableColumns(), UNSORTED);

      expect(table.rows().map((r) => r.name)).toEqual(['Charlie', 'Ada', 'Bob']);

      table.toggleSort('name');
      expect(table.rows().map((r) => r.name)).toEqual(['Ada', 'Bob', 'Charlie']);
    });

    it('toggleSort cycles a column asc → desc → off (single-sort replaces others)', () => {
      const { componentInstance: table } = create(sortableColumns(), UNSORTED);

      table.toggleSort('name');
      expect(table.sort()).toEqual([{ key: 'name', direction: 'asc' }]);
      table.toggleSort('name');
      expect(table.sort()).toEqual([{ key: 'name', direction: 'desc' }]);
      table.toggleSort('name');
      expect(table.sort()).toEqual([]);

      // single-sort: sorting another column replaces the first
      table.toggleSort('name');
      table.toggleSort('role');
      expect(table.sort()).toEqual([{ key: 'role', direction: 'asc' }]);
    });

    it('multiSort accumulates sorts across columns', () => {
      const fixture = create(sortableColumns(), UNSORTED);
      fixture.componentRef.setInput('multiSort', true);
      fixture.detectChanges();

      fixture.componentInstance.toggleSort('role');
      fixture.componentInstance.toggleSort('name');
      expect(fixture.componentInstance.sort()).toEqual([
        { key: 'role', direction: 'asc' },
        { key: 'name', direction: 'asc' },
      ]);
    });

    it('server sort mode leaves the row order untouched', () => {
      const fixture = create(sortableColumns(), UNSORTED);
      fixture.componentRef.setInput('sortMode', 'server');
      fixture.detectChanges();

      fixture.componentInstance.toggleSort('name');
      expect(fixture.componentInstance.rows().map((r) => r.name)).toEqual(['Charlie', 'Ada', 'Bob']);
    });
  });

  describe('filtering', () => {
    const filterableColumns = () =>
      tableColumns<Person>([
        { key: 'name', header: 'Name', value: (person) => person.name },
        {
          key: 'role',
          header: 'Role',
          value: (person) => person.role,
          filterable: true,
          filterOptions: [
            { label: 'Admin', value: 'Admin' },
            { label: 'Editor', value: 'Editor' },
            { label: 'Viewer', value: 'Viewer' },
          ],
        },
      ]);

    it('filterRows keeps only rows whose value is in the selected set', () => {
      const cols = filterableColumns();

      expect(filterRows({ rows: UNSORTED, filters: [{ key: 'role', values: ['Admin'] }], columns: cols })).toEqual([
        { id: 1, name: 'Ada', role: 'Admin' },
      ]);
      expect(
        filterRows({ rows: UNSORTED, filters: [{ key: 'role', values: ['Admin', 'Editor'] }], columns: cols }).map(
          (r) => r.name,
        ),
      ).toEqual(['Ada', 'Bob']);
    });

    it('an empty filter list passes all rows through', () => {
      const cols = filterableColumns();

      expect(filterRows({ rows: UNSORTED, filters: [], columns: cols })).toHaveLength(UNSORTED.length);
    });

    it('client filter mode narrows the rendered rows and setFilterValues drives it', () => {
      const { componentInstance: table } = create(filterableColumns(), UNSORTED);

      expect(table.rows()).toHaveLength(3);

      table.setFilterValues('role', ['Viewer']);
      expect(table.rows().map((r) => r.name)).toEqual(['Charlie']);
      expect(table.filterValuesFor('role')).toEqual(['Viewer']);

      table.setFilterValues('role', []);
      expect(table.rows()).toHaveLength(3);
    });

    it('server filter mode leaves the rows untouched', () => {
      const fixture = create(filterableColumns(), UNSORTED);
      fixture.componentRef.setInput('filterMode', 'server');
      fixture.detectChanges();

      fixture.componentInstance.setFilterValues('role', ['Viewer']);
      expect(fixture.componentInstance.rows()).toHaveLength(3);
    });

    // filterOptionsFor / search / provider are protected template helpers — reach them via a cast.
    type FilterHelpers = {
      filterOptionsFor: (column: AnyTableColumn<Person>) => { label: string; value: unknown }[];
      setFilterSearchQuery: (column: AnyTableColumn<Person>, query: string) => void;
      filterLoading: (column: AnyTableColumn<Person>) => boolean;
    };
    const helpersOf = (table: TableComponent<Person>) => table as unknown as FilterHelpers;

    it('narrows a static option list by the in-menu search text', () => {
      const cols = tableColumns<Person>([
        {
          key: 'role',
          value: (p) => p.role,
          filterable: true,
          filterSearch: true,
          filterOptions: [
            { label: 'Admin', value: 'Admin' },
            { label: 'Editor', value: 'Editor' },
            { label: 'Viewer', value: 'Viewer' },
          ],
        },
      ]);
      const table = helpersOf(create(cols, UNSORTED).componentInstance);
      const column = cols[0];

      expect(table.filterOptionsFor(column).map((o) => o.label)).toEqual(['Admin', 'Editor', 'Viewer']);

      table.setFilterSearchQuery(column, 'ed');
      expect(table.filterOptionsFor(column).map((o) => o.label)).toEqual(['Editor']);
    });

    it('reads options and loading from an async provider (and forwards search to setQuery)', () => {
      const query = signal('');
      const setQuery = vi.fn((next: string) => query.set(next));
      const cols = tableColumns<Person>([
        {
          key: 'role',
          value: (p) => p.role,
          filterable: true,
          filterOptions: {
            options: computed(() => (query() ? [{ label: 'Match', value: 'm' }] : [])),
            loading: signal(true),
            setQuery,
          },
        },
      ]);
      const table = helpersOf(create(cols, UNSORTED).componentInstance);
      const column = cols[0];

      expect(table.filterOptionsFor(column)).toEqual([]);
      expect(table.filterLoading(column)).toBe(true);

      table.setFilterSearchQuery(column, 'x');
      expect(setQuery).toHaveBeenCalledWith('x');
      expect(table.filterOptionsFor(column)).toEqual([{ label: 'Match', value: 'm' }]);
    });
  });

  describe('row expansion', () => {
    it('toggles a row and tracks it in expandedKeys', () => {
      const { componentInstance: table } = create(columns(), UNSORTED);
      const row = UNSORTED[0]!;

      expect(table.isExpanded(row)).toBe(false);

      table.toggleExpanded(row);
      expect(table.isExpanded(row)).toBe(true);
      expect(table.expandedKeys().size).toBe(1);

      table.toggleExpanded(row);
      expect(table.isExpanded(row)).toBe(false);
    });

    it('keys expansion by rowKey so equal-keyed rows share state', () => {
      const fixture = create(columns(), UNSORTED);
      fixture.componentRef.setInput('rowKey', (row: Person) => row.id);
      fixture.detectChanges();
      const table = fixture.componentInstance;

      table.toggleExpanded({ id: 1, name: 'Ada', role: 'Admin' });

      expect(table.isExpanded({ id: 1, name: 'renamed', role: 'Viewer' })).toBe(true);
      expect(table.isExpanded({ id: 2, name: 'Bob', role: 'Editor' })).toBe(false);
    });
  });
});
