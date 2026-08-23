import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { expectAriaGrid, expectUniformCellsPerRow, resolveAriaOwner } from '../testing/aria-structure';
import { createTableDriver } from './testing/table-driver';
import { TablePageStickyHeaderDirective } from './table-page-sticky-header.directive';
import { TableComponent } from './table.component';
import { TABLE_DRAG_SCROLL_IMPORTS, TABLE_IMPORTS, TABLE_PAGE_STICKY_HEADER_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Alan', role: 'Viewer' },
];

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name, width: '200px' },
    role: { header: 'A much longer role heading', value: (person) => person.role, width: 'auto' },
  }) satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table
      [columns]="cols()"
      [data]="data"
      [etTableDragScroll]="{ enabled: dragScroll() }"
      [etTablePageStickyHeader]="{ enabled: pinned(), offset: offset() }"
    />
  `,
  imports: [TABLE_IMPORTS, TABLE_DRAG_SCROLL_IMPORTS, TABLE_PAGE_STICKY_HEADER_IMPORTS],
})
class HostComponent {
  public pinned = signal(true);
  public dragScroll = signal(false);
  public offset = signal<number | undefined>(undefined);
  public cols = signal(columns());
  public feature = viewChild.required(TablePageStickyHeaderDirective);
  public table = viewChild.required(TableComponent);

  public readonly data = PEOPLE;
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return { driver: createTableDriver(fixture), fixture };
};

describe('TablePageStickyHeaderDirective', () => {
  it('uses the split header and body layout only while enabled', () => {
    const { driver, fixture } = create();
    const host = driver.host();

    expect(host.classList.contains('et-table-host--page-sticky-header')).toBe(true);
    expect(host.getAttribute('role')).toBe('grid');
    expect(host.querySelector('.et-table-header-strip')).not.toBeNull();
    expect(host.querySelector('.et-table-scroller')).not.toBeNull();
    expect(host.querySelector(':scope > .et-table-header-strip > .et-table-header')?.getAttribute('role')).toBe(
      'rowgroup',
    );

    fixture.componentInstance.pinned.set(false);
    fixture.detectChanges();

    expect(host.classList.contains('et-table-host--page-sticky-header')).toBe(false);
    expect(host.getAttribute('role')).toBeNull();
    expect(host.querySelector('.et-table-header-strip')).toBeNull();
    expect(host.querySelector('.et-table-scroller')).toBeNull();
    expect(host.querySelector(':scope > .et-table')?.getAttribute('role')).toBe('grid');
  });

  it('keeps the grid owning its row groups in both layouts', () => {
    const { driver, fixture } = create();
    const host = driver.host();
    const rowgroups = () => Array.from(host.querySelectorAll('[role="rowgroup"]'));

    expectAriaGrid(host);
    expectUniformCellsPerRow(host);
    expect(rowgroups()).toHaveLength(2);
    expect(rowgroups().map((rowgroup) => resolveAriaOwner(rowgroup))).toEqual([host, host]);

    fixture.componentInstance.pinned.set(false);
    fixture.detectChanges();

    const grid = host.querySelector<HTMLElement>(':scope > .et-table')!;

    expectAriaGrid(grid);
    expectUniformCellsPerRow(grid);
  });

  it('shares the body grid tracks with the separate header grid', () => {
    const { driver, fixture } = create();
    const header = driver.query('.et-table-header')!;
    const body = driver.query('.et-table-scroller > .et-table')!;

    fixture.detectChanges();

    expect(header.style.gridTemplateColumns).toBe(body.style.gridTemplateColumns);
  });

  it('publishes the horizontal scroll range when layout changes', () => {
    const { driver, fixture } = create();

    driver.fakeScrollExtent({ scrollWidth: 680, viewportWidth: 320 });

    fixture.componentInstance.cols.set(columns());
    fixture.detectChanges();

    expect(driver.host().style.getPropertyValue('--_et-table-inline-max-scroll')).toBe('360px');
  });

  it('writes a bound offset without replacing the CSS API when none is bound', () => {
    const { driver, fixture } = create();

    expect(driver.host().style.getPropertyValue('--et-table-sticky-header-offset')).toBe('');

    fixture.componentInstance.offset.set(64);
    fixture.detectChanges();

    expect(driver.host().style.getPropertyValue('--et-table-sticky-header-offset')).toBe('64px');
  });

  it('writes the header horizontal position onto the header grid in the same tick as the scroll', () => {
    const { driver } = create();
    const scroller = driver.scroller();
    const headerGrid = driver.query('.et-table-header')!;

    scroller.scrollLeft = 120;
    scroller.dispatchEvent(new Event('scroll'));

    expect(headerGrid.style.getPropertyValue('--_et-table-inline-scroll')).toBe('120px');
    expect(driver.host().style.getPropertyValue('--_et-table-inline-scroll')).toBe('');
  });

  it('lets drag scrolling pan the page-sticky body scroller', () => {
    const { driver, fixture } = create();
    const cell = driver.cell(0, 'role')!;

    driver.fakeScrollExtent({ scrollWidth: 680, viewportWidth: 320 });
    fixture.componentInstance.dragScroll.set(true);
    fixture.componentInstance.cols.set(columns());
    fixture.detectChanges();

    cell.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        pointerType: 'mouse',
      }),
    );
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 100, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 150, clientY: 100, pointerId: 1 }));

    expect(driver.scroller().scrollLeft).toBe(50);
  });

  it('autosizes from the wider of the header and body grids', () => {
    const { driver, fixture } = create();
    const header = driver.headerCell('role')!;
    const body = driver.cell(0, 'role')!;

    Object.defineProperty(header, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 260 }) });
    Object.defineProperty(body, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 140 }) });

    fixture.componentInstance.table().autosizeColumns(['role']);
    fixture.detectChanges();

    expect(fixture.componentInstance.table().columnWidths()['role']).toBe(260);
  });
});
