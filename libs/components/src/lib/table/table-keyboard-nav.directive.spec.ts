import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import '../../test-helpers';
import { query, queryAll } from '../testing/driver-core';
import { TableKeyboardNavDirective } from './table-keyboard-nav.directive';
import {
  TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
  TABLE_IMPORTS,
  TABLE_KEYBOARD_NAV_IMPORTS,
  TABLE_ROW_EXPANSION_IMPORTS,
  TABLE_SELECTION_IMPORTS,
} from './table.imports';
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
    <et-table
      [columns]="cols"
      [data]="data()"
      [rowKey]="rowKey"
      [etTableKeyboardNav]="{ enabled: enabled() }"
      (rowClick)="clicks.push($event)"
      rowInteractive
    >
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
  public clicks: Person[] = [];

  public rowKey = (row: Person) => row.id;
}

@Component({
  template: `
    <et-table
      [columns]="cols"
      [data]="people"
      [rowKey]="rowKey"
      [cellState]="cellState"
      [expandedRowTemplate]="detail"
      [etTableKeyboardNav]="{ enabled: enabled() }"
      [etTableSelection]="{ selection: selection }"
      [etTableRowExpansion]="{ expanded: expanded }"
      etTableCellErrorTooltip
    >
      <ng-template #detail let-person>{{ person.role }}</ng-template>
    </et-table>
  `,
  imports: [
    TABLE_IMPORTS,
    TABLE_KEYBOARD_NAV_IMPORTS,
    TABLE_SELECTION_IMPORTS,
    TABLE_ROW_EXPANSION_IMPORTS,
    TABLE_CELL_ERROR_TOOLTIP_IMPORTS,
  ],
})
class UtilityHostComponent {
  public readonly cols = COLUMNS;
  public readonly people = PEOPLE;
  public enabled = signal(true);
  public selection = signal<Set<unknown>>(new Set());
  public expanded = signal<Set<unknown>>(new Set());
  public feature = viewChild.required(TableKeyboardNavDirective);

  public rowKey = (row: Person) => row.id;
  public cellState = (row: Person, key: string) =>
    row.id === 2 && key === 'role' ? { state: 'error' as const, message: 'Could not save' } : null;
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

const cells = (fixture: ComponentFixture<HostComponent>) => queryAll(fixture, '.et-table-row > .et-table-cell');

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

