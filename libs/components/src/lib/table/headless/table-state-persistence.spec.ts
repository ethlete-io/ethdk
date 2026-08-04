import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { TableSelectionDirective } from '../table-selection.directive';
import { TableStatePersistenceDirective } from './table-state-persistence.directive';
import { createTableStateStorage } from './table-state-storage';
import { TableComponent } from '../table.component';
import { TABLE_IMPORTS, TABLE_SELECTION_IMPORTS, TABLE_STATE_PERSISTENCE_IMPORTS } from '../table.imports';
import { TableColumns, TableState } from '../table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Alan', role: 'Viewer' },
];

const COLUMNS = {
  name: { header: 'Name', value: (person: Person) => person.name, sortable: true },
  role: { header: 'Role', value: (person: Person) => person.role },
} satisfies TableColumns<Person>;

/** An in-memory stand-in for localStorage, so the specs never touch the real one. */
const createMemoryStorage = () => {
  const entries = new Map<string, string>();

  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
  };
};

describe('table state storage', () => {
  it('round-trips a state through a store, and survives unreadable or absent values', () => {
    const storage = createMemoryStorage();
    const store = createTableStateStorage({ key: 'users', storage });
    const state: TableState = { v: 2, columns: [{ key: 'name', hidden: false, sort: 'asc' }] };

    expect(store.load()).toBeNull();

    store.save(state);
    expect(store.load()).toEqual(state);

    // A hand-edited value degrades to "no restore" rather than throwing.
    storage.setItem('users', '{not json');
    expect(store.load()).toBeNull();

    store.save(state);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('never throws when the store itself refuses', () => {
    const store = createTableStateStorage({
      key: 'users',
      storage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('quota');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
    });

    expect(store.load()).toBeNull();
    expect(() => store.save({ v: 2, columns: [] })).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});

describe('TableStatePersistenceDirective', () => {
  @Component({
    template: `
      <et-table
        [columns]="columns"
        [data]="data"
        [rowKey]="rowKey"
        [etTableSelection]="{ selection: selected }"
        [etTableStatePersistence]="{ key: 'users', storage }"
      />
    `,
    imports: [TABLE_IMPORTS, TABLE_SELECTION_IMPORTS, TABLE_STATE_PERSISTENCE_IMPORTS],
  })
  class HostComponent {
    public columns = COLUMNS;
    public data = PEOPLE;
    public selected = signal<Set<unknown>>(new Set());
    public storage = createMemoryStorage();
    public rowKey = (person: Person) => person.id;

    public table = viewChild.required<TableComponent<Person>>(TableComponent);
    public selection = viewChild.required(TableSelectionDirective);
    public persistence = viewChild.required(TableStatePersistenceDirective);
  }

  const create = (storage = createMemoryStorage()) => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.storage = storage;
    fixture.detectChanges();

    return fixture;
  };

  it('saves the table setup - including a feature slice - and restores it into a fresh table', () => {
    const storage = createMemoryStorage();
    const first = create(storage);

    first.componentInstance.table().setSort('name', 'desc');
    first.componentInstance.table().setColumnVisible('role', false);
    first.componentInstance.selection().setSelected(PEOPLE[0]!, true);
    first.detectChanges();

    const saved = JSON.parse(storage.getItem('users') ?? 'null') as TableState;
    expect(saved.v).toBe(3);
    expect(saved.columns.find((column) => column.key === 'name')?.sort).toBe('desc');
    expect(saved.columns.find((column) => column.key === 'role')?.hidden).toBe(true);
    // The selection is the feature's own slice, not a column entry.
    expect(saved.features?.['selection']).toEqual(['1']);

    // A second table over the same store comes up as the first was left.
    first.destroy();
    const second = create(storage);
    second.detectChanges();

    expect(second.componentInstance.table().sort()).toEqual([{ key: 'name', direction: 'desc' }]);
    expect(second.componentInstance.table().isColumnVisible('role')).toBe(false);
    expect([...second.componentInstance.selected()]).toEqual(['1']);
  });

  it('clear() forgets the stored setup', () => {
    const storage = createMemoryStorage();
    const fixture = create(storage);

    fixture.componentInstance.table().setSort('name', 'asc');
    fixture.detectChanges();
    expect(storage.getItem('users')).not.toBeNull();

    fixture.componentInstance.persistence().clear();
    expect(storage.getItem('users')).toBeNull();
  });
});
