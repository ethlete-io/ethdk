import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TableSkeletonDirective } from './table-skeleton.directive';
import { TableComponent } from './table.component';
import { TABLE_IMPORTS, TABLE_SKELETON_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Alan', role: 'Viewer' },
];

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    role: { header: 'Role', value: (person) => person.role },
  }) satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table [columns]="cols" [data]="data()" [loading]="loading()" [etTableSkeleton]="{ rows: rows() }" />
  `,
  imports: [TABLE_IMPORTS, TABLE_SKELETON_IMPORTS],
})
class HostComponent {
  public cols = columns();
  public data = signal<Person[]>([]);
  public loading = signal(true);
  public rows = signal<number | undefined>(undefined);
  public feature = viewChild.required(TableSkeletonDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const hostOf = (fixture: ComponentFixture<HostComponent>) => fixture.nativeElement as HTMLElement;

describe('TableSkeletonDirective', () => {
  it('draws placeholder rows while loading with no rows, in the table’s own tracks', () => {
    const fixture = create();
    const host = hostOf(fixture);

    // One row per `rows` (5 by default), each with a bone in every column.
    expect(host.querySelectorAll('.et-table-row--placeholder').length).toBe(5);
    expect(host.querySelectorAll('.et-table-row--placeholder et-skeleton-item').length).toBe(10);
    // The rows sit directly in the table's grid, so their cells are its grid items and the columns
    // can't jump when the data lands (the `display: contents` that makes that work is a CSS fact,
    // checked in the browser).
    expect(host.querySelector('.et-table')?.querySelector('et-table-skeleton-rows')).not.toBeNull();
    // The empty state must not show underneath them.
    expect(host.querySelector('.et-table-empty-cell')).toBeNull();
  });

  it('takes the row count from the config', () => {
    const fixture = create();

    fixture.componentInstance.rows.set(2);
    fixture.detectChanges();

    expect(hostOf(fixture).querySelectorAll('.et-table-row--placeholder').length).toBe(2);
  });

  it('stands down once the rows arrive, and once loading ends', () => {
    const fixture = create();
    const host = hostOf(fixture);

    fixture.componentInstance.data.set(PEOPLE);
    fixture.detectChanges();

    // Loading over rows that are on screen is the busy bar's job, not the skeleton's.
    expect(host.querySelectorAll('.et-table-row--placeholder').length).toBe(0);
    expect(host.querySelector('.et-table-busy-bar')).not.toBeNull();

    fixture.componentInstance.loading.set(false);
    fixture.detectChanges();
    expect(host.querySelector('.et-table-busy-bar')).toBeNull();
  });

  it('renders nothing when disabled, leaving the body blank', () => {
    @Component({
      template: ` <et-table [columns]="cols" [data]="data" [etTableSkeleton]="{ enabled: false }" loading /> `,
      imports: [TABLE_IMPORTS, TABLE_SKELETON_IMPORTS],
    })
    class DisabledHost {
      public cols = columns();
      public data: Person[] = [];
    }

    const fixture = TestBed.createComponent(DisabledHost);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.et-table-row--placeholder').length).toBe(0);
    expect(host.querySelector('.et-table-empty-cell')).toBeNull();
  });

  it('lets a column say what its loading placeholder looks like', () => {
    @Component({
      template: `
        <et-table [columns]="cols" [data]="data" loading etTableSkeleton>
          <ng-template [etTableCellSkeleton]="cols.role" let-index let-width="width">
            <span class="chip-bone">{{ index }}:{{ width }}</span>
          </ng-template>
        </et-table>
      `,
      imports: [TABLE_IMPORTS, TABLE_SKELETON_IMPORTS],
    })
    class TemplatedHost {
      public cols = columns();
      public data: Person[] = [];
    }

    const fixture = TestBed.createComponent(TemplatedHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const rows = host.querySelectorAll('.et-table-row--placeholder');

    // The templated column renders the consumer's bone; the other keeps the default one.
    expect(rows.length).toBe(5);
    expect(host.querySelectorAll('.chip-bone').length).toBe(5);
    expect(rows[0]?.querySelectorAll('et-skeleton-item').length).toBe(1);
    // Context: the row index plus the width the default bone would have used, so a custom one can stay
    // in the same rhythm.
    expect(host.querySelector('.chip-bone')?.textContent).toBe('0:45');
  });

  it('remembers a real row height and gives it to later placeholder rows', () => {
    const fixture = create();
    const table = fixture.componentInstance.table();

    fixture.componentInstance.data.set(PEOPLE);
    fixture.componentInstance.loading.set(false);
    // Row height can only come from a rendered cell - jsdom reports 0, so stand one in.
    vi.spyOn(table, 'firstBodyCellElement').mockReturnValue({
      getBoundingClientRect: () => ({ height: 52 }) as DOMRect,
    } as unknown as HTMLElement);
    fixture.detectChanges();

    fixture.componentInstance.data.set([]);
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    const row = hostOf(fixture).querySelector<HTMLElement>('.et-table-row--placeholder');

    // A refetch keeps the table exactly as tall as the data the user was just looking at.
    expect(row?.style.getPropertyValue('--_et-table-row-h')).toBe('52px');
  });

  it('fills a cell that is loading on its own with a bone in place of its value', () => {
    @Component({
      template: ` <et-table [columns]="cols" [data]="data" [cellState]="cellState" etTableSkeleton /> `,
      imports: [TABLE_IMPORTS, TABLE_SKELETON_IMPORTS],
    })
    class CellStateHost {
      public cols = columns();
      public data = PEOPLE;
      public cellState = (person: Person, key: string) => (person.id === 1 && key === 'name' ? 'loading' : null);
    }

    const fixture = TestBed.createComponent(CellStateHost);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const cell = host.querySelectorAll('.et-table-row')[0]?.querySelector('[data-col-key="name"]');

    expect(cell?.getAttribute('data-state')).toBe('loading');
    expect(cell?.querySelector('et-skeleton-item')).not.toBeNull();
    expect(cell?.textContent?.trim()).toBe('');
  });
});