  it('carries the grid roles only while it answers the arrow keys', () => {
    const fixture = create();
    const grid = () => queryAll(fixture, '.et-table')[0];

    expect(grid()?.getAttribute('role')).toBe('grid');
    expect(cells(fixture).every((cell) => cell.getAttribute('role') === 'gridcell')).toBe(true);

    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();

    expect(grid()?.getAttribute('role')).toBe('table');
    expect(cells(fixture).every((cell) => cell.getAttribute('role') === 'cell')).toBe(true);
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

    it('swaps ArrowLeft and ArrowRight in a right-to-left table', () => {
      const fixture = start();

      queryAll(fixture, 'et-table')[0]!.style.direction = 'rtl';

      press(fixture, 'ArrowLeft');
      expect(focused(fixture)).toMatchObject({ row: 0, column: 1 });

      press(fixture, 'ArrowRight');
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

  describe('while drilled into a cell', () => {
    const drilledIn = () => {
      const fixture = create();
      const button = cells(fixture)[1]!.querySelector<HTMLButtonElement>('button')!;

      button.focus();
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

  describe('on a rowInteractive table', () => {
    // jsdom lays nothing out; `getFocusableElements` reads a client rect to tell a rendered control apart
    // from a hidden one.
    beforeEach(() => {
      vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const focusedOn = (index: number) => {
      const fixture = create();

      cells(fixture)[index]?.focus();
      fixture.detectChanges();

      return fixture;
    };

    it('Enter on a cell holding a control drills into it without activating the row', () => {
      const fixture = focusedOn(1);

      press(fixture, 'Enter');

      expect(document.activeElement?.tagName).toBe('BUTTON');
      expect(fixture.componentInstance.clicks).toEqual([]);
    });

    it('Enter on a cell with nothing to open activates the row', () => {
      const fixture = focusedOn(0);

      press(fixture, 'Enter');

      expect(fixture.componentInstance.clicks).toEqual([PEOPLE[0]]);
      expect(focused(fixture)).toMatchObject({ row: 0, column: 0, onCell: true });
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

    expect(queryAll(fixture, '.et-table-row').length).toBeGreaterThan(0);
    expect(queryAll(fixture, '.et-table-row[tabindex]')).toHaveLength(0);
  });

  describe('with utility columns', () => {
    // Selection leads, then the expander, then the two data columns.
    const COLUMN_COUNT = 4;

    const createUtility = () => {
      const fixture = TestBed.createComponent(UtilityHostComponent);

      fixture.detectChanges();

      return fixture;
    };

    const bodyCells = (fixture: ComponentFixture<UtilityHostComponent>) =>
      queryAll(fixture, '.et-table-row > .et-table-cell');

    const checkboxes = (fixture: ComponentFixture<UtilityHostComponent>) =>
      queryAll(fixture, '.et-table-row et-checkbox');

    const expanders = (fixture: ComponentFixture<UtilityHostComponent>) => queryAll(fixture, '.et-table-expander');

    const tabbable = (fixture: ComponentFixture<UtilityHostComponent>) =>
      queryAll(fixture, '.et-table-row [tabindex]').filter((element) => element.getAttribute('tabindex') !== '-1');

    const pressOn = (fixture: ComponentFixture<UtilityHostComponent>, key: string) => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    it('leaves the body a single tab stop, on the first row checkbox', () => {
      const fixture = createUtility();

      expect(checkboxes(fixture)).toHaveLength(PEOPLE.length);
      expect(tabbable(fixture)).toEqual([checkboxes(fixture)[0]]);
    });

    it('takes the error mark out of the tab order', () => {
      const fixture = createUtility();
      const mark = query(fixture, '.et-table-cell-error-icon');

      expect(mark?.getAttribute('tabindex')).toBe('-1');
    });

    it('reaches the checkbox and the expander with the arrow keys', () => {
      const fixture = createUtility();

      bodyCells(fixture)[2]?.focus();
      fixture.detectChanges();

      pressOn(fixture, 'ArrowLeft');
      expect(document.activeElement).toBe(expanders(fixture)[0]);

      pressOn(fixture, 'ArrowLeft');
      expect(document.activeElement).toBe(checkboxes(fixture)[0]);

      pressOn(fixture, 'ArrowDown');
      expect(document.activeElement).toBe(checkboxes(fixture)[1]);
      expect(tabbable(fixture)).toEqual([checkboxes(fixture)[1]]);

      pressOn(fixture, 'ArrowRight');
      pressOn(fixture, 'ArrowRight');
      expect(document.activeElement).toBe(bodyCells(fixture)[COLUMN_COUNT + 2]);
    });

    it('counts the utility columns in activeCell and focusCell', () => {
      const fixture = createUtility();
      const feature = fixture.componentInstance.feature();

      feature.focusCell({ row: 1, column: 3 });
      fixture.detectChanges();

      expect(document.activeElement).toBe(bodyCells(fixture)[COLUMN_COUNT + 3]);
      expect(feature.activeCell()).toEqual({ row: 1, column: 3 });

      feature.focusCell({ row: 0, column: 1 });
      fixture.detectChanges();

      expect(document.activeElement).toBe(expanders(fixture)[0]);
      expect(feature.activeCell()).toEqual({ row: 0, column: 1 });
    });

    it('leaves Enter to the expander button', () => {
      const fixture = createUtility();

      fixture.componentInstance.feature().focusCell({ row: 0, column: 1 });
      fixture.detectChanges();

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

      document.activeElement?.dispatchEvent(enter);

      expect(enter.defaultPrevented).toBe(false);
    });

    it('drills into the error mark with Enter', () => {
      vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);

      const fixture = createUtility();

      fixture.componentInstance.feature().focusCell({ row: 1, column: 3 });
      fixture.detectChanges();
      pressOn(fixture, 'Enter');

      expect(document.activeElement).toBe(query(fixture, '.et-table-cell-error-icon'));

      vi.restoreAllMocks();
    });

    it('gives the controls their tab stops back when disabled', () => {
      const fixture = createUtility();

      fixture.componentInstance.enabled.set(false);
      fixture.detectChanges();

      expect(checkboxes(fixture).every((checkbox) => checkbox.getAttribute('tabindex') === '0')).toBe(true);
      expect(expanders(fixture).every((button) => button.getAttribute('tabindex') !== '-1')).toBe(true);
      expect(query(fixture, '.et-table-cell-error-icon')?.getAttribute('tabindex')).toBe('0');
    });
  });
});
