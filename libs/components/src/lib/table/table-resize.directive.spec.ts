import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DragMoveEvent } from '@ethlete/core';
import '../../test-helpers';
import { TableResizeDirective } from './table-resize.directive';
import { TableComponent } from './table.component';
import { TABLE_IMPORTS, TABLE_RESIZE_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { name: string; role: string };

const PEOPLE: Person[] = [
  { name: 'Ada', role: 'Admin' },
  { name: 'Bob', role: 'Editor' },
];

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    role: { header: 'Role', value: (person) => person.role },
  }) satisfies TableColumns<Person>;

@Component({
  template: `<et-table [columns]="cols()" [data]="data()" etTableResize />`,
  imports: [TABLE_IMPORTS, TABLE_RESIZE_IMPORTS],
})
class HostComponent {
  public cols = signal<TableColumns<Person>>(columns());
  public data = signal<Person[]>(PEOPLE);
  public feature = viewChild.required(TableResizeDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const move = (totalDx: number) =>
  ({ stepX: totalDx, stepY: 0, clientX: totalDx, clientY: 0, totalDx, totalDy: 0 }) satisfies DragMoveEvent;

const columnMeta = (fixture: ComponentFixture<HostComponent>, key: string) => {
  const meta = fixture.componentInstance
    .feature()
    .table.visibleColumnsMeta()
    .find((column) => column.key === key);

  if (!meta) throw new Error(`no visible column "${key}"`);

  return meta;
};

describe('TableResizeDirective', () => {
  it('renders a grip in every header cell while there is more than one column', () => {
    const fixture = create();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-resize-grip').length).toBe(2);
  });

  it('writes a width override while dragging', () => {
    const fixture = create();
    const resize = fixture.componentInstance.feature();

    resize.start(columnMeta(fixture, 'name'));
    resize.update(move(40));
    resize.end();

    expect(fixture.componentInstance.table().hasColumnWidthOverride('name')).toBe(true);
  });

  describe('a cancelled drag', () => {
    it('leaves a column that had no width override without one', () => {
      const fixture = create();
      const resize = fixture.componentInstance.feature();
      const table = fixture.componentInstance.table();

      resize.start(columnMeta(fixture, 'name'));
      resize.update(move(40));
      resize.cancel();

      // A flexible column stays flexible: no override, nothing in state(), no "Reset width" entry.
      expect(table.hasColumnWidthOverride('name')).toBe(false);
      expect(table.state().columns.find((column) => column.key === 'name')?.width).toBeUndefined();
    });

    it('keeps the override a column already carried', () => {
      const fixture = create();
      const resize = fixture.componentInstance.feature();
      const table = fixture.componentInstance.table();

      table.setColumnWidth('name', 300);

      resize.start(columnMeta(fixture, 'name'));
      resize.update(move(40));
      resize.cancel();

      expect(table.hasColumnWidthOverride('name')).toBe(true);
    });
  });
});
