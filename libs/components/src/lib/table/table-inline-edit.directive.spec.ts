import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TableInlineEditDirective } from './table-inline-edit.directive';
import { TABLE_IMPORTS, TABLE_INLINE_EDIT_IMPORTS, TABLE_KEYBOARD_NAV_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Bob', role: 'Editor' },
  { id: 3, name: 'Charlie', role: 'Viewer' },
];

const COLUMNS = {
  // `name` is editable and has an editor; `role` is editable but has none, which must stay read-only.
  name: { header: 'Name', value: (person) => person.name, editable: true },
  role: { header: 'Role', value: (person) => person.role, editable: true },
} satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table
      [columns]="cols"
      [data]="data()"
      [rowKey]="rowKey"
      [etTableInlineEdit]="{ enabled: enabled(), editableCell: editableCell() }"
      (cellCommit)="commits.push($event)"
      (cellCancel)="cancels.push($event)"
      etTableKeyboardNav
    >
      <ng-template [etTableCellEdit]="cols.name" let-field="field">
        <input [value]="field().value()" (input)="field().value.set(value($event))" />
      </ng-template>
    </et-table>
  `,
  imports: [TABLE_IMPORTS, TABLE_INLINE_EDIT_IMPORTS, TABLE_KEYBOARD_NAV_IMPORTS],
})
class HostComponent {
  public readonly cols = COLUMNS;
  public data = signal<Person[]>(PEOPLE);
  public enabled = signal(true);
  public editableCell = signal<((row: Person, column: string) => boolean) | undefined>(undefined);
  public feature = viewChild.required(TableInlineEditDirective<Person>);
  public commits: { row: Person; column: string; previous: unknown; next: unknown }[] = [];
  public cancels: { row: Person; column: string }[] = [];

  public rowKey = (row: Person) => row.id;
  public value = (event: Event) => (event.target as HTMLInputElement).value;
}

// The same table with the two features' imports the other way round, which is what flips the order
// Angular registers their host listeners in. See the test that uses it.
@Component({
  template: `
    <et-table
      [columns]="cols"
      [data]="data"
      [rowKey]="rowKey"
      (cellCommit)="commits.push($event)"
      etTableInlineEdit
      etTableKeyboardNav
    >
      <ng-template [etTableCellEdit]="cols.name" let-field="field">
        <input [value]="field().value()" />
      </ng-template>
    </et-table>
  `,
  imports: [TABLE_IMPORTS, TABLE_KEYBOARD_NAV_IMPORTS, TABLE_INLINE_EDIT_IMPORTS],
})
class NavFirstHostComponent {
  public readonly cols = COLUMNS;
  public readonly data = PEOPLE;
  public commits: unknown[] = [];

  public rowKey = (row: Person) => row.id;
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

const host = (fixture: ComponentFixture<HostComponent>) => fixture.nativeElement as HTMLElement;
const cells = (fixture: ComponentFixture<HostComponent>) => [
  ...host(fixture).querySelectorAll<HTMLElement>('.et-table-row > .et-table-cell'),
];
const editor = (fixture: ComponentFixture<HostComponent>) => host(fixture).querySelector<HTMLInputElement>('input');

/** Type into the open editor the way the bound control would. */
const type = (fixture: ComponentFixture<HostComponent>, text: string) => {
  const input = editor(fixture);

  if (!input) throw new Error('no editor is open');

  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
};

/** Press a key from inside the open editor, which is where every commit/cancel key comes from. */
const press = (fixture: ComponentFixture<HostComponent>, key: string, modifier?: 'shift') => {
  (editor(fixture) ?? (document.activeElement as HTMLElement))?.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey: modifier === 'shift', bubbles: true }),
  );
  fixture.detectChanges();
};

const startEditing = (fixture: ComponentFixture<HostComponent>, row = 0, column = 0) => {
  fixture.componentInstance.feature().editCell(row, column);
  fixture.detectChanges();

  return fixture;
};

describe('TableInlineEditDirective', () => {
  it('renders nothing differently until a cell is opened', () => {
    const fixture = create();

    expect(editor(fixture)).toBeNull();
    expect(cells(fixture)[0]?.textContent).toContain('Ada');
  });

  it('swaps the cell for the column editor while it is open', () => {
    const fixture = startEditing(create());

    expect(editor(fixture)?.value).toBe('Ada');
    expect(cells(fixture)[0]?.classList).toContain('et-table-cell--editing');
    // Only one cell at a time.
    expect(host(fixture).querySelectorAll('.et-table-cell--editing')).toHaveLength(1);
  });

  it('refuses a column that has no editor template, so Enter can drill in instead', () => {
    const fixture = create();

    expect(fixture.componentInstance.feature().editCell(0, 1)).toBe(false);
    expect(editor(fixture)).toBeNull();
  });

  it('refuses a cell that `editableCell` turns down', () => {
    const fixture = create();

    fixture.componentInstance.editableCell.set((row) => row.id !== 1);
    fixture.detectChanges();

    expect(fixture.componentInstance.feature().editCell(0, 0)).toBe(false);
    expect(fixture.componentInstance.feature().editCell(1, 0)).toBe(true);
  });

  it('does nothing while disabled', () => {
    const fixture = create();

    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.feature().editCell(0, 0)).toBe(false);
  });

  describe('committing', () => {
    it('Enter reports the change and closes the editor', () => {
      const fixture = startEditing(create());

      type(fixture, 'Grace');
      press(fixture, 'Enter');

      expect(fixture.componentInstance.commits).toEqual([
        { row: PEOPLE[0], column: 'name', previous: 'Ada', next: 'Grace' },
      ]);
      expect(editor(fixture)).toBeNull();
    });

    it('does not write to the data — the consumer owns the mutation', () => {
      const fixture = startEditing(create());

      type(fixture, 'Grace');
      press(fixture, 'Enter');

      expect(cells(fixture)[0]?.textContent).toContain('Ada');
      expect(PEOPLE[0]?.name).toBe('Ada');
    });

    it('reports an unchanged value too, rather than guessing what the consumer wants', () => {
      const fixture = startEditing(create());

      press(fixture, 'Enter');

      expect(fixture.componentInstance.commits).toMatchObject([{ previous: 'Ada', next: 'Ada' }]);
    });

    it('opening another cell commits the one that is open', () => {
      const fixture = startEditing(create());

      type(fixture, 'Grace');
      startEditing(fixture, 1, 0);

      expect(fixture.componentInstance.commits).toMatchObject([{ previous: 'Ada', next: 'Grace' }]);
      expect(editor(fixture)?.value).toBe('Bob');
    });
  });

  describe('cancelling', () => {
    it('Escape closes without reporting a change', () => {
      const fixture = startEditing(create());

      type(fixture, 'Grace');
      press(fixture, 'Escape');

      expect(fixture.componentInstance.commits).toEqual([]);
      expect(fixture.componentInstance.cancels).toEqual([{ row: PEOPLE[0], column: 'name' }]);
      expect(editor(fixture)).toBeNull();
    });

    it('reopening the cell starts from the stored value again, not the abandoned draft', () => {
      const fixture = startEditing(create());

      type(fixture, 'Grace');
      press(fixture, 'Escape');
      startEditing(fixture);

      expect(editor(fixture)?.value).toBe('Ada');
    });

    it('a row that leaves the table takes its editor with it', () => {
      const fixture = startEditing(create());

      fixture.componentInstance.data.set(PEOPLE.slice(1));
      fixture.detectChanges();

      expect(editor(fixture)).toBeNull();
      expect(fixture.componentInstance.cancels).toMatchObject([{ column: 'name' }]);
    });
  });

  describe('Tab', () => {
    it('commits and stops at the row edge rather than wrapping into the next row', () => {
      const fixture = startEditing(create());

      type(fixture, 'Grace');
      // `name` is the last editable column of the row (`role` has no editor), so there is nothing to
      // open next — but the commit still happens.
      press(fixture, 'Tab');

      expect(fixture.componentInstance.commits).toMatchObject([{ previous: 'Ada', next: 'Grace' }]);
      expect(editor(fixture)).toBeNull();
    });

    it('Shift+Tab at the first column commits and stays put', () => {
      const fixture = startEditing(create());

      press(fixture, 'Tab', 'shift');

      expect(fixture.componentInstance.commits).toHaveLength(1);
      expect(editor(fixture)).toBeNull();
    });
  });

  describe('with keyboard navigation', () => {
    it('Enter on a focused editable cell opens the editor instead of drilling into it', () => {
      const fixture = create();

      cells(fixture)[0]?.focus();
      fixture.detectChanges();

      cells(fixture)[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(editor(fixture)?.value).toBe('Ada');
    });

    it('Enter on a cell with no editor still drills, so the two features do not fight over the key', () => {
      const fixture = create();
      const cell = cells(fixture)[1];

      cell?.focus();
      fixture.detectChanges();

      cell?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(editor(fixture)).toBeNull();
      // Nothing focusable in a plain text cell, so focus stays where it was.
      expect(document.activeElement).toBe(cell);
    });

    // Both features listen for `keydown` on the table, and Angular — not the template — decides which
    // listener runs first. With navigation first, it opens the editor from the very event that then
    // goes on to reach this feature's own listener, which must not read it as "commit".
    it('survives the order where navigation handles Enter first', () => {
      const fixture = TestBed.createComponent(NavFirstHostComponent);

      fixture.detectChanges();

      const cell = fixture.nativeElement.querySelector('.et-table-row > .et-table-cell') as HTMLElement;

      cell.focus();
      cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
      expect(fixture.componentInstance.commits).toEqual([]);
    });
  });
});
