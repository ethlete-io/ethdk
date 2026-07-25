import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { tableColumns } from './table-columns';
import { TableSelectionComponent } from './table-selection.component';
import { TABLE_IMPORTS, TABLE_SELECTION_IMPORTS } from './table.imports';
import { AnyTableColumn } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 3, name: 'Charlie', role: 'Viewer' },
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Bob', role: 'Editor' },
];

const columns = () =>
  tableColumns<Person>([
    { key: 'name', header: 'Name', value: (person) => person.name },
    { key: 'role', header: 'Role', value: (person) => person.role },
  ]);

@Component({
  template: `
    <et-table [columns]="cols()" [data]="data()" [rowKey]="rowKey">
      <et-table-selection [(selection)]="selection" [selectableRow]="selectableRow()" />
    </et-table>
  `,
  imports: [TABLE_IMPORTS, TABLE_SELECTION_IMPORTS],
})
class HostComponent {
  public cols = signal<AnyTableColumn<Person>[]>(columns());
  public data = signal<Person[]>(PEOPLE);
  public selection = signal<Set<unknown>>(new Set());
  public selectableRow = signal<((row: Person) => boolean) | undefined>(undefined);
  public feature = viewChild.required<TableSelectionComponent<Person>>(TableSelectionComponent);

  public rowKey = (row: Person) => row.id;
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const featureOf = (fixture: ComponentFixture<HostComponent>) => fixture.componentInstance.feature();

describe('TableSelectionComponent', () => {
  it('renders a leading checkbox column: one header checkbox plus one per row', () => {
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.et-table-select-cell').length).toBe(1 + PEOPLE.length);
    expect(host.querySelectorAll('.et-table-select-cell et-checkbox').length).toBe(1 + PEOPLE.length);
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

    expect(grid.style.gridTemplateColumns.startsWith('var(--et-table-select-width, 32px)')).toBe(true);
  });
});
