import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TableGroupHeadersDirective } from './table-group-headers.directive';
import { TableComponent } from './table.component';
import { TABLE_GROUP_HEADERS_IMPORTS, TABLE_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 3, name: 'Charlie', role: 'Viewer' },
  { id: 1, name: 'Ada', role: 'Admin' },
];

const ungrouped = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    role: { header: 'Role', value: (person) => person.role },
  }) satisfies TableColumns<Person>;

const grouped = () =>
  ({
    a: { header: 'A', value: (person) => person.name, group: 'Season' },
    b: { header: 'B', value: (person) => person.role, group: 'Season' },
    c: { header: 'C', value: (person) => person.id },
  }) satisfies TableColumns<Person>;

@Component({
  template: ` <et-table [columns]="cols()" [data]="data()" etTableGroupHeaders /> `,
  imports: [TABLE_IMPORTS, TABLE_GROUP_HEADERS_IMPORTS],
})
class HostComponent {
  public cols = signal<TableColumns<Person>>(grouped());
  public data = signal<Person[]>(PEOPLE);
  public feature = viewChild.required(TableGroupHeadersDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);
}

const create = (cols?: TableColumns<Person>) => {
  const fixture = TestBed.createComponent(HostComponent);
  if (cols) fixture.componentInstance.cols.set(cols);
  fixture.detectChanges();

  return fixture;
};

const featureOf = (fixture: ComponentFixture<HostComponent>) => fixture.componentInstance.feature();

describe('TableGroupHeadersDirective', () => {
  it('reports no groups and one run per column when none declare a group', () => {
    const fixture = create(ungrouped());
    const feature = featureOf(fixture);

    expect(feature.hasGroups()).toBe(false);
    expect(feature.headerGroups()).toEqual([
      { key: 'name', label: null, span: 1 },
      { key: 'role', label: null, span: 1 },
    ]);
  });

  it('merges adjacent same-group columns into one spanning run', () => {
    const fixture = create();
    const feature = featureOf(fixture);

    expect(feature.hasGroups()).toBe(true);
    expect(feature.headerGroups()).toEqual([
      { key: 'a', label: 'Season', span: 2 },
      { key: 'c', label: null, span: 1 },
    ]);
  });

  it('splits a group when reordering breaks its contiguity', () => {
    const fixture = create();

    fixture.componentInstance.table().moveColumn('c', 1); // a, c, b
    fixture.detectChanges();

    expect(featureOf(fixture).headerGroups()).toEqual([
      { key: 'a', label: 'Season', span: 1 },
      { key: 'c', label: null, span: 1 },
      { key: 'b', label: 'Season', span: 1 },
    ]);
  });

  it('renders one cell per run, spanning the run’s tracks, labelled only where there is a group', () => {
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;
    const cells = [...host.querySelectorAll('.et-table-group-cell')] as HTMLElement[];

    expect(cells).toHaveLength(2);
    expect(cells[0]!.style.gridColumn).toBe('span 2');
    expect(cells[0]!.classList.contains('et-table-group-cell--labeled')).toBe(true);
    expect(cells[0]!.textContent?.trim()).toBe('Season');
    expect(cells[0]!.getAttribute('role')).toBe('columnheader');

    // an ungrouped run still covers its track, but reads as empty rather than as a one-column group
    expect(cells[1]!.style.gridColumn).toBe('span 1');
    expect(cells[1]!.classList.contains('et-table-group-cell--labeled')).toBe(false);
    expect(cells[1]!.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the row before the column headers, as one row of the same grid', () => {
    const fixture = create();
    const grid = (fixture.nativeElement as HTMLElement).querySelector('.et-table') as HTMLElement;

    expect(grid.firstElementChild?.tagName.toLowerCase()).toBe('et-table-group-header-row');
    expect(grid.firstElementChild?.getAttribute('role')).toBe('row');
  });

  it('renders nothing at all when disabled', () => {
    @Component({
      template: ` <et-table [columns]="cols" [data]="data" [etTableGroupHeaders]="{ enabled: false }" /> `,
      imports: [TABLE_IMPORTS, TABLE_GROUP_HEADERS_IMPORTS],
    })
    class DisabledHost {
      public cols = grouped();
      public data = PEOPLE;
    }

    const fixture = TestBed.createComponent(DisabledHost);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-group-cell')).toHaveLength(0);
  });
});
