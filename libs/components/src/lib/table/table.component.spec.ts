import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuntimeError } from '@ethlete/core';
import { tableColumns } from './table-columns';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableComponent } from './table.component';
import { AnyTableColumn } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Alan', role: 'Viewer' },
];

const columns = () =>
  tableColumns<Person>([
    { key: 'name', header: 'Name', value: (person) => person.name, width: '200px' },
    { key: 'role', header: 'Role', value: (person) => person.role },
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
    const cols = columns();
    cols[1].hidden = true;
    const { componentInstance: table } = create(cols);

    expect(table.visibleColumns().map((c) => c.key)).toEqual(['name']);
    expect(table.templateColumns()).toBe('200px');
  });

  it('captures a versioned state snapshot of order + visibility', () => {
    const cols = columns();
    cols[1].hidden = true;
    const { componentInstance: table } = create(cols);

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
});
