import { Component, computed, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuntimeError } from '@ethlete/core';
import '../../test-helpers';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableColumnMeta } from './headless/table-features';
import { TableFiltersDirective } from './table-filters.directive';
import { TableComponent } from './table.component';
import { TABLE_FILTER_IMPORTS, TABLE_IMPORTS } from './table.imports';
import { AnyTableColumn, TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 3, name: 'Charlie', role: 'Viewer' },
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Bob', role: 'Editor' },
];

@Component({
  template: ` <et-table [columns]="columns()" [data]="data()" etTableFilters /> `,
  imports: [TABLE_IMPORTS, TABLE_FILTER_IMPORTS],
})
class HostComponent {
  public columns = signal<TableColumns<Person>>({});
  public data = signal<Person[]>(PEOPLE);

  public table = viewChild.required<TableComponent<Person>>(TableComponent);
  public filters = viewChild.required(TableFiltersDirective);
}

const create = (cols: TableColumns<Person>) => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.columns.set(cols);
  fixture.detectChanges();

  return fixture;
};

const tableOf = (fixture: ComponentFixture<HostComponent>) => fixture.componentInstance.table();

// The menu plumbing is protected (template-only) - reach it via a cast, as the table's own spec does.
type FilterInternals = {
  optionsFor: (column: TableColumnMeta) => { label: string; value: unknown }[];
  setSearchQuery: (column: AnyTableColumn<Person>, query: string) => void;
  loading: (column: TableColumnMeta) => boolean;
  hasSearch: (column: TableColumnMeta) => boolean;
};

const filtersOf = (fixture: ComponentFixture<HostComponent>) =>
  fixture.componentInstance.filters() as unknown as FilterInternals;

const roleColumn = (extra: Partial<AnyTableColumn<Person>> = {}) =>
  ({
    role: {
      header: 'Role',
      value: (person) => person.role,
      filterable: true,
      ...extra,
    },
  }) satisfies TableColumns<Person>;

describe('TableFiltersDirective', () => {
  it('renders a filter trigger on filterable columns only', () => {
    const fixture = create({
      name: { header: 'Name', value: (p) => p.name },
      role: {
        header: 'Role',
        value: (p) => p.role,
        filterable: true,
        filterOptions: [{ label: 'Admin', value: 'Admin' }],
      },
    } satisfies TableColumns<Person>);

    const triggers = (fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-filter-trigger');

    expect(triggers.length).toBe(1);
    expect(triggers[0]?.getAttribute('aria-label')).toBe('Filter Role');
  });

  it('disables the trigger on a disabled column, so its menu cannot be opened', () => {
    const fixture = create(roleColumn({ filterOptions: [{ label: 'Admin', value: 'Admin' }], disabled: true }));
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '.et-table-filter-trigger',
    ) as HTMLButtonElement;

    expect(trigger.disabled).toBe(true);
  });

  it('marks the trigger active while the column is filtered', () => {
    const fixture = create(roleColumn({ filterOptions: [{ label: 'Admin', value: 'Admin' }] }));
    const trigger = () => (fixture.nativeElement as HTMLElement).querySelector('.et-table-filter-trigger');

    expect(trigger()?.getAttribute('data-active')).toBe('false');

    tableOf(fixture).setFilterValues('role', ['Admin']);
    fixture.detectChanges();

    expect(trigger()?.getAttribute('data-active')).toBe('true');
  });

  it('writes filter values through to the table, so client filtering and state() see them', () => {
    const fixture = create(roleColumn({ filterOptions: [{ label: 'Viewer', value: 'Viewer' }] }));
    const table = tableOf(fixture);

    table.setFilterValues('role', ['Viewer']);
    fixture.detectChanges();

    expect(table.rows().map((row) => row.name)).toEqual(['Charlie']);
    expect(table.state().columns[0]?.filterValues).toEqual(['Viewer']);
  });

  it('narrows a static option list by the in-menu search text', () => {
    const cols = roleColumn({
      filterSearch: true,
      filterOptions: [
        { label: 'Admin', value: 'Admin' },
        { label: 'Editor', value: 'Editor' },
        { label: 'Viewer', value: 'Viewer' },
      ],
    });
    const fixture = create(cols);
    const filters = filtersOf(fixture);
    const column = { ...cols.role, key: 'role' };

    expect(filters.optionsFor(column).map((o) => o.label)).toEqual(['Admin', 'Editor', 'Viewer']);

    filters.setSearchQuery(column, 'ed');
    expect(filters.optionsFor(column).map((o) => o.label)).toEqual(['Editor']);
  });

  it('reads options and loading from an async provider (and forwards search to setQuery)', () => {
    const query = signal('');
    const setQuery = vi.fn((next: string) => query.set(next));
    const cols = roleColumn({
      filterOptions: {
        options: computed(() => (query() ? [{ label: 'Match', value: 'm' }] : [])),
        loading: signal(true),
        setQuery,
      },
    });
    const fixture = create(cols);
    const filters = filtersOf(fixture);
    const column = { ...cols.role, key: 'role' };

    expect(filters.optionsFor(column)).toEqual([]);
    expect(filters.loading(column)).toBe(true);
    // a provider implies a search box even without filterSearch
    expect(filters.hasSearch(column)).toBe(true);

    filters.setSearchQuery(column, 'x');
    expect(setQuery).toHaveBeenCalledWith('x');
    expect(filters.optionsFor(column)).toEqual([{ label: 'Match', value: 'm' }]);
  });

  describe('single-select columns', () => {
    it('holds at most one value, and clears when the picked option is chosen again', () => {
      const fixture = create(roleColumn({ filterSelection: 'single' }));
      const filters = fixture.componentInstance.filters();
      const table = tableOf(fixture);

      filters.toggleSingleValue('role', 'Admin');
      fixture.detectChanges();
      expect(table.filters()).toEqual([{ key: 'role', values: ['Admin'] }]);
      expect(filters.singleValueFor('role')).toBe('Admin');
      expect(table.rows().map((person) => person.name)).toEqual(['Ada']);

      // Picking another replaces rather than adds - that is the whole difference from a checkbox menu.
      filters.toggleSingleValue('role', 'Editor');
      fixture.detectChanges();
      expect(table.filters()).toEqual([{ key: 'role', values: ['Editor'] }]);

      // The same one again is the only way out of a radio group.
      filters.toggleSingleValue('role', 'Editor');
      fixture.detectChanges();
      expect(table.filters()).toEqual([]);
      expect(filters.singleValueFor('role')).toBeNull();
      expect(table.rows()).toHaveLength(PEOPLE.length);
    });
  });

  it('throws a labelled error when used outside a table', () => {
    @Component({
      template: `<div etTableFilters></div>`,
      imports: [TABLE_FILTER_IMPORTS],
    })
    class OrphanComponent {}

    expect(() => TestBed.createComponent(OrphanComponent)).toThrow(
      expect.objectContaining({ code: TABLE_ERROR_CODES.FEATURE_OUTSIDE_TABLE }) as unknown as RuntimeError<number>,
    );
  });
});
