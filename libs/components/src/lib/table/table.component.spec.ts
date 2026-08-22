import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { injectLocale, RuntimeError } from '@ethlete/core';
import '../../test-helpers';
import { TABLE_ERROR_CODES } from './table-errors';
import { filterRows } from './headless/table-filter';
import { sortRows } from './headless/table-sort';
import { TableComponent } from './table.component';
import { DEFAULT_TABLE_LABELS, provideTableLabels } from './headless/table-labels';
import {
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_IMPORTS,
  TABLE_ROW_ROUTER_LINK_IMPORTS,
  TABLE_SELECTION_IMPORTS,
} from './table.imports';
import { TableColumns, TableFilter, TableSort, TableState } from './table.types';

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
  ({
    name: { header: 'Name', value: (person) => person.name, width: '200px' },
    role: { header: 'Role', value: (person) => person.role, hidden: roleHidden },
  }) satisfies TableColumns<Person>;

const create = (cols: TableColumns<Person>, data: Person[] = PEOPLE): ComponentFixture<TableComponent<Person>> => {
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

    expect(table.templateColumns()).toBe('200px minmax(96px, 1fr)');
  });

  it('excludes hidden columns from the visible set and the track template', () => {
    const { componentInstance: table } = create(columns(true));

    expect(table.visibleColumns().map((c) => c.key)).toEqual(['name']);
    // The only remaining column is a rigid width, so a trailing slack track carries the table's chrome
    // to the panel's edge - see `hasFiller`. Slack, so its floor is 0, unlike a real column's.
    expect(table.templateColumns()).toBe('200px minmax(0, 1fr)');
  });

  it('adds a trailing slack track only when every column is a rigid width', () => {
    const rigid = create({
      name: { header: 'Name', value: (person) => person.name, width: '200px' },
      role: { header: 'Role', value: (person) => person.role, width: '120px' },
    } satisfies TableColumns<Person>);

    expect(rigid.componentInstance.templateColumns()).toBe('200px 120px minmax(0, 1fr)');

    // One `auto` track is enough to soak up the leftover room on its own, so no slack track is added.
    const stretchy = create({
      name: { header: 'Name', value: (person) => person.name, width: '200px' },
      role: { header: 'Role', value: (person) => person.role, width: 'auto' },
    } satisfies TableColumns<Person>);

    expect(stretchy.componentInstance.templateColumns()).toBe('200px auto');
  });

  it('gives flexible columns a minimum width, so a wide neighbour cannot squeeze them away', () => {
    const { componentInstance: table } = create(columns());

    // Every default track carries the floor; without it one resized column takes all the room and
    // its neighbours collapse to their padding.
    table.setColumnWidth('name', 5000);

    for (const track of table.templateColumns().split(' minmax')) {
      expect(track.startsWith('(0px,')).toBe(false);
    }

    expect(table.templateColumns()).toContain('minmax(96px, 1fr)');
  });

  it('honours a column-specific minWidth for both its track floor and a resize', () => {
    const { componentInstance: table } = create({
      name: { header: 'Name', value: (person) => person.name },
      role: { header: 'Role', value: (person) => person.role, minWidth: 32 },
    } satisfies TableColumns<Person>);

    expect(table.templateColumns()).toBe('minmax(96px, 1fr) minmax(32px, 1fr)');

    // A drag is clamped to the same floor, so the two can't disagree.
    table.setColumnWidth('role', 1);
    expect(table.templateColumns()).toBe('minmax(96px, 1fr) 32px');

    table.setColumnWidth('name', 1);
    expect(table.templateColumns()).toBe('96px 32px minmax(0, 1fr)');
  });

  describe('setSort', () => {
    const sortable = () =>
      ({
        name: { header: 'Name', value: (person) => person.name, sortable: true },
        role: { header: 'Role', value: (person) => person.role, sortable: true },
      }) satisfies TableColumns<Person>;

    it('sets a direction outright and clears with null, unlike toggleSort cycling', () => {
      const { componentInstance: table } = create(sortable());

      table.setSort('name', 'desc');
      expect(table.sort()).toEqual([{ key: 'name', direction: 'desc' }]);

      // Same direction again is a no-op rather than a step through the cycle.
      table.setSort('name', 'desc');
      expect(table.sort()).toEqual([{ key: 'name', direction: 'desc' }]);

      table.setSort('name', null);
      expect(table.sort()).toEqual([]);
    });

    it('replaces other sorts unless multiSort is on', () => {
      const fixture = create(sortable());
      const table = fixture.componentInstance;

      table.setSort('name', 'asc');
      table.setSort('role', 'asc');
      expect(table.sort()).toEqual([{ key: 'role', direction: 'asc' }]);

      fixture.componentRef.setInput('multiSort', true);
      fixture.detectChanges();

      table.setSort('name', 'desc');
      expect(table.sort()).toEqual([
        { key: 'role', direction: 'asc' },
        { key: 'name', direction: 'desc' },
      ]);
    });
  });

  describe('autosize', () => {
    it('lets the measured columns out to max-content, and ignores unknown keys', () => {
      const { componentInstance: table } = create(columns());

      // The measurement itself needs real layout, so it is covered in the browser; what is checkable
      // here is the transient track it measures through.
      table.autosizeColumns(['role']);
      expect(table.templateColumns()).toBe('200px max-content');

      table.autosizeColumns(['nope']);
      expect(table.templateColumns()).toBe('200px max-content');
    });

    it('is a no-op for an empty key list', () => {
      const { componentInstance: table } = create(columns());
      const before = table.templateColumns();

      table.autosizeColumns([]);
      expect(table.templateColumns()).toBe(before);
    });
  });

  it('reports whether a column carries a width override', () => {
    const { componentInstance: table } = create(columns());

    expect(table.hasColumnWidthOverride('role')).toBe(false);

    table.setColumnWidth('role', 180);
    expect(table.hasColumnWidthOverride('role')).toBe(true);

    table.resetColumnWidth('role');
    expect(table.hasColumnWidthOverride('role')).toBe(false);
  });

  describe('column visibility', () => {
    it('enumerates all columns and the hidden ones, and shows them all again', () => {
      const { componentInstance: table } = create(columns());

      expect(table.allColumns().map((c) => c.key)).toEqual(['name', 'role']);
      expect(table.hiddenColumnKeys()).toEqual([]);

      table.setColumnVisible('role', false);
      expect(table.visibleColumns().map((c) => c.key)).toEqual(['name']);
      // `allColumns` keeps the hidden one, which is what a "columns" chooser lists.
      expect(table.allColumns().map((c) => c.key)).toEqual(['name', 'role']);
      expect(table.hiddenColumnKeys()).toEqual(['role']);
      expect(table.isColumnVisible('role')).toBe(false);

      table.showAllColumns();
      expect(table.hiddenColumnKeys()).toEqual([]);
      expect(table.visibleColumns().map((c) => c.key)).toEqual(['name', 'role']);
    });

    it('lists hidden keys in declared order, not the order they were hidden in', () => {
      const { componentInstance: table } = create(columns());

      table.setColumnVisible('role', false);
      table.setColumnVisible('name', false);

      expect(table.hiddenColumnKeys()).toEqual(['name', 'role']);
    });
  });

  it('captures a versioned state snapshot of order + visibility', () => {
    const { componentInstance: table } = create(columns(true));

    expect(table.state()).toEqual({
      v: 3,
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

  // Duplicate column keys used to throw ET3500. They are unrepresentable now: a column's key is
  // the key it is declared under in the `TableColumns` record.

  describe('sorting', () => {
    const sortableColumns = () =>
      ({
        name: { header: 'Name', value: (person) => person.name, sortable: true },
        role: { header: 'Role', value: (person) => person.role, sortable: true },
      }) satisfies TableColumns<Person>;

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
      const cols = {
        v: { value: (r) => r.v },
      } satisfies TableColumns<{ v: number | null }>;

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
      ({
        name: { header: 'Name', value: (person) => person.name },
        role: {
          header: 'Role',
          value: (person) => person.role,
          filterable: true,
          filterOptions: [
            { label: 'Admin', value: 'Admin' },
            { label: 'Editor', value: 'Editor' },
            { label: 'Viewer', value: 'Viewer' },
          ],
        },
      }) satisfies TableColumns<Person>;

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

    it('renders no filter UI without the opt-in feature (the menu system stays out of the bundle)', () => {
      const fixture = create(filterableColumns(), UNSORTED);

      expect((fixture.nativeElement as HTMLElement).querySelector('.et-table-filter-trigger')).toBeNull();
    });
  });

  describe('columns (reorder + visibility)', () => {
    const threeColumns = () =>
      ({
        id: { header: 'ID', value: (p) => p.id },
        name: { header: 'Name', value: (p) => p.name },
        role: { header: 'Role', value: (p) => p.role },
      }) satisfies TableColumns<Person>;

    it('moveColumn reorders the visible columns and the state', () => {
      const { componentInstance: table } = create(threeColumns(), UNSORTED);

      table.moveColumn('role', 0);

      expect(table.visibleColumns().map((c) => c.key)).toEqual(['role', 'id', 'name']);
      expect(table.state().columns.map((c) => c.key)).toEqual(['role', 'id', 'name']);
    });

    it('keeps the user order, widths and visibility when the columns input changes identity', () => {
      const fixture = create(threeColumns(), UNSORTED);
      const table = fixture.componentInstance;

      table.moveColumn('role', 0);
      table.setColumnWidth('name', 321);
      table.setColumnVisible('id', false);

      // Same definitions, new array - what a consumer's `computed()` produces on any unrelated change.
      fixture.componentRef.setInput('columns', threeColumns());
      fixture.detectChanges();

      expect(table.state()).toEqual({
        v: 3,
        columns: [
          { key: 'role', hidden: false },
          { key: 'id', hidden: true },
          { key: 'name', hidden: false, width: 321 },
        ],
      });
    });

    it('slots a newly declared column in next to the column it was declared after', () => {
      const fixture = create(threeColumns(), UNSORTED);
      const table = fixture.componentInstance;

      table.moveColumn('role', 0); // role, id, name

      fixture.componentRef.setInput('columns', {
        id: { header: 'ID', value: (p) => p.id },
        email: { header: 'Email', value: () => '' },
        name: { header: 'Name', value: (p) => p.name },
        role: { header: 'Role', value: (p) => p.role },
      } satisfies TableColumns<Person>);
      fixture.detectChanges();

      expect(table.visibleColumns().map((c) => c.key)).toEqual(['role', 'id', 'email', 'name']);
    });

    it('drops state for columns that are no longer declared, and re-declares them fresh', () => {
      const fixture = create(threeColumns(), UNSORTED);
      const table = fixture.componentInstance;

      table.setColumnWidth('role', 200);
      table.setColumnVisible('role', false);

      const withoutRole = {
        id: { header: 'ID', value: (p) => p.id },
        name: { header: 'Name', value: (p) => p.name },
      } satisfies TableColumns<Person>;

      fixture.componentRef.setInput('columns', withoutRole);
      fixture.detectChanges();

      expect(table.state().columns).toEqual([
        { key: 'id', hidden: false },
        { key: 'name', hidden: false },
      ]);

      // Coming back is a column the table has never seen, so it takes its declaration again.
      fixture.componentRef.setInput('columns', threeColumns());
      fixture.detectChanges();

      expect(table.state().columns).toEqual([
        { key: 'id', hidden: false },
        { key: 'name', hidden: false },
        { key: 'role', hidden: false },
      ]);
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

  describe('state export/restore', () => {
    const stateColumns = () =>
      ({
        id: { header: 'ID', value: (p) => p.id, sortable: true },
        name: { header: 'Name', value: (p) => p.name, sortable: true },
        role: { header: 'Role', value: (p) => p.role, filterable: true },
      }) satisfies TableColumns<Person>;

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

    it('keeps a restore that landed before the columns input was populated', () => {
      // A consumer whose columns and stored state arrive from the same request restores first and
      // binds the columns after. Both directions have to survive that: a column the state hides and
      // one it reveals against its own declaration.
      const fixture = TestBed.createComponent<TableComponent<Person>>(TableComponent);
      fixture.componentRef.setInput('columns', {});
      fixture.componentRef.setInput('data', PEOPLE);
      fixture.detectChanges();

      fixture.componentInstance.restoreState({
        v: 3,
        columns: [
          { key: 'id', hidden: false },
          { key: 'name', hidden: true },
          { key: 'role', hidden: false },
        ],
      });

      fixture.componentRef.setInput('columns', {
        id: { header: 'ID', value: (p: Person) => p.id },
        name: { header: 'Name', value: (p: Person) => p.name },
        role: { header: 'Role', value: (p: Person) => p.role, hidden: true },
      } satisfies TableColumns<Person>);
      fixture.detectChanges();

      expect(fixture.componentInstance.visibleColumns().map((c) => c.key)).toEqual(['id', 'role']);
    });

    it('takes the declaration for a column no restored state spoke about', () => {
      const fixture = TestBed.createComponent<TableComponent<Person>>(TableComponent);
      fixture.componentRef.setInput('columns', {});
      fixture.componentRef.setInput('data', PEOPLE);
      fixture.detectChanges();

      fixture.componentInstance.restoreState({ v: 3, columns: [{ key: 'id', hidden: false }] });

      fixture.componentRef.setInput('columns', {
        id: { header: 'ID', value: (p: Person) => p.id },
        name: { header: 'Name', value: (p: Person) => p.name, hidden: true },
      } satisfies TableColumns<Person>);
      fixture.detectChanges();

      expect(fixture.componentInstance.visibleColumns().map((c) => c.key)).toEqual(['id']);
    });

    it('ignores a hand-edited state instead of throwing part-way through the restore', () => {
      const { componentInstance: table } = create(columns());

      table.restoreState({
        v: 3,
        columns: [
          { key: 'role', hidden: false },
          { key: 'name', hidden: true },
        ],
      });
      expect(table.visibleColumns().map((c) => c.key)).toEqual(['role']);

      expect(() => table.restoreState({ v: 3, columns: [null] } as unknown as TableState)).not.toThrow();
      expect(table.visibleColumns().map((c) => c.key)).toEqual(['role']);
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
  });

  describe('appearance & density', () => {
    it('defaults to the enclosed appearance and md density on the host', () => {
      const { nativeElement } = create(columns());

      expect(nativeElement.getAttribute('data-appearance')).toBe('enclosed');
      expect(nativeElement.getAttribute('data-density')).toBe('md');
    });

    it('reflects the appearance and density inputs to host attributes', () => {
      const fixture = create(columns());
      fixture.componentRef.setInput('appearance', 'zebra');
      fixture.componentRef.setInput('density', 'sm');
      fixture.detectChanges();

      expect(fixture.nativeElement.getAttribute('data-appearance')).toBe('zebra');
      expect(fixture.nativeElement.getAttribute('data-density')).toBe('sm');
    });

    it('marks odd-indexed rows with the stripe class (zebra styles it)', () => {
      const fixture = create(columns(), UNSORTED); // 3 rows
      const rows = [...fixture.nativeElement.querySelectorAll('.et-table-row')] as HTMLElement[];

      expect(rows[0]!.classList.contains('et-table-row--stripe')).toBe(false);
      expect(rows[1]!.classList.contains('et-table-row--stripe')).toBe(true);
      expect(rows[2]!.classList.contains('et-table-row--stripe')).toBe(false);
    });

    it('marks the row that ends the table (its divider would hang under it)', () => {
      const fixture = create(columns(), UNSORTED); // 3 rows
      const rows = [...fixture.nativeElement.querySelectorAll('.et-table-row')] as HTMLElement[];

      expect(rows.map((row) => row.classList.contains('et-table-row--last'))).toEqual([false, false, true]);
    });

    it('marks no row as last while a footer row follows the body', () => {
      @Component({
        template: `
          <et-table [columns]="cols" [data]="data">
            <ng-template [etTableFooterCell]="cols.name" let-rows>{{ rows.length }} people</ng-template>
          </et-table>
        `,
        imports: [TABLE_IMPORTS],
      })
      class FooterHostComponent {
        data = PEOPLE;
        cols = { name: { header: 'Name', value: (person: Person) => person.name } } satisfies TableColumns<Person>;
      }

      const fixture = TestBed.createComponent(FooterHostComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.et-table-row--last')).toBeNull();
    });
  });

  describe('sticky columns & footer', () => {
    it('pins nothing without the feature, whatever a column declares', () => {
      const cols = {
        name: { value: (p) => p.name, sticky: 'start' },
        role: { value: (p) => p.role },
      } satisfies TableColumns<Person>;
      const host = create(cols).nativeElement as HTMLElement;

      // `sticky` is inert until etTableStickyColumns supplies the pinning - no class, no inline offset,
      // on the declared column or any other.
      for (const key of ['name', 'role']) {
        const header = host.querySelector<HTMLElement>(`[data-col-key="${key}"]`);

        expect(header?.classList.contains('et-table-sticky-start')).toBe(false);
        expect(header?.classList.contains('et-table-sticky-end')).toBe(false);
        expect(header?.style.insetInlineStart).toBe('');
        expect(header?.style.insetInlineEnd).toBe('');
      }
    });

    it('hasFooter reflects a registered etTableFooterCell, and renders it', () => {
      @Component({
        template: `
          <et-table [columns]="cols" [data]="data">
            @if (withFooter()) {
              <ng-template [etTableFooterCell]="cols.name" let-rows>{{ rows.length }} people</ng-template>
            }
          </et-table>
        `,
        imports: [TABLE_IMPORTS],
      })
      class HostComponent {
        withFooter = signal(true);
        data = PEOPLE;
        cols = { name: { header: 'Name', value: (person: Person) => person.name } } satisfies TableColumns<Person>;
        table = viewChild.required<TableComponent<Person>>(TableComponent);
      }

      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;

      expect(fixture.componentInstance.table().hasFooter()).toBe(true);
      expect(host.querySelector('.et-table-footer-row')?.textContent?.trim()).toBe('2 people');

      // A template destroyed with its control-flow block unregisters itself.
      fixture.componentInstance.withFooter.set(false);
      fixture.detectChanges();

      expect(fixture.componentInstance.table().hasFooter()).toBe(false);
      expect(host.querySelector('.et-table-footer-row')).toBeNull();
    });

    it('throws when a column template is bound to a column the table does not render', () => {
      @Component({
        template: `
          <et-table [columns]="cols" [data]="data">
            <ng-template [etTableCell]="stranger.other">nope</ng-template>
          </et-table>
        `,
        imports: [TABLE_IMPORTS],
      })
      class OrphanTemplateComponent {
        data = PEOPLE;
        cols = { name: { value: (person: Person) => person.name } } satisfies TableColumns<Person>;
        stranger = { other: { value: (person: Person) => person.role } } satisfies TableColumns<Person>;
      }

      const fixture = TestBed.createComponent(OrphanTemplateComponent);

      expect(() => fixture.detectChanges()).toThrow(
        expect.objectContaining({ code: TABLE_ERROR_CODES.UNKNOWN_TEMPLATE_COLUMN }) as unknown as RuntimeError<number>,
      );
    });
  });

  describe('loading & error states', () => {
    const setStates = (fixture: ComponentFixture<TableComponent<Person>>, states: Record<string, unknown>) => {
      for (const [input, value] of Object.entries(states)) fixture.componentRef.setInput(input, value);
      fixture.detectChanges();
    };

    // past signalDeferredLoading's delay, after which the busy bar turns on
    const settleBusyBar = async (fixture: ComponentFixture<TableComponent<Person>>) => {
      await new Promise((resolve) => setTimeout(resolve, 260));
      fixture.detectChanges();
    };

    it('marks the host busy and leaves the body blank while loading with no rows', () => {
      const fixture = create(columns(), []);
      const host = fixture.nativeElement as HTMLElement;

      setStates(fixture, { loading: true });

      // What a loading body looks like belongs to etTableSkeleton; the base only refuses to show the
      // empty state, which would read as "no results" mid-request.
      expect(host.getAttribute('aria-busy')).toBe('true');
      expect(host.querySelector('.et-table-busy-bar')).toBeNull();
      expect(host.querySelector('.et-table-empty-cell')).toBeNull();
      expect(host.querySelectorAll('.et-table-row').length).toBe(0);

      setStates(fixture, { loading: false });
      expect(host.getAttribute('aria-busy')).toBeNull();
      expect(host.querySelector('.et-table-empty-cell')).not.toBeNull();
    });

    it('keeps the rows and shows the busy bar when loading over existing rows', async () => {
      const fixture = create(columns());
      const host = fixture.nativeElement as HTMLElement;

      setStates(fixture, { loading: true });

      expect(host.querySelectorAll('.et-table-row:not(.et-table-row--placeholder)').length).toBe(PEOPLE.length);
      expect(host.querySelector('.et-table-row--placeholder')).toBeNull();
      // the host is busy from the first moment; the bar waits, so a page that lands quickly leaves
      // no flicker under the header
      expect(host.getAttribute('aria-busy')).toBe('true');
      expect(host.querySelector('.et-table-busy-bar')).toBeNull();

      await settleBusyBar(fixture);

      expect(host.querySelector('.et-table-busy-bar')).not.toBeNull();
      expect(host.querySelectorAll('.et-table-row:not(.et-table-row--placeholder)').length).toBe(PEOPLE.length);
    });

    it('replaces the body with the error state for any non-nullish error, ahead of loading', () => {
      const fixture = create(columns());
      const host = fixture.nativeElement as HTMLElement;

      setStates(fixture, { error: 'boom', loading: true });

      expect(host.querySelector('.et-table-error-cell')?.textContent?.trim()).toBe('Could not load data');
      expect(host.querySelectorAll('.et-table-row').length).toBe(0);
      // An error outranks loading: no placeholder rows and no busy bar next to it.
      expect(host.querySelector('.et-table-busy-bar')).toBeNull();
      expect(host.querySelector('.et-table-row--placeholder')).toBeNull();

      setStates(fixture, { labels: { error: 'Nope' } });
      expect(host.querySelector('.et-table-error-cell')?.textContent?.trim()).toBe('Nope');

      // `false` and `0` are legitimate error payloads; only null/undefined clear the state.
      setStates(fixture, { error: false });
      expect(host.querySelector('.et-table-error-cell')).not.toBeNull();

      setStates(fixture, { error: null });
      expect(host.querySelector('.et-table-error-cell')).toBeNull();
      expect(host.querySelectorAll('.et-table-row').length).toBe(PEOPLE.length);
    });

    it('renders projected [etTableError] content instead of the default label', () => {
      @Component({
        template: `
          <et-table [columns]="cols" [data]="data" error="boom">
            <div etTableError><button class="retry" type="button">Retry</button></div>
          </et-table>
        `,
        imports: [TABLE_IMPORTS],
      })
      class HostComponent {
        data = PEOPLE;
        cols = columns();
      }

      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();

      const cell = (fixture.nativeElement as HTMLElement).querySelector('.et-table-error-cell');
      expect(cell?.querySelector('.retry')?.textContent).toBe('Retry');
      expect(cell?.textContent).not.toContain('Could not load data');
    });

    it('gives a single cell its own state without touching its neighbours', () => {
      const fixture = create(columns());
      const host = fixture.nativeElement as HTMLElement;

      setStates(fixture, {
        cellState: (person: Person, key: string) =>
          person.id === 1 && key === 'name' ? 'loading' : person.id === 2 && key === 'role' ? 'error' : null,
      });

      const cellAt = (row: number, key: string) =>
        host.querySelectorAll('.et-table-row')[row]?.querySelector(`[data-col-key="${key}"]`);

      // Both states mark the cell; swapping a loading value for a bone needs etTableSkeleton, so here
      // the value stays put and `data-state` carries the cue on its own.
      expect(cellAt(0, 'name')?.getAttribute('data-state')).toBe('loading');
      expect(cellAt(0, 'name')?.querySelector('et-skeleton-item')).toBeNull();
      expect(cellAt(0, 'name')?.textContent?.trim()).toBe('Ada');

      expect(cellAt(1, 'role')?.getAttribute('data-state')).toBe('error');
      expect(cellAt(1, 'role')?.querySelector('.et-table-cell-error-icon')).not.toBeNull();
      expect(cellAt(1, 'role')?.textContent?.trim()).toBe('Viewer');

      // Untouched cells stay plain.
      expect(cellAt(0, 'role')?.getAttribute('data-state')).toBeNull();
      expect(cellAt(1, 'name')?.textContent?.trim()).toBe('Alan');
    });
  });

  describe('labels', () => {
    it('takes the injected label set, and lets a table override single keys', () => {
      TestBed.configureTestingModule({ providers: [provideTableLabels({ empty: 'Keine Daten' })] });

      const fixture = create(columns(), []);
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('.et-table-empty-cell')?.textContent?.trim()).toBe('Keine Daten');

      // The input is partial and layers over the provided set rather than replacing it.
      fixture.componentRef.setInput('labels', { empty: 'Nichts hier' });
      fixture.detectChanges();
      expect(host.querySelector('.et-table-empty-cell')?.textContent?.trim()).toBe('Nichts hier');
      expect(fixture.componentInstance.resolvedLabels().error).toBe(DEFAULT_TABLE_LABELS.error);
      expect(fixture.componentInstance.resolvedLabels().selectRow).toBe(DEFAULT_TABLE_LABELS.selectRow);
    });

    it('re-resolves a locale-driven label factory when the locale changes', () => {
      TestBed.configureTestingModule({
        providers: [provideTableLabels((locale) => ({ empty: locale === 'de' ? 'Keine Daten' : 'No data' }))],
      });

      const fixture = create(columns(), []);
      const host = fixture.nativeElement as HTMLElement;
      const locale = TestBed.runInInjectionContext(() => injectLocale());

      expect(host.querySelector('.et-table-empty-cell')?.textContent?.trim()).toBe('No data');

      // A locale switch must reach the wording without recreating the table.
      locale.currentLocale.set('de');
      fixture.detectChanges();
      expect(host.querySelector('.et-table-empty-cell')?.textContent?.trim()).toBe('Keine Daten');
    });

    it('announces what the next sort click does, through sortAction', () => {
      const fixture = create({
        name: { header: 'Name', value: (person: Person) => person.name, sortable: true },
      } satisfies TableColumns<Person>);
      const table = fixture.componentInstance;
      const label = () =>
        (fixture.nativeElement as HTMLElement)
          .querySelector('.et-table-header-label--sortable')
          ?.getAttribute('aria-label');

      expect(label()).toBe('Sort Name ascending');

      table.setSort('name', 'asc');
      fixture.detectChanges();
      expect(label()).toBe('Sort Name descending');

      table.setSort('name', 'desc');
      fixture.detectChanges();
      expect(label()).toBe('Clear sort on Name');
    });
  });

  describe('empty & error templates', () => {
    it('prefers the templates over the labels, and hands the error to its template', () => {
      @Component({
        template: `
          <et-table [columns]="cols" [data]="data" [error]="error()" [emptyTemplate]="empty" [errorTemplate]="failure">
            <ng-template #empty let-rows>none of {{ rows.length }}</ng-template>
            <ng-template #failure let-error>failed: {{ error.message }}</ng-template>
          </et-table>
        `,
        imports: [TABLE_IMPORTS],
      })
      class HostComponent {
        cols = columns();
        data: Person[] = [];
        // A signal, not a field: change detection is zoneless here, so a plain mutation would never
        // mark the host dirty and the binding would not be re-read.
        error = signal<{ message: string } | null>(null);
      }

      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('.et-table-empty-cell')?.textContent?.trim()).toBe('none of 0');

      fixture.componentInstance.error.set({ message: 'nope' });
      fixture.detectChanges();
      expect(host.querySelector('.et-table-error-cell')?.textContent?.trim()).toBe('failed: nope');
    });
  });

  describe('rowsSource', () => {
    const createSource = () => {
      const sort = signal<TableSort[]>([]);
      const filters = signal<TableFilter[]>([]);

      return {
        rows: signal<Person[]>([]),
        loading: signal(false),
        error: signal<string | null>(null),
        sort,
        filters,
        setSort: vi.fn((next: TableSort[]) => sort.set(next)),
        setFilters: vi.fn((next: TableFilter[]) => filters.set(next)),
      };
    };

    it('feeds data, loading and error, and defaults both modes to server', () => {
      const source = createSource();
      const fixture = create(columns());
      const host = fixture.nativeElement as HTMLElement;
      const table = fixture.componentInstance;

      fixture.componentRef.setInput('rowsSource', source);
      source.loading.set(true);
      fixture.detectChanges();

      // Nothing to show yet → a blank, busy body, without a `loading` binding of its own.
      expect(host.querySelectorAll('.et-table-row').length).toBe(0);
      expect(host.getAttribute('aria-busy')).toBe('true');
      // A source has already sorted and filtered server-side.
      expect(table.resolvedSortMode()).toBe('server');
      expect(table.resolvedFilterMode()).toBe('server');

      source.rows.set(PEOPLE);
      source.loading.set(false);
      fixture.detectChanges();
      expect(table.rows()).toEqual(PEOPLE);
      expect(host.querySelectorAll('.et-table-row').length).toBe(PEOPLE.length);

      source.error.set('boom');
      fixture.detectChanges();
      expect(host.querySelector('.et-table-error-cell')).not.toBeNull();
    });

    it('routes sort and filter changes to the source and mirrors its state back', () => {
      const source = createSource();
      const fixture = create({
        name: { header: 'Name', value: (person: Person) => person.name, sortable: true },
        role: { header: 'Role', value: (person: Person) => person.role, filterable: true },
      } satisfies TableColumns<Person>);
      const table = fixture.componentInstance;

      fixture.componentRef.setInput('rowsSource', source);
      source.rows.set(PEOPLE);
      fixture.detectChanges();

      table.toggleSort('name');
      fixture.detectChanges();

      // The source is asked, not the table's own model - and its answer is mirrored into `sort()` so
      // features, `state()` and the header keep one read path.
      expect(source.setSort).toHaveBeenCalledWith([{ key: 'name', direction: 'asc' }]);
      expect(table.sort()).toEqual([{ key: 'name', direction: 'asc' }]);

      table.setFilterValues('role', ['Admin']);
      fixture.detectChanges();
      expect(source.setFilters).toHaveBeenCalledWith([{ key: 'role', values: ['Admin'] }]);
      expect(table.filterValuesFor('role')).toEqual(['Admin']);

      // Server-side means the rows arrive as they are - no second sort in the browser.
      expect(table.rows()).toEqual(PEOPLE);
    });

    it('keeps the source sort and filters when a layout-only state is restored', () => {
      const source = createSource();
      const fixture = create({
        name: { header: 'Name', value: (person: Person) => person.name, sortable: true },
        role: { header: 'Role', value: (person: Person) => person.role, filterable: true },
      } satisfies TableColumns<Person>);
      const table = fixture.componentInstance;

      fixture.componentRef.setInput('rowsSource', source);
      source.rows.set(PEOPLE);
      source.sort.set([{ key: 'name', direction: 'desc' }]);
      source.filters.set([{ key: 'role', values: ['Admin'] }]);
      fixture.detectChanges();

      table.restoreState({
        v: 3,
        columns: [
          { key: 'role', hidden: false },
          { key: 'name', hidden: true },
        ],
      });
      fixture.detectChanges();

      // The layout lands, the source's own state stays - and the source is never written back to.
      expect(table.isColumnVisible('name')).toBe(false);
      expect(table.sortDirection('name')).toBe('desc');
      expect(table.filterValuesFor('role')).toEqual(['Admin']);
      expect(source.setSort).not.toHaveBeenCalled();
      expect(source.setFilters).not.toHaveBeenCalled();
    });

    it('owns the sort and filters a source takes through setters but never publishes', () => {
      const setSort = vi.fn();
      const setFilters = vi.fn();
      const source = { rows: signal<Person[]>(PEOPLE), setSort, setFilters };
      const fixture = create({
        name: { header: 'Name', value: (person: Person) => person.name, sortable: true },
        role: { header: 'Role', value: (person: Person) => person.role, filterable: true },
      } satisfies TableColumns<Person>);
      const table = fixture.componentInstance;

      fixture.componentRef.setInput('rowsSource', source);
      fixture.detectChanges();

      table.toggleSort('name');
      fixture.detectChanges();
      expect(table.sortDirection('name')).toBe('asc');

      // Nothing mirrors the source's answer back, so a header that is not written here can never
      // leave the direction it reached first.
      table.toggleSort('name');
      fixture.detectChanges();
      expect(setSort).toHaveBeenLastCalledWith([{ key: 'name', direction: 'desc' }]);
      expect(table.sortDirection('name')).toBe('desc');
      expect(table.state().columns.find((column) => column.key === 'name')?.sort).toBe('desc');

      table.setFilterValues('role', ['Admin']);
      fixture.detectChanges();
      expect(setFilters).toHaveBeenLastCalledWith([{ key: 'role', values: ['Admin'] }]);
      expect(table.filterValuesFor('role')).toEqual(['Admin']);
    });

    it('names a source that publishes sort without the setter the table would write through', () => {
      const source = { rows: signal<Person[]>(PEOPLE), sort: signal<TableSort[]>([]) };
      const fixture = create({
        name: { header: 'Name', value: (person: Person) => person.name, sortable: true },
      } satisfies TableColumns<Person>);

      fixture.componentRef.setInput('rowsSource', source);

      expect(() => fixture.detectChanges()).toThrow(
        expect.objectContaining({
          code: TABLE_ERROR_CODES.UNPAIRED_ROWS_SOURCE_STATE,
        }) as unknown as RuntimeError<number>,
      );
    });

    it('leaves a read-only source alone when no column offers the control it would drive', () => {
      const source = { rows: signal<Person[]>(PEOPLE), sort: signal<TableSort[]>([]) };
      const fixture = create(columns());

      fixture.componentRef.setInput('rowsSource', source);

      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it('leaves an explicit mode alone, and keeps the modes client-side without a source', () => {
      const source = createSource();
      const fixture = create(columns());
      const table = fixture.componentInstance;

      expect(table.resolvedSortMode()).toBe('client');

      fixture.componentRef.setInput('rowsSource', source);
      fixture.componentRef.setInput('sortMode', 'client');
      fixture.detectChanges();

      expect(table.resolvedSortMode()).toBe('client');
      expect(table.resolvedFilterMode()).toBe('server');
    });
  });

  describe('footer slot', () => {
    it('renders projected [etTableFooter] content in a full-width footer bar', () => {
      @Component({
        template: `<et-table [columns]="columns" [data]="data"
          ><div etTableFooter><span class="pager">pager here</span></div></et-table
        >`,
        imports: [TABLE_IMPORTS],
      })
      class HostComponent {
        columns = columns();
        data = PEOPLE;
      }

      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();

      const footer = (fixture.nativeElement as HTMLElement).querySelector('.et-table-footer');
      expect(footer).not.toBeNull();
      expect(footer?.querySelector('.pager')?.textContent).toBe('pager here');
    });

    it('omits the footer bar entirely when no [etTableFooter] is projected', () => {
      const fixture = create(columns());

      expect((fixture.nativeElement as HTMLElement).querySelector('.et-table-footer')).toBeNull();
    });
  });

  describe('resizable columns', () => {
    it('applies a restored width to the grid template and round-trips it through state()', () => {
      const { componentInstance: table } = create(columns());

      table.restoreState({
        v: 1,
        columns: [
          { key: 'name', hidden: false, width: 240 },
          { key: 'role', hidden: false },
        ],
      });

      // The restored px width overrides the column's default track.
      expect(table.templateColumns()).toBe('240px minmax(96px, 1fr)');

      // state() emits the width back for the resized column only.
      const columnStates = table.state().columns;
      expect(columnStates.find((column) => column.key === 'name')?.width).toBe(240);
      expect(columnStates.find((column) => column.key === 'role')?.width).toBeUndefined();
    });
  });

  describe('pointer gesture claims', () => {
    const pointer = (type: string, pointerId = 1) => new PointerEvent(type, { pointerId, bubbles: true });

    it('reports the feature that claimed a pointer, and nothing for an unclaimed one', () => {
      const { componentInstance: table } = create(columns());
      const down = pointer('pointerdown');

      expect(table.pointerGestureClaim(down)).toBeNull();

      table.claimPointerGesture(down, 'etTableReorder');

      expect(table.pointerGestureClaim(down)).toBe('etTableReorder');
      expect(table.pointerGestureClaim(pointer('pointerdown', 2))).toBeNull();
    });

    it('releases the claim when the pointer is let go or the gesture is taken away', () => {
      const { componentInstance: table } = create(columns());
      const first = pointer('pointerdown');

      table.claimPointerGesture(first, 'etTableReorder');
      document.dispatchEvent(pointer('pointerup'));

      expect(table.pointerGestureClaim(first)).toBeNull();

      const second = pointer('pointerdown', 3);

      table.claimPointerGesture(second, 'etTableReorder');
      document.dispatchEvent(pointer('pointercancel', 3));

      expect(table.pointerGestureClaim(second)).toBeNull();
    });

    it('leaves a claim alone when a different pointer ends', () => {
      const { componentInstance: table } = create(columns());
      const down = pointer('pointerdown');

      table.claimPointerGesture(down, 'etTableReorder');
      document.dispatchEvent(pointer('pointerup', 2));

      expect(table.pointerGestureClaim(down)).toBe('etTableReorder');
    });
  });

  describe('row interaction', () => {
    @Component({
      template: `
        <et-table [columns]="cols" [data]="data" (rowClick)="clicked = $event" etTableSelection rowInteractive>
          <ng-template [etTableCell]="cols.act"><button class="act" type="button">Act</button></ng-template>
        </et-table>
      `,
      imports: [TABLE_IMPORTS, TABLE_SELECTION_IMPORTS],
    })
    class HostComponent {
      clicked: Person | null = null;
      data = PEOPLE;
      cols = {
        name: { header: 'Name', value: (person: Person) => person.name },
        act: { header: '', value: (person: Person) => person },
      } satisfies TableColumns<Person>;
    }

    const build = () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();

      return fixture;
    };

    it('emits rowClick with the row when a plain cell is clicked', () => {
      const fixture = build();
      const host = fixture.nativeElement as HTMLElement;
      const nameCell = host.querySelector('.et-table-row .et-table-cell[data-col-key="name"]') as HTMLElement;

      nameCell.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.clicked).toBe(PEOPLE[0]);
    });

    it('ignores clicks in the selection cell', () => {
      const fixture = build();
      const host = fixture.nativeElement as HTMLElement;
      const selectCell = host.querySelector('.et-table-row .et-table-select-cell') as HTMLElement;

      selectCell.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.clicked).toBeNull();
    });

    it('ignores clicks on an in-cell button', () => {
      const fixture = build();
      const host = fixture.nativeElement as HTMLElement;
      const button = host.querySelector('.et-table-row button.act') as HTMLElement;

      button.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.clicked).toBeNull();
    });

    it('does not emit when rowInteractive is off', () => {
      const fixture = create(columns());
      const table = fixture.componentInstance;
      let emitted = false;
      table.rowClick.subscribe(() => (emitted = true));

      const cell = (fixture.nativeElement as HTMLElement).querySelector('.et-table-row .et-table-cell') as HTMLElement;
      cell.click();

      expect(emitted).toBe(false);
    });
  });

  describe('row links', () => {
    @Component({
      template: `
        <et-table [columns]="cols" [data]="data" [rowLink]="link" (rowClick)="clicked = $event" rowInteractive>
          <ng-template [etTableCell]="cols.act"><button class="act" type="button">Act</button></ng-template>
        </et-table>
      `,
      imports: [TABLE_IMPORTS],
    })
    class HostComponent {
      clicked: Person | null = null;
      data = PEOPLE;
      link = (person: Person): string | null => (person.id === 1 ? `/people/${person.id}` : null);
      cols = {
        name: { header: 'Name', value: (person: Person) => person.name },
        act: { header: '', value: (person: Person) => person, interactive: true },
      } satisfies TableColumns<Person>;
    }

    const build = () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();

      return fixture;
    };

    const links = (fixture: ComponentFixture<unknown>) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.et-table-row-link'));

    it('renders one anchor per linked row, spanning the row and named by the identity cell', () => {
      const fixture = build();
      const anchors = links(fixture);

      expect(anchors.length).toBe(1);

      const anchor = anchors[0] as HTMLAnchorElement;
      const row = anchor.parentElement as HTMLElement;

      expect(anchor.getAttribute('href')).toBe('/people/1');
      // A child of the row, not of a cell: a pinned cell is `position: sticky` and would otherwise be
      // the anchor's containing block, shrinking the row's hit area to that one column.
      expect(row.classList.contains('et-table-row')).toBe(true);

      // Named by the first column that holds no controls of its own.
      const cell = row.querySelector(`[id="${anchor.getAttribute('aria-labelledby')}"]`) as HTMLElement;

      expect(cell.dataset['colKey']).toBe('name');
      expect(cell.textContent).toContain('Ada');
    });

    it('gives the linked row a box, and leaves the row itself out of the tab order', () => {
      const fixture = build();
      const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-row'));
      const [linked, unlinked] = rows as HTMLElement[];

      expect(linked?.classList.contains('et-table-row--box')).toBe(true);
      expect(linked?.classList.contains('et-table-row--link')).toBe(true);
      // The anchor is the row's one tab stop; `rowInteractive` may not add a second.
      expect(linked?.hasAttribute('tabindex')).toBe(false);

      // A row the callback answered `null` for stays a plain, clickable row.
      expect(unlinked?.classList.contains('et-table-row--link')).toBe(false);
      expect(unlinked?.getAttribute('tabindex')).toBe('0');
    });

    it('keeps a column marked interactive out of the link, and never hosts the link in it', () => {
      const fixture = build();
      const host = fixture.nativeElement as HTMLElement;
      const actCell = host.querySelector('.et-table-cell[data-col-key="act"]') as HTMLElement;

      expect(actCell.classList.contains('et-table-cell--interactive')).toBe(true);
      expect(actCell.querySelector('a.et-table-row-link')).toBeNull();

      // A click on the control is the control's, not the row's.
      (host.querySelector('button.act') as HTMLElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.clicked).toBeNull();
    });

    it('does not emit rowClick for a click that went through the row link', () => {
      const fixture = build();
      const anchor = links(fixture)[0] as HTMLAnchorElement;

      // The anchor's own navigation is the browser's; jsdom would follow it, so only the row's handler
      // is under test here.
      anchor.addEventListener('click', (event) => event.preventDefault());
      anchor.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.clicked).toBeNull();
    });

    it('gives every row a box in the cards appearance', () => {
      const fixture = create(columns());
      fixture.componentRef.setInput('appearance', 'cards');
      fixture.detectChanges();

      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-row--box');

      expect(rows.length).toBe(PEOPLE.length);
    });

    it('throws when a link is router commands and nothing can resolve them', () => {
      @Component({
        template: `<et-table [columns]="cols" [data]="data" [rowLink]="link" />`,
        imports: [TABLE_IMPORTS],
      })
      class CommandsHost {
        data = PEOPLE;
        link = (person: Person) => ['/people', person.id];
        cols = columns();
      }

      const fixture = TestBed.createComponent(CommandsHost);

      expect(() => fixture.detectChanges()).toThrow(
        expect.objectContaining({ code: TABLE_ERROR_CODES.MISSING_ROW_ROUTER_LINK }) as unknown as RuntimeError<number>,
      );
    });

    describe('with etTableRowRouterLink', () => {
      @Component({
        template: ` <et-table [columns]="cols" [data]="data" [rowLink]="link" etTableRowRouterLink /> `,
        imports: [TABLE_IMPORTS, TABLE_ROW_ROUTER_LINK_IMPORTS],
      })
      class RoutedHost {
        data = PEOPLE;
        link = (person: Person) => ['/people', person.id];
        cols = columns();
      }

      const buildRouted = () => {
        TestBed.configureTestingModule({ providers: [provideRouter([])] });

        const fixture = TestBed.createComponent(RoutedHost);
        fixture.detectChanges();

        return fixture;
      };

      it('renders the serialized URL as the href', () => {
        const fixture = buildRouted();
        const anchors = links(fixture);

        expect(anchors.length).toBe(PEOPLE.length);
        expect(anchors[0]?.getAttribute('href')).toBe('/people/1');
      });

      it('navigates through the router on a plain click, and leaves a modified one to the browser', () => {
        const fixture = buildRouted();
        const anchor = links(fixture)[0] as HTMLAnchorElement;
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

        const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        anchor.dispatchEvent(plain);

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(plain.defaultPrevented).toBe(true);

        // Ctrl-click opens a new tab - the router must not swallow it.
        const modified = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
        anchor.dispatchEvent(modified);

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(modified.defaultPrevented).toBe(false);
      });
    });
  });
  describe('disabled columns', () => {
    @Component({
      template: ` <et-table [columns]="cols" [data]="data" etTableColumnMenu /> `,
      imports: [TABLE_IMPORTS, TABLE_COLUMN_MENU_IMPORTS],
    })
    class HostComponent {
      data = PEOPLE;
      cols = {
        name: { header: 'Name', value: (person: Person) => person.name, sortable: true, disabled: true },
        role: { header: 'Role', value: (person: Person) => person.role, disabled: true },
        id: { header: 'Id', value: (person: Person) => person.id, sortable: true },
      } satisfies TableColumns<Person>;
    }

    const build = () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();

      return fixture.nativeElement as HTMLElement;
    };

    const headerCell = (host: HTMLElement, key: string) =>
      host.querySelector<HTMLElement>(`.et-table-header-cell[data-col-key="${key}"]`) as HTMLElement;

    it('marks a disabled column header cell, sortable or not', () => {
      const host = build();

      expect(headerCell(host, 'name').dataset['disabled']).toBe('true');
      expect(headerCell(host, 'role').dataset['disabled']).toBe('true');
      expect(headerCell(host, 'id').dataset['disabled']).toBeUndefined();
    });

    it("disables a disabled column's sort button and leaves an enabled one alone", () => {
      const host = build();
      const disabled = headerCell(host, 'name').querySelector('button') as HTMLButtonElement;
      const enabled = headerCell(host, 'id').querySelector('button') as HTMLButtonElement;

      expect(disabled.disabled).toBe(true);
      expect(enabled.disabled).toBe(false);
    });

    it("disables a disabled column's column-menu trigger", () => {
      const host = build();
      const trigger = headerCell(host, 'name').querySelector<HTMLButtonElement>(
        '.et-table-column-menu-trigger',
      ) as HTMLButtonElement;
      const enabled = headerCell(host, 'id').querySelector<HTMLButtonElement>(
        '.et-table-column-menu-trigger',
      ) as HTMLButtonElement;

      expect(trigger.disabled).toBe(true);
      expect(enabled.disabled).toBe(false);
    });

    it('still sorts a disabled column programmatically - only its controls are off', () => {
      const table = create(
        {
          name: { header: 'Name', value: (person) => person.name, sortable: true, disabled: true },
        } satisfies TableColumns<Person>,
        UNSORTED,
      ).componentInstance;

      table.toggleSort('name');

      expect(table.sort()).toEqual([{ key: 'name', direction: 'asc' }]);
      expect(table.rows().map((r) => r.name)).toEqual(['Ada', 'Bob', 'Charlie']);
    });
  });
});
