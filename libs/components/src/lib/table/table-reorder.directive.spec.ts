import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { tick } from '../testing/driver-core';
import '../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../testing/destroyed-mid-gesture';
import { createTableDriver } from './testing/table-driver';
import { TABLE_IMPORTS, TABLE_REORDER_IMPORTS } from './table.imports';
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
  template: `<et-table [columns]="cols()" [data]="data()" etTableReorder />`,
  imports: [TABLE_IMPORTS, TABLE_REORDER_IMPORTS],
})
class HostComponent {
  public cols = signal<TableColumns<Person>>(columns());
  public data = signal<Person[]>(PEOPLE);
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return { driver: createTableDriver(fixture), fixture };
};

describe('TableReorderDirective', () => {
  it('scrolls the table under a drag held past its trailing edge', async () => {
    const { driver } = create();

    driver.makeScrollable();
    driver.grabColumn('name').moveTo(400);

    const firstFrame = driver.scroller().scrollLeft;

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(firstFrame).toBeGreaterThan(0);
    expect(driver.scroller().scrollLeft).toBeGreaterThan(firstFrame);
  });

  it('stops the edge auto-scroll loop when the table is destroyed mid-drag', async () => {
    const { driver, fixture } = create();

    driver.makeScrollable();

    const activity = await expectNothingRunsAfterDestroy({
      fixture,
      start: () => driver.grabColumn('name').moveTo(400),
    });

    expect(activity.framesRun).toBeGreaterThan(0);
  });

  it('commits the drop, so the table renders the landing order', () => {
    const { driver } = create();

    expect(driver.columnKeys()).toEqual(['name', 'role']);

    const drag = driver.grabColumn('role');

    drag.moveOver('name', 'before');
    drag.drop();

    expect(driver.columnKeys()).toEqual(['role', 'name']);
    expect(driver.rowTexts()).toEqual([
      ['Admin', 'Ada'],
      ['Editor', 'Bob'],
    ]);
  });

  it('drops a column on the trailing side of the one it is held over', () => {
    const { driver } = create();
    const drag = driver.grabColumn('name');

    drag.moveOver('role', 'after');
    drag.drop();

    expect(driver.columnKeys()).toEqual(['role', 'name']);
    expect(driver.rowTexts()).toEqual([
      ['Admin', 'Ada'],
      ['Editor', 'Bob'],
    ]);
  });

  it('previews the landing order under the drag, and drops the preview once it has committed', () => {
    const { driver } = create();
    const drag = driver.grabColumn('role');

    drag.moveOver('name', 'before');

    const ghost = driver.query('.et-table-drag-ghost');

    expect(ghost?.textContent?.trim()).toBe('Role');
    expect(driver.headerCell('role')?.classList.contains('et-table-header-cell--dragging')).toBe(true);
    expect(driver.headerCell('role')?.style.transform).toBe('translateX(-200px)');
    expect(driver.headerCell('name')?.style.transform).toBe('translateX(200px)');
    expect(driver.cell(0, 'name')?.style.transform).toBe('translateX(200px)');

    drag.drop();

    expect(driver.query('.et-table-drag-ghost')).toBeNull();
    expect(driver.headerCell('role')?.classList.contains('et-table-header-cell--dragging')).toBe(false);
    expect(driver.headerCell('role')?.style.transform).toBe('');
    expect(driver.headerCell('name')?.style.transform).toBe('');
    expect(driver.cell(0, 'name')?.style.transform).toBe('');
  });

  it('reverts a gesture the browser cancels, rather than dropping where the pointer stood', () => {
    const { driver } = create();
    const drag = driver.grabColumn('role');

    drag.moveOver('name', 'before');
    drag.cancel();

    expect(driver.columnKeys()).toEqual(['name', 'role']);
    expect(driver.headerCell('role')?.classList.contains('et-table-header-cell--dragging')).toBe(false);
  });

  it('leaves the order alone when the pointer is released before the drag threshold', () => {
    const { driver } = create();
    const drag = driver.grabColumn('role');

    drag.moveTo(304);
    drag.drop();

    expect(driver.query('.et-table-drag-ghost')).toBeNull();
    expect(driver.columnKeys()).toEqual(['name', 'role']);
  });

  describe('on touch', () => {
    const TOUCH = { pointerType: 'touch' } as const;

    const touchMove = (cell: HTMLElement) => {
      const move = new Event('touchmove', { bubbles: true, cancelable: true });

      cell.dispatchEvent(move);

      return move;
    };

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const hold = () => {
      vi.advanceTimersByTime(400);
      tick();
    };

    it('starts the reorder after a long press, showing the ghost before the finger moves', () => {
      const { driver } = create();
      const drag = driver.grabColumn('role', TOUCH);

      expect(driver.query('.et-table-drag-ghost')).toBeNull();

      hold();

      expect(driver.query('.et-table-drag-ghost')?.textContent?.trim()).toBe('Role');

      drag.moveOver('name', 'before');
      drag.drop();

      expect(driver.columnKeys()).toEqual(['role', 'name']);
    });

    it('leaves a touch that moves before the hold elapses to the browser as a scroll', () => {
      const { driver } = create();
      const drag = driver.grabColumn('role', TOUCH);

      drag.moveOver('name', 'before');
      hold();

      expect(driver.query('.et-table-drag-ghost')).toBeNull();
      expect(touchMove(driver.headerCell('role')!).defaultPrevented).toBe(false);

      drag.drop();

      expect(driver.columnKeys()).toEqual(['name', 'role']);
    });

    it('blocks native scrolling only while a long-pressed reorder is active', () => {
      const { driver } = create();
      const cell = driver.headerCell('role')!;
      const drag = driver.grabColumn('role', TOUCH);

      expect(touchMove(cell).defaultPrevented).toBe(false);

      hold();

      expect(touchMove(cell).defaultPrevented).toBe(true);

      drag.drop();

      expect(touchMove(cell).defaultPrevented).toBe(false);
    });

    it('suppresses the long-press context menu on the held header', () => {
      const { driver } = create();
      const cell = driver.headerCell('role')!;

      driver.grabColumn('role', TOUCH);
      hold();

      const menu = new Event('contextmenu', { bubbles: true, cancelable: true });

      cell.dispatchEvent(menu);

      expect(menu.defaultPrevented).toBe(true);
    });

    it('reverts a long press lifted without moving', () => {
      const { driver } = create();
      const drag = driver.grabColumn('role', TOUCH);

      hold();
      drag.drop();

      expect(driver.query('.et-table-drag-ghost')).toBeNull();
      expect(driver.columnKeys()).toEqual(['name', 'role']);
    });

    it('drops the pending hold when the table is destroyed', () => {
      const { driver, fixture } = create();

      driver.grabColumn('role', TOUCH);
      fixture.destroy();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps a mouse drag immediate, with no hold', () => {
      const { driver } = create();
      const drag = driver.grabColumn('role');

      drag.moveOver('name', 'before');

      expect(driver.query('.et-table-drag-ghost')).not.toBeNull();

      drag.drop();

      expect(driver.columnKeys()).toEqual(['role', 'name']);
    });
  });
});
