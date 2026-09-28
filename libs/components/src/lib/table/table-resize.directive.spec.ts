import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DragMoveEvent } from '@ethlete/core';
import { vi } from 'vitest';
import '../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../testing/destroyed-mid-gesture';
import { queryAll } from '../testing/driver-core';
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
  it('stops resizing when the table is destroyed mid-drag', async () => {
    const fixture = create();
    const grip = queryAll(fixture, '.et-table-resize-grip')[0]!;

    await expectNothingRunsAfterDestroy({
      fixture,
      start: () => {
        grip.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: 100,
            clientY: 10,
            pointerId: 1,
            pointerType: 'mouse',
          }),
        );
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 10, pointerId: 1 }));
      },
    });
  });

  it('renders a grip in every header cell while there is more than one column', () => {
    const fixture = create();

    expect(queryAll(fixture, '.et-table-resize-grip')).toHaveLength(2);
  });

  it('writes a width override while dragging', () => {
    const fixture = create();
    const resize = fixture.componentInstance.feature();

    resize.start(columnMeta(fixture, 'name'));
    resize.update(move(40));
    resize.end();

    expect(fixture.componentInstance.table().hasColumnWidthOverride('name')).toBe(true);
  });

  it('widens the column on a drag toward the inline end in a right-to-left table', () => {
    const fixture = create();
    const resize = fixture.componentInstance.feature();
    const table = fixture.componentInstance.table();
    const widthOf = () => table.state().columns.find((column) => column.key === 'name')?.width;

    queryAll(fixture, 'et-table')[0]!.style.direction = 'rtl';
    table.setColumnWidth('name', 300);
    vi.spyOn(table, 'renderedColumnWidth').mockReturnValue(300);

    resize.start(columnMeta(fixture, 'name'));
    resize.update(move(-40));
    resize.end();

    expect(widthOf()).toBe(340);
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

  describe('from the keyboard', () => {
    const setUp = (options: { minWidth?: number } = {}) => {
      const fixture = TestBed.createComponent(HostComponent);
      const cols = columns();

      fixture.componentInstance.cols.set({ ...cols, name: { ...cols.name, minWidth: options.minWidth } });
      fixture.detectChanges();

      const table = fixture.componentInstance.table();

      Object.defineProperty(table.scrollElement(), 'clientWidth', { configurable: true, value: 800 });
      vi.spyOn(table, 'renderedColumnWidth').mockReturnValue(200);

      const grip = queryAll(fixture, '.et-table-resize-grip')[0]!;
      const press = (key: string, init: KeyboardEventInit = {}) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

        grip.dispatchEvent(event);
        fixture.detectChanges();

        return event;
      };
      const width = () => table.state().columns.find((column) => column.key === 'name')?.width;

      grip.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      return { fixture, table, grip, press, width };
    };

    it('is a focusable vertical separator named from the table labels', () => {
      const { grip } = setUp();

      expect(grip.getAttribute('role')).toBe('separator');
      expect(grip.getAttribute('aria-orientation')).toBe('vertical');
      expect(grip.getAttribute('tabindex')).toBe('0');
      expect(grip.getAttribute('aria-hidden')).toBeNull();
      expect(grip.getAttribute('aria-label')).toBe('Resize Name');
    });

    it('reports the column width and its range in px', () => {
      const { grip } = setUp({ minWidth: 120 });

      expect(grip.getAttribute('aria-valuenow')).toBe('200');
      expect(grip.getAttribute('aria-valuemin')).toBe('120');
      expect(grip.getAttribute('aria-valuemax')).toBe('800');
    });

    it('steps the width with the arrow keys, further with Shift', () => {
      const { grip, press, width } = setUp();

      expect(press('ArrowRight').defaultPrevented).toBe(true);
      expect(width()).toBe(210);

      press('ArrowRight', { shiftKey: true });
      expect(width()).toBe(260);

      press('ArrowLeft');
      expect(width()).toBe(250);
      expect(grip.getAttribute('aria-valuenow')).toBe('250');
    });

    it('goes to the minimum with Home and the maximum with End', () => {
      const { press, width } = setUp({ minWidth: 120 });

      press('Home');
      expect(width()).toBe(120);

      press('End');
      expect(width()).toBe(800);
    });

    it('widens the column with ArrowLeft in a right-to-left table', () => {
      const { fixture, press, width } = setUp();

      queryAll(fixture, 'et-table')[0]!.style.direction = 'rtl';
      press('ArrowLeft');

      expect(width()).toBe(210);
    });

    it('leaves every other key alone', () => {
      const { press, table } = setUp();

      expect(press('ArrowDown').defaultPrevented).toBe(false);
      expect(press('Enter').defaultPrevented).toBe(false);
      expect(table.hasColumnWidthOverride('name')).toBe(false);
    });
  });
});
