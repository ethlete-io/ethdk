import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuntimeError } from '@ethlete/core';
import '../../test-helpers';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableRowExpansionDirective } from './table-row-expansion.directive';
import { TableComponent } from './table.component';
import { TABLE_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS } from './table.imports';
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
      [expandedRowTemplate]="detail"
      [etTableRowExpansion]="{ expanded: expanded, expandableRow: expandableRow() }"
    >
      <ng-template #detail let-person>{{ person.role }}</ng-template>
    </et-table>
  `,
  imports: [TABLE_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS],
})
class HostComponent {
  public cols = signal<TableColumns<Person>>(columns());
  public data = signal<Person[]>(PEOPLE);
  public expanded = signal<Set<unknown>>(new Set());
  public expandableRow = signal<((row: Person) => boolean) | undefined>(undefined);
  public keyed = signal(true);
  public feature = viewChild.required<TableRowExpansionDirective<Person>>(TableRowExpansionDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);

  public rowKey = (row: Person) => row.id;
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const featureOf = (fixture: ComponentFixture<HostComponent>) => fixture.componentInstance.feature();

describe('TableRowExpansionDirective', () => {
  it('renders a leading expander column with a button per row', () => {
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;

    // one per body row; the header cell of a lead column has no component of its own
    expect(host.querySelectorAll('.et-table-expander-cell .et-table-expander').length).toBe(PEOPLE.length);
  });

  it('adds a track to the grid template, ahead of the data columns', () => {
    const fixture = create();
    const grid = (fixture.nativeElement as HTMLElement).querySelector('.et-table') as HTMLElement;

    expect(grid.style.gridTemplateColumns.startsWith('var(--et-table-expander-width, 32px)')).toBe(true);
  });

  it('toggles a row and tracks it in the expanded set', () => {
    const fixture = create();
    const expansion = featureOf(fixture);
    const row = PEOPLE[0]!;

    expect(expansion.isExpanded(row)).toBe(false);

    expansion.toggle(row);
    expect(expansion.isExpanded(row)).toBe(true);
    expect(fixture.componentInstance.expanded().size).toBe(1);

    expansion.toggle(row);
    expect(expansion.isExpanded(row)).toBe(false);
  });

  it('renders the detail row with the template only while the row is expanded', () => {
    const fixture = create();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.et-table-detail-row').length).toBe(0);

    featureOf(fixture).toggle(PEOPLE[0]!);
    fixture.detectChanges();

    const details = host.querySelectorAll('.et-table-detail-row');
    expect(details.length).toBe(1);
    expect(details[0]!.textContent).toContain(PEOPLE[0]!.role);
  });

  it('keys expansion by rowKey so equal-keyed rows share state', () => {
    const fixture = create();
    const expansion = featureOf(fixture);

    expansion.toggle({ id: 1, name: 'Ada', role: 'Admin' });

    expect(expansion.isExpanded({ id: 1, name: 'renamed', role: 'Viewer' })).toBe(true);
    expect(expansion.isExpanded({ id: 2, name: 'Bob', role: 'Editor' })).toBe(false);
  });

  it('keeps a row blocked by expandableRow from expanding', () => {
    const fixture = create();
    fixture.componentInstance.expandableRow.set((row) => row.role !== 'Viewer');
    fixture.detectChanges();

    const expansion = featureOf(fixture);
    const viewer = PEOPLE[0]!;

    expect(expansion.canExpand(viewer)).toBe(false);

    // the key still lands in the set - the row simply has no detail row and no expander button
    expansion.toggle(viewer);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-detail-row').length).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-expander').length).toBe(
      PEOPLE.length - 1,
    );
  });

  describe('state', () => {
    it('serializes the expanded rows into its own feature slice and round-trips them', () => {
      const fixture = create();
      const expansion = featureOf(fixture);
      const table = fixture.componentInstance.table();

      expansion.toggle(PEOPLE[0]!);

      const snapshot = table.state();
      // the string form of the numeric rowKey, under the feature's own slice - not a top-level key
      expect(snapshot.features?.['expansion']).toEqual([String(PEOPLE[0]!.id)]);
      expect(snapshot.v).toBe(3);

      fixture.componentInstance.expanded.set(new Set());
      expect(expansion.isExpanded(PEOPLE[0]!)).toBe(false);

      table.restoreState(snapshot);
      expect(expansion.isExpanded(PEOPLE[0]!)).toBe(true);
    });

    it('contributes no slice when nothing is expanded', () => {
      const fixture = create();

      expect(fixture.componentInstance.table().state().features).toBeUndefined();
    });

    it('ignores a v2 state’s top-level expanded list rather than clearing what is open', () => {
      const fixture = create();
      const expansion = featureOf(fixture);

      expansion.toggle(PEOPLE[0]!);

      // v2 kept expanded rows outside the features bag, so there is no slice to hand back - and an
      // absent slice is left alone rather than reset (see restoreState).
      fixture.componentInstance
        .table()
        .restoreState({ v: 2, columns: [{ key: 'name', hidden: false }], expanded: [String(PEOPLE[1]!.id)] });

      expect(expansion.isExpanded(PEOPLE[0]!)).toBe(true);
      expect(expansion.isExpanded(PEOPLE[1]!)).toBe(false);
    });
  });

  it('throws in dev mode when a detail template has no feature to render it', () => {
    @Component({
      template: `
        <et-table [columns]="cols" [data]="data" [expandedRowTemplate]="detail">
          <ng-template #detail let-person>{{ person.role }}</ng-template>
        </et-table>
      `,
      imports: [TABLE_IMPORTS],
    })
    class UnfeaturedHost {
      public cols = columns();
      public data = PEOPLE;
    }

    const fixture = TestBed.createComponent(UnfeaturedHost);

    expect(() => fixture.detectChanges()).toThrow(
      expect.objectContaining({ code: TABLE_ERROR_CODES.MISSING_ROW_EXPANSION }) as RuntimeError,
    );
  });
});
