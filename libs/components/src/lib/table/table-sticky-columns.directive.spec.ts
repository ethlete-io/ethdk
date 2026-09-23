import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { createTableDriver } from './testing/table-driver';
import { TableStickyColumnsDirective } from './table-sticky-columns.directive';
import { TableComponent } from './table.component';
import { TableColumnMenuDirective } from './table-column-menu.directive';
import {
  TABLE_COLUMN_MENU_IMPORTS,
  TABLE_IMPORTS,
  TABLE_SELECTION_IMPORTS,
  TABLE_STICKY_COLUMNS_IMPORTS,
} from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Alan', role: 'Viewer' },
];

const pinned = () =>
  ({
    name: { header: 'Name', value: (person) => person.name, width: '200px', sticky: 'start' },
    role: { header: 'Role', value: (person) => person.role, width: '200px' },
    actions: { header: '', value: (person) => person.id, width: '96px', sticky: 'end' },
  }) satisfies TableColumns<Person>;

@Component({
  template: ` <et-table [columns]="cols()" [data]="data" etTableStickyColumns /> `,
  imports: [TABLE_IMPORTS, TABLE_STICKY_COLUMNS_IMPORTS],
})
class HostComponent {
  public cols = signal<TableColumns<Person>>(pinned());
  public data = PEOPLE;
  public feature = viewChild.required(TableStickyColumnsDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const headerOf = (fixture: ComponentFixture<HostComponent>, key: string) => createTableDriver(fixture).headerCell(key);

describe('TableStickyColumnsDirective', () => {
  it('marks the declared columns pinned, at their own edge', () => {
    const fixture = create();

    expect(headerOf(fixture, 'name')?.classList.contains('et-table-sticky-start')).toBe(true);
    expect(headerOf(fixture, 'name')?.classList.contains('et-table-sticky-end')).toBe(false);

    expect(headerOf(fixture, 'actions')?.classList.contains('et-table-sticky-end')).toBe(true);
    expect(headerOf(fixture, 'actions')?.classList.contains('et-table-sticky-start')).toBe(false);

    // An unpinned column carries neither class nor an inline offset.
    expect(headerOf(fixture, 'role')?.classList.contains('et-table-sticky-start')).toBe(false);
    expect(headerOf(fixture, 'role')?.style.insetInlineStart).toBe('');
  });

  it('reports which edges are pinned', () => {
    const fixture = create();
    const feature = fixture.componentInstance.feature();

    expect(feature.hasStickyStart()).toBe(true);
    expect(feature.hasStickyEnd()).toBe(true);

    fixture.componentInstance.cols.set({
      name: { header: 'Name', value: (person: Person) => person.name },
      role: { header: 'Role', value: (person: Person) => person.role },
    } satisfies TableColumns<Person>);
    fixture.detectChanges();

    expect(feature.hasStickyStart()).toBe(false);
    expect(feature.hasStickyEnd()).toBe(false);
  });

  it('keeps the trailing slack track away from an end-pinned column', () => {
    const fixture = create();

    // Every column here is a rigid width, which would normally add a slack track to carry the table's
    // chrome to the panel's edge - but an end pin already owns that edge, so it must not.
    expect(fixture.componentInstance.table().templateColumns()).toBe('200px 200px 96px');
  });

  it('answers effectiveStickyOf for the reorder feature, and null once suppressed', () => {
    const fixture = create();
    const table = fixture.componentInstance.table();

    expect(table.effectiveStickyOf('name')).toBe('start');
    expect(table.effectiveStickyOf('actions')).toBe('end');
    expect(table.effectiveStickyOf('role')).toBeNull();

    // Suppression is measured from real layout, which jsdom has none of - drive it directly.
    fixture.componentInstance.feature().suppressed.set(true);
    fixture.detectChanges();

    expect(table.effectiveStickyOf('name')).toBeNull();
    expect(headerOf(fixture, 'name')?.classList.contains('et-table-sticky-start')).toBe(false);
  });

  describe('runtime pinning', () => {
    const keys = (fixture: ComponentFixture<HostComponent>) =>
      fixture.componentInstance
        .table()
        .visibleColumns()
        .map((column) => column.key);

    it('pins a column at runtime and renders it in its edge block', () => {
      const fixture = create();
      const table = fixture.componentInstance.table();

      table.pinColumn('role', 'end');
      fixture.detectChanges();

      expect(table.columnPin('role')).toBe('end');
      expect(keys(fixture)).toEqual(['name', 'role', 'actions']);
      expect(headerOf(fixture, 'role')?.classList.contains('et-table-sticky-end')).toBe(true);

      table.pinColumn('actions', 'start');
      fixture.detectChanges();

      expect(keys(fixture)).toEqual(['name', 'actions', 'role']);
      expect(headerOf(fixture, 'actions')?.classList.contains('et-table-sticky-start')).toBe(true);
      expect(table.state().columns.map((column) => column.key)).toEqual(['name', 'role', 'actions']);
    });

    it('unpins a declared column and returns an unpinned one to its place in the order', () => {
      const fixture = create();
      const table = fixture.componentInstance.table();

      table.pinColumn('name', null);
      fixture.detectChanges();

      expect(table.columnPin('name')).toBeNull();
      expect(headerOf(fixture, 'name')?.classList.contains('et-table-sticky-start')).toBe(false);
      expect(fixture.componentInstance.feature().hasStickyStart()).toBe(false);

      table.pinColumn('role', 'start');
      fixture.detectChanges();
      expect(keys(fixture)).toEqual(['role', 'name', 'actions']);

      table.pinColumn('role', null);
      fixture.detectChanges();
      expect(keys(fixture)).toEqual(['name', 'role', 'actions']);
    });

    it('round-trips runtime pins through state() and drops a pin back to the declaration', () => {
      const fixture = create();
      const table = fixture.componentInstance.table();

      table.pinColumn('role', 'start');
      table.pinColumn('name', null);
      const state = table.state();

      expect(state.features?.['pinning']).toEqual({ role: 'start', name: null });

      table.pinColumn('role', null);
      table.pinColumn('name', 'start');
      expect(table.state().features?.['pinning']).toBeUndefined();

      table.restoreState(state);
      fixture.detectChanges();
      expect(keys(fixture)).toEqual(['role', 'name', 'actions']);

      table.restoreState({ ...state, features: { pinning: { role: 'middle' } } });
      expect(table.columnPin('role')).toBeNull();
    });
  });

  it('lets the column menu offer pinning only while the feature is live', () => {
    @Component({
      template: `
        <et-table
          [columns]="cols"
          [data]="data"
          [etTableStickyColumns]="{ enabled: sticky() }"
          [etTableColumnMenu]="{ pinColumn: menuPins() }"
        />
      `,
      imports: [TABLE_IMPORTS, TABLE_STICKY_COLUMNS_IMPORTS, TABLE_COLUMN_MENU_IMPORTS],
    })
    class MenuHost {
      public cols = pinned();
      public data = PEOPLE;
      public sticky = signal(true);
      public menuPins = signal(true);
      public menu = viewChild.required(TableColumnMenuDirective);
    }

    const fixture = TestBed.createComponent(MenuHost);
    fixture.detectChanges();
    const menu = fixture.componentInstance.menu();

    expect(menu.canPin()).toBe(true);
    expect(menu.pinOf({ key: 'name', sticky: 'start' })).toBe('start');

    menu.pin({ key: 'role' }, 'start');
    expect(menu.pinOf({ key: 'role' })).toBe('start');

    fixture.componentInstance.menuPins.set(false);
    fixture.detectChanges();
    expect(menu.canPin()).toBe(false);

    fixture.componentInstance.menuPins.set(true);
    fixture.componentInstance.sticky.set(false);
    fixture.detectChanges();
    expect(menu.canPin()).toBe(false);
  });

  it('pins nothing while disabled', () => {
    @Component({
      template: ` <et-table [columns]="cols" [data]="data" [etTableStickyColumns]="{ enabled: false }" /> `,
      imports: [TABLE_IMPORTS, TABLE_STICKY_COLUMNS_IMPORTS],
    })
    class DisabledHost {
      public cols = pinned();
      public data = PEOPLE;
    }

    const fixture = TestBed.createComponent(DisabledHost);
    fixture.detectChanges();

    expect(createTableDriver(fixture).queryAll('.et-table-sticky-start, .et-table-sticky-end')).toHaveLength(0);
  });

  it('pins a trailing utility column to the trailing edge', () => {
    @Component({
      template: `
        <et-table
          [columns]="cols"
          [data]="data"
          [etTableSelection]="{ side: 'end' }"
          [rowKey]="rowKey"
          etTableStickyColumns
        />
      `,
      imports: [TABLE_IMPORTS, TABLE_STICKY_COLUMNS_IMPORTS, TABLE_SELECTION_IMPORTS],
    })
    class TrailingSelectionHost {
      public cols = pinned();
      public data = PEOPLE;
      public rowKey = (row: Person) => row.id;
    }

    const fixture = TestBed.createComponent(TrailingSelectionHost);
    fixture.detectChanges();

    const selectCells = createTableDriver(fixture).queryAll('.et-table-select-cell');

    // A trailing utility column does not wait for an end-pinned data column: pinning is live, so it is
    // pinned - the header cell and every body cell alike.
    expect(selectCells).toHaveLength(1 + PEOPLE.length);
    expect(selectCells.every((cell) => cell.classList.contains('et-table-sticky-end'))).toBe(true);
    expect(selectCells.some((cell) => cell.classList.contains('et-table-sticky-start'))).toBe(false);
  });
});
