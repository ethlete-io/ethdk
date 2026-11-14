import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { createFakeViewport } from './testing/fake-viewport';
import { TableComponent } from './table.component';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const columns = {
  name: { header: 'Name', value: (person) => person.name },
  role: { header: 'Role', value: (person) => person.role, visibleFrom: 'md' },
} satisfies TableColumns<Person>;

describe('TableComponent visibleFrom', () => {
  let viewport = createFakeViewport(400);
  let uninstall = () => false;

  beforeEach(() => {
    viewport = createFakeViewport(400);
    uninstall = viewport.install();
  });

  afterEach(() => uninstall());

  const create = (): ComponentFixture<TableComponent<Person>> => {
    const fixture = TestBed.createComponent<TableComponent<Person>>(TableComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', [{ id: 1, name: 'Ada', role: 'Admin' }]);
    fixture.detectChanges();

    return fixture;
  };

  const keys = (table: TableComponent<Person>) => table.visibleColumns().map((column) => column.key);

  it('leaves the column out below its breakpoint and shows it at the breakpoint', () => {
    const { componentInstance: table } = create();

    expect(keys(table)).toEqual(['name']);
    expect(table.allColumns().map((column) => column.key)).toEqual(['name']);

    viewport.resize(768);

    expect(keys(table)).toEqual(['name', 'role']);
    expect(table.allColumns().map((column) => column.key)).toEqual(['name', 'role']);
  });

  it('keeps a user-hidden column hidden after the breakpoint is crossed', () => {
    const { componentInstance: table } = create();

    viewport.resize(1024);
    table.setColumnVisible('role', false);
    expect(keys(table)).toEqual(['name']);

    viewport.resize(400);
    viewport.resize(1024);

    expect(keys(table)).toEqual(['name']);
    expect(table.isColumnVisible('role')).toBe(false);
  });

  it('keeps a user-revealed column shown after crossing the breakpoint', () => {
    const { componentInstance: table } = create();

    viewport.resize(1024);
    table.setColumnVisible('role', false);
    table.setColumnVisible('role', true);

    viewport.resize(400);
    expect(keys(table)).toEqual(['name']);

    viewport.resize(1024);
    expect(keys(table)).toEqual(['name', 'role']);
  });
});
