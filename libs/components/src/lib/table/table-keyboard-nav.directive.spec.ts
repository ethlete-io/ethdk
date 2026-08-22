import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TableKeyboardNavDirective } from './table-keyboard-nav.directive';
import { TABLE_IMPORTS, TABLE_KEYBOARD_NAV_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Bob', role: 'Editor' },
  { id: 3, name: 'Charlie', role: 'Viewer' },
];

const COLUMNS = {
  name: { header: 'Name', value: (person) => person.name },
  role: { header: 'Role', value: (person) => person.role },
} satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table [columns]="cols" [data]="data()" [rowKey]="rowKey" [etTableKeyboardNav]="{ enabled: enabled() }">
      <!-- A cell with something focusable in it, so Enter has somewhere to drill. -->
      <ng-template [etTableCell]="cols.role" let-value>
        <button type="button">{{ value }}</button>
      </ng-template>
    </et-table>
  `,
  imports: [TABLE_IMPORTS, TABLE_KEYBOARD_NAV_IMPORTS],
})
class HostComponent {
  public readonly cols = COLUMNS;
  public data = signal<Person[]>(PEOPLE);
  public enabled = signal(true);
  public feature = viewChild.required(TableKeyboardNavDirective);

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

/** The focused cell as `row,column` text, so an expectation reads like the grid. */
const focused = (fixture: ComponentFixture<HostComponent>) => {
  const all = cells(fixture);
  const active = document.activeElement as HTMLElement | null;
  const cell = all.find((candidate) => candidate === active || candidate.contains(active));

  if (!cell) return null;

  const index = all.indexOf(cell);

  return { row: Math.floor(index / 2), column: index % 2, onCell: cell === active };
};

const press = (fixture: ComponentFixture<HostComponent>, key: string, modifier?: 'ctrl') => {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key, ctrlKey: modifier === 'ctrl', bubbles: true }),
  );
  fixture.detectChanges();
};

describe('TableKeyboardNavDirective', () => {
  it('makes the body one tab stop: exactly one cell is tabbable, the rest are -1', () => {
    const fixture = create();
    const all = cells(fixture);

    expect(all.filter((cell) => cell.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(all.every((cell) => cell.hasAttribute('tabindex'))).toBe(true);
  });

  it('does not make cells focusable while disabled', () => {
    const fixture = create();

    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();

    expect(cells(fixture).length).toBeGreaterThan(0);
    expect(cells(fixture).some((cell) => cell.hasAttribute('tabindex'))).toBe(false);
  });

  it('starts its tab stop on the first cell', () => {
    const fixture = create();

    expect(cells(fixture)[0]?.getAttribute('tabindex')).toBe('0');
  });

  describe('moving', () => {
    const start = () => {
      const fixture = create();

      cells(fixture)[0]?.focus();
      fixture.detectChanges();

      return fixture;
    };

    it('moves right and left with the arrows', () => {
      const fixture = start();

      press(fixture, 'ArrowRight');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 1 });

      press(fixture, 'ArrowLeft');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 0 });
    });

    it('moves down and up with the arrows', () => {
      const fixture = start();

      press(fixture, 'ArrowDown');
      expect(focused(fixture)).toMatchObject({ row: 1, column: 0 });

      press(fixture, 'ArrowUp');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 0 });
    });

    it('clamps at the edges instead of wrapping', () => {
      const fixture = start();

      press(fixture, 'ArrowUp');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 0 });

      press(fixture, 'ArrowLeft');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 0 });
    });

    it('takes Home and End to the row bounds', () => {
      const fixture = start();

      press(fixture, 'ArrowDown');
      press(fixture, 'End');
      expect(focused(fixture)).toMatchObject({ row: 1, column: 1 });

      press(fixture, 'Home');
      expect(focused(fixture)).toMatchObject({ row: 1, column: 0 });
    });

    it('takes Ctrl+Home and Ctrl+End to the grid bounds', () => {
      const fixture = start();

      press(fixture, 'End', 'ctrl');
      expect(focused(fixture)).toMatchObject({ row: PEOPLE.length - 1, column: 1 });

      press(fixture, 'Home', 'ctrl');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 0 });
    });

    it('carries the single tab stop along', () => {
      const fixture = start();

      press(fixture, 'ArrowDown');
      press(fixture, 'ArrowRight');

      const tabbable = cells(fixture).filter((cell) => cell.getAttribute('tabindex') === '0');

      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]).toBe(document.activeElement);
    });

    it('ignores keys it does not own', () => {
      const fixture = start();

      press(fixture, 'a');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 0, onCell: true });
    });
  });

  // Enter itself resolves the cell's focusable content through `getFocusableElements`, which filters on
  // `getClientRects()` - always empty in jsdom, so the drill-*in* step is verified in a real browser
  // (`components-data-display-table--keyboard-navigation`). What is asserted here is the state it leads
  // to: with focus inside a cell, the keys belong to the control and Escape is the way back out.
  describe('while drilled into a cell', () => {
    const drilledIn = () => {
      const fixture = create();
      const button = cells(fixture)[1]?.querySelector('button');

      button?.focus();
      fixture.detectChanges();

      return fixture;
    };

    it('leaves the arrows to the control', () => {
      const fixture = drilledIn();

      press(fixture, 'ArrowDown');

      expect(document.activeElement?.tagName).toBe('BUTTON');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 1, onCell: false });
    });

    it('Escape comes back out to the cell', () => {
      const fixture = drilledIn();

      press(fixture, 'Escape');

      expect(focused(fixture)).toMatchObject({ row: 0, column: 1, onCell: true });
    });

    it('the cell is still the grid tab stop, so Tab leaves the table rather than the cell', () => {
      const fixture = drilledIn();

      const tabbable = cells(fixture).filter((cell) => cell.getAttribute('tabindex') === '0');

      expect(tabbable).toHaveLength(1);
      expect(tabbable[0]).toBe(cells(fixture)[1]);
    });
  });

  it('follows focus that arrives by click, so the arrows continue from there', () => {
    const fixture = create();

    cells(fixture)[3]?.focus();
    fixture.detectChanges();

    press(fixture, 'ArrowLeft');

    expect(focused(fixture)).toMatchObject({ row: 1, column: 0 });
  });

  it('suppresses the row tab stop, so the body has only one', () => {
    const fixture = create();

    expect(host(fixture).querySelectorAll('.et-table-row[tabindex]')).toHaveLength(0);
  });
});
