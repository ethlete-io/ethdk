import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TableSelectionDirective } from './table-selection.directive';
import { TableComponent } from './table.component';
import { TABLE_IMPORTS, TABLE_SELECTION_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 3, name: 'Charlie', role: 'Viewer' },
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Bob', role: 'Editor' },
];

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    role: { header: 'Role', value: (person) => person.role },
  }) satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table
      [columns]="cols()"
      [data]="data()"
      [rowKey]="keyed() ? rowKey : undefined"
      [etTableSelection]="{ selection: selection, selectableRow: selectableRow(), side: side() }"
    />
  `,
  imports: [TABLE_IMPORTS, TABLE_SELECTION_IMPORTS],
})
class HostComponent {
  public cols = signal<TableColumns<Person>>(columns());
  public data = signal<Person[]>(PEOPLE);
  public selection = signal<Set<unknown>>(new Set());
  public selectableRow = signal<((row: Person) => boolean) | undefined>(undefined);
  public side = signal<'start' | 'end' | undefined>(undefined);
  public keyed = signal(true);
  public feature = viewChild.required<TableSelectionDirective<Person>>(TableSelectionDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);

  public rowKey = (row: Person) => row.id;
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const featureOf = (fixture: ComponentFixture<HostComponent>) => fixture.componentInstance.feature();

describe('TableSelectionDirective', () => {
  it('renders a leading checkbox column: one header checkbox plus one per row', () => {
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.et-table-select-cell').length).toBe(1 + PEOPLE.length);
    expect(host.querySelectorAll('.et-table-select-cell et-checkbox').length).toBe(1 + PEOPLE.length);
  });

  it('puts the checkbox column at the leading edge by default', () => {
    const fixture = create();
    const row = (fixture.nativeElement as HTMLElement).querySelector('.et-table-row') as HTMLElement;

    expect(row.firstElementChild?.classList.contains('et-table-select-cell')).toBe(true);
  });

  it('moves the checkbox column to the trailing edge on side: end', () => {
    const fixture = create();

    fixture.componentInstance.side.set('end');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const row = host.querySelector('.et-table-row') as HTMLElement;
    const headerRow = host.querySelector('.et-table-header-row') as HTMLElement;

    // Still one column, now ending every row kind rather than starting it.
    expect(host.querySelectorAll('.et-table-select-cell').length).toBe(1 + PEOPLE.length);
    expect(row.firstElementChild?.classList.contains('et-table-select-cell')).toBe(false);
    expect(row.lastElementChild?.classList.contains('et-table-select-cell')).toBe(true);
    expect(headerRow.lastElementChild?.classList.contains('et-table-select-cell')).toBe(true);
  });

  it('selects and deselects a single row (keyed by rowKey)', () => {
    const fixture = create();
    const selection = featureOf(fixture);
    const row = PEOPLE[0]!;

    expect(selection.isSelected(row)).toBe(false);

    selection.setSelected(row, true);
    expect(selection.isSelected(row)).toBe(true);
    expect(fixture.componentInstance.selection().size).toBe(1);

    selection.setSelected(row, false);
    expect(selection.isSelected(row)).toBe(false);
  });

  it('toggleAll selects every row, then clears', () => {
    const fixture = create();
    const selection = featureOf(fixture);

    expect(selection.isAllSelected()).toBe(false);

    selection.toggleAll();
    expect(selection.isAllSelected()).toBe(true);
    expect(selection.selectedRows()).toHaveLength(PEOPLE.length);

    selection.toggleAll();
    expect(fixture.componentInstance.selection().size).toBe(0);
  });

  it('reports a partial selection as indeterminate', () => {
    const fixture = create();
    const selection = featureOf(fixture);

    selection.setSelected(PEOPLE[0]!, true);

    expect(selection.isPartiallySelected()).toBe(true);
    expect(selection.isAllSelected()).toBe(false);
  });

  it('excludes rows blocked by selectableRow from select-all', () => {
    const fixture = create();
    fixture.componentInstance.selectableRow.set((row) => row.role !== 'Viewer');
    fixture.detectChanges();

    const selection = featureOf(fixture);
    selection.toggleAll();

    // Charlie (Viewer), Ada (Admin), Bob (Editor) → only the two non-Viewers select
    expect(selection.selectedRows()).toHaveLength(2);
    expect(selection.selectedRows().every((row) => row.role !== 'Viewer')).toBe(true);
    expect(selection.isAllSelected()).toBe(true);
  });

  it('marks selected rows so they can be styled', () => {
    const fixture = create();

    featureOf(fixture).setSelected(PEOPLE[0]!, true);
    fixture.detectChanges();

    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-row')];
    expect(rows.filter((row) => row.classList.contains('et-table-row--selected'))).toHaveLength(1);
  });

  it('adds a track to the grid template, ahead of the data columns', () => {
    const fixture = create();
    const grid = (fixture.nativeElement as HTMLElement).querySelector('.et-table') as HTMLElement;

    expect(grid.style.gridTemplateColumns.startsWith('var(--et-table-select-width, 44px)')).toBe(true);
  });

  describe('state', () => {
    it('serializes the selected rows into its own feature slice and round-trips them', () => {
      const fixture = create();
      const selection = featureOf(fixture);
      const table = fixture.componentInstance.table();

      selection.setSelected(PEOPLE[0]!, true);

      const snapshot = table.state();
      expect(snapshot.features?.['selection']).toEqual([String(PEOPLE[0]!.id)]);

      fixture.componentInstance.selection.set(new Set());
      table.restoreState(snapshot);

      expect(selection.isSelected(PEOPLE[0]!)).toBe(true);
    });

    it('contributes nothing for a table without a rowKey, rather than serialized row references', () => {
      const fixture = create();

      fixture.componentInstance.keyed.set(false);
      fixture.detectChanges();

      featureOf(fixture).setSelected(PEOPLE[0]!, true);

      expect(fixture.componentInstance.table().state().features).toBeUndefined();
    });

    it('leaves the live selection alone when a stored slice is restored without a rowKey', () => {
      const fixture = create();
      const selection = featureOf(fixture);

      fixture.componentInstance.keyed.set(false);
      fixture.detectChanges();

      selection.setSelected(PEOPLE[0]!, true);

      // Reference-keyed selection: a stored key matches no row, so writing it would only clear it.
      fixture.componentInstance
        .table()
        .restoreState({ v: 3, columns: [], features: { selection: [String(PEOPLE[1]!.id)] } });

      expect(selection.isSelected(PEOPLE[0]!)).toBe(true);
    });
  });
});
