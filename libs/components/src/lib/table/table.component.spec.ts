import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuntimeError } from '@ethlete/core';
import '../../test-helpers';
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

  describe('columns (reorder + visibility)', () => {
    const threeColumns = () =>
      tableColumns<Person>([
        { key: 'id', header: 'ID', value: (p) => p.id },
        { key: 'name', header: 'Name', value: (p) => p.name },
        { key: 'role', header: 'Role', value: (p) => p.role },
      ]);

    it('moveColumn reorders the visible columns and the state', () => {
      const { componentInstance: table } = create(threeColumns(), UNSORTED);

      table.moveColumn('role', 0);

      expect(table.visibleColumns().map((c) => c.key)).toEqual(['role', 'id', 'name']);
      expect(table.state().columns.map((c) => c.key)).toEqual(['role', 'id', 'name']);
    });

    it('setColumnVisible / toggleColumnVisibility hide and show a column', () => {
      const { componentInstance: table } = create(threeColumns(), UNSORTED);

      expect(table.isColumnVisible('role')).toBe(true);

      table.setColumnVisible('role', false);
      expect(table.isColumnVisible('role')).toBe(false);
      expect(table.visibleColumns().map((c) => c.key)).toEqual(['id', 'name']);
      // hidden columns are still in the serialized state
      expect(table.state().columns.find((c) => c.key === 'role')?.hidden).toBe(true);

      table.toggleColumnVisibility('role');
      expect(table.isColumnVisible('role')).toBe(true);
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

  describe('state export/restore', () => {
    const stateColumns = () =>
      tableColumns<Person>([
        { key: 'id', header: 'ID', value: (p) => p.id, sortable: true },
        { key: 'name', header: 'Name', value: (p) => p.name, sortable: true },
        { key: 'role', header: 'Role', value: (p) => p.role, filterable: true },
      ]);

    it('captures sort direction and filter values per column', () => {
      const { componentInstance: table } = create(stateColumns(), UNSORTED);

      table.toggleSort('name'); // asc
      table.setFilterValues('role', ['Viewer']);

      const state = table.state();

      expect(state.columns.find((c) => c.key === 'name')?.sort).toBe('asc');
      expect(state.columns.find((c) => c.key === 'role')?.filterValues).toEqual(['Viewer']);
      // single sort carries no priority index
      expect(state.columns.find((c) => c.key === 'name')?.sortPriority).toBeUndefined();
    });

    it('round-trips a multi-sort through state()/restoreState() preserving priority', () => {
      const fixture = create(stateColumns(), UNSORTED);
      fixture.componentRef.setInput('multiSort', true);
      fixture.detectChanges();
      const table = fixture.componentInstance;

      table.toggleSort('role');
      table.toggleSort('name');
      table.toggleSort('id');
      const snapshot = table.state();

      // priority is recorded in click order
      expect(snapshot.columns.find((c) => c.key === 'role')?.sortPriority).toBe(0);
      expect(snapshot.columns.find((c) => c.key === 'id')?.sortPriority).toBe(2);

      table.sort.set([]);
      expect(table.sort()).toEqual([]);

      table.restoreState(snapshot);
      expect(table.sort()).toEqual([
        { key: 'role', direction: 'asc' },
        { key: 'name', direction: 'asc' },
        { key: 'id', direction: 'asc' },
      ]);
    });

    it('round-trips filters', () => {
      const { componentInstance: table } = create(stateColumns(), UNSORTED);

      table.setFilterValues('role', ['Admin', 'Editor']);
      const snapshot = table.state();

      table.setFilterValues('role', []);
      expect(table.filters()).toEqual([]);

      table.restoreState(snapshot);
      expect(table.filters()).toEqual([{ key: 'role', values: ['Admin', 'Editor'] }]);
    });

    it('serializes and round-trips expanded rows when a rowKey is set', () => {
      const fixture = create(stateColumns(), UNSORTED);
      fixture.componentRef.setInput('rowKey', (row: Person) => row.id); // numeric key
      fixture.detectChanges();
      const table = fixture.componentInstance;

      table.toggleExpanded(UNSORTED[0]!);
      const snapshot = table.state();

      // serialized as the string form of the numeric rowKey
      expect(snapshot.expanded).toEqual([String(UNSORTED[0]!.id)]);

      table.expandedKeys.set(new Set());
      expect(table.isExpanded(UNSORTED[0]!)).toBe(false);

      table.restoreState(snapshot);
      expect(table.isExpanded(UNSORTED[0]!)).toBe(true);
    });

    it('omits expanded from state when no rowKey is set', () => {
      const { componentInstance: table } = create(stateColumns(), UNSORTED);

      table.toggleExpanded(UNSORTED[0]!);

      expect(table.state().expanded).toBeUndefined();
    });
  });

  describe('grouped headers', () => {
    const groupedColumns = () =>
      tableColumns<Person>([
        { key: 'a', header: 'A', value: (p) => p.name, group: 'Season' },
        { key: 'b', header: 'B', value: (p) => p.role, group: 'Season' },
        { key: 'c', header: 'C', value: (p) => p.id },
      ]);

    it('reports no groups and one run per column when none declare a group', () => {
      const { componentInstance: table } = create(columns());

      expect(table.hasGroups()).toBe(false);
      expect(table.headerGroups()).toEqual([
        { key: 'name', label: null, span: 1 },
        { key: 'role', label: null, span: 1 },
      ]);
    });

    it('merges adjacent same-group columns into one spanning run', () => {
      const { componentInstance: table } = create(groupedColumns());

      expect(table.hasGroups()).toBe(true);
      expect(table.headerGroups()).toEqual([
        { key: 'a', label: 'Season', span: 2 },
        { key: 'c', label: null, span: 1 },
      ]);
    });

    it('splits a group when reordering breaks its contiguity', () => {
      const { componentInstance: table } = create(groupedColumns());

      table.moveColumn('c', 1); // a, c, b

      expect(table.visibleColumns().map((col) => col.key)).toEqual(['a', 'c', 'b']);
      expect(table.headerGroups()).toEqual([
        { key: 'a', label: 'Season', span: 1 },
        { key: 'c', label: null, span: 1 },
        { key: 'b', label: 'Season', span: 1 },
      ]);
    });
  });

  describe('appearance & density', () => {
    it('defaults to the enclosed appearance and comfortable density on the host', () => {
      const { nativeElement } = create(columns());

      expect(nativeElement.getAttribute('data-appearance')).toBe('enclosed');
      expect(nativeElement.getAttribute('data-density')).toBe('comfortable');
    });

    it('reflects the appearance and density inputs to host attributes', () => {
      const fixture = create(columns());
      fixture.componentRef.setInput('appearance', 'zebra');
      fixture.componentRef.setInput('density', 'compact');
      fixture.detectChanges();

      expect(fixture.nativeElement.getAttribute('data-appearance')).toBe('zebra');
      expect(fixture.nativeElement.getAttribute('data-density')).toBe('compact');
    });

    it('marks odd-indexed rows with the stripe class (zebra styles it)', () => {
      const fixture = create(columns(), UNSORTED); // 3 rows
      const rows = [...fixture.nativeElement.querySelectorAll('.et-table-row')] as HTMLElement[];

      expect(rows[0]!.classList.contains('et-table-row--stripe')).toBe(false);
      expect(rows[1]!.classList.contains('et-table-row--stripe')).toBe(true);
      expect(rows[2]!.classList.contains('et-table-row--stripe')).toBe(false);
    });
  });

  describe('virtualization', () => {
    const many: Person[] = Array.from({ length: 100 }, (_, index) => ({
      id: index,
      name: `Person ${index}`,
      role: 'Viewer',
    }));

    // jsdom has no layout — back the geometry the virtual window reads with plain values.
    const mockScrollGeometry = (host: HTMLElement, viewportHeight: number) => {
      let scrollTop = 0;

      Object.defineProperty(host, 'clientHeight', { value: viewportHeight, configurable: true });
      Object.defineProperty(host, 'scrollTop', {
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = Math.max(0, value);
        },
        configurable: true,
      });
    };

    it('renders every row and keeps a zero index offset while virtual scroll is off', () => {
      const { componentInstance: table } = create(columns(), many);

      expect(table.renderedRows()).toHaveLength(100);
      expect(table.rowIndexOffset()).toBe(0);
    });

    it('renders only a window of rows when virtual scroll is on', () => {
      const fixture = create(columns(), many);
      mockScrollGeometry(fixture.nativeElement, 240);

      fixture.componentRef.setInput('virtualScroll', true);
      fixture.componentRef.setInput('estimateRowHeight', 40);
      fixture.componentRef.setInput('overscan', 2);
      fixture.detectChanges();

      const table = fixture.componentInstance;

      // 240px viewport / 40px rows = 6 visible + 2 overscan below, starting at the top
      expect(table.renderedRows().length).toBe(8);
      expect(table.rowIndexOffset()).toBe(0);
      expect(table.virtualWindow.paddingTop()).toBe(0);
      expect(table.virtualWindow.paddingBottom()).toBe((100 - 8) * 40);
    });

    it('shifts the window and the index offset as the container scrolls', () => {
      const fixture = create(columns(), many);
      const host: HTMLElement = fixture.nativeElement;
      mockScrollGeometry(host, 240);

      fixture.componentRef.setInput('virtualScroll', true);
      fixture.componentRef.setInput('estimateRowHeight', 40);
      fixture.componentRef.setInput('overscan', 2);
      fixture.detectChanges();

      host.scrollTop = 400;
      host.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      const table = fixture.componentInstance;
      const { start } = table.virtualWindow.range();

      expect(start).toBeGreaterThan(0);
      expect(table.rowIndexOffset()).toBe(start);
      // the rendered slice lines up with the window over the source rows
      expect(table.renderedRows()[0]).toBe(many[start]);
    });
  });
});
