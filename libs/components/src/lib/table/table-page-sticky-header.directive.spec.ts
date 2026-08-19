import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
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

  return fixture;
};

const hostOf = (fixture: ComponentFixture<HostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.et-table-host')!;

describe('TablePageStickyHeaderDirective', () => {
  it('uses the split header and body layout only while enabled', () => {
    const fixture = create();
    const host = hostOf(fixture);

    expect(host.classList.contains('et-table-host--page-sticky-header')).toBe(true);
    expect(host.getAttribute('role')).toBe('grid');
    expect(host.querySelector('.et-table-header-strip')).not.toBeNull();
    expect(host.querySelector('.et-table-scroller')).not.toBeNull();
    expect(host.querySelector('.et-table-header')?.getAttribute('role')).toBe('rowgroup');

    fixture.componentInstance.pinned.set(false);
    fixture.detectChanges();

    expect(host.classList.contains('et-table-host--page-sticky-header')).toBe(false);
    expect(host.getAttribute('role')).toBeNull();
    expect(host.querySelector('.et-table-header-strip')).toBeNull();
    expect(host.querySelector('.et-table-scroller')).toBeNull();
    expect(host.querySelector(':scope > .et-table')?.getAttribute('role')).toBe('grid');
  });

  it('shares the body grid tracks with the separate header grid', () => {
    const fixture = create();
    const host = hostOf(fixture);
    const header = host.querySelector<HTMLElement>('.et-table-header')!;
    const body = host.querySelector<HTMLElement>('.et-table-scroller > .et-table')!;

    fixture.detectChanges();

    expect(header.style.gridTemplateColumns).toBe(body.style.gridTemplateColumns);
  });

  it('publishes the horizontal scroll range when layout changes', () => {
    const fixture = create();
    const host = hostOf(fixture);
    const scroller = host.querySelector<HTMLElement>('.et-table-scroller')!;

    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 680 });
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 320 });

    fixture.componentInstance.cols.set(columns());
    fixture.detectChanges();

    expect(host.style.getPropertyValue('--_et-table-inline-max-scroll')).toBe('360px');
  });

  it('writes a bound offset without replacing the CSS API when none is bound', () => {
    const fixture = create();
    const host = hostOf(fixture);

    expect(host.style.getPropertyValue('--et-table-sticky-header-offset')).toBe('');

    fixture.componentInstance.offset.set(64);
    fixture.detectChanges();

    expect(host.style.getPropertyValue('--et-table-sticky-header-offset')).toBe('64px');
  });

  it('writes the header horizontal position onto the header grid in the same tick as the scroll', () => {
    const fixture = create();
    const host = hostOf(fixture);
    const scroller = host.querySelector<HTMLElement>('.et-table-scroller')!;
    const headerGrid = host.querySelector<HTMLElement>('.et-table-header')!;

    scroller.scrollLeft = 120;
    scroller.dispatchEvent(new Event('scroll'));

    expect(headerGrid.style.getPropertyValue('--_et-table-inline-scroll')).toBe('120px');
    expect(host.style.getPropertyValue('--_et-table-inline-scroll')).toBe('');
  });

  it('lets drag scrolling pan the page-sticky body scroller', () => {
    const fixture = create();
    const host = hostOf(fixture);
    const scroller = host.querySelector<HTMLElement>('.et-table-scroller')!;
    const cell = host.querySelector<HTMLElement>('.et-table-cell[data-col-key="role"]')!;

    Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 680 });
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 320 });
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

    expect(scroller.scrollLeft).toBe(50);
  });

  it('autosizes from the wider of the header and body grids', () => {
    const fixture = create();
    const table = fixture.componentInstance.table();
    const header = table.headerCellElements().find((cell) => cell.dataset['colKey'] === 'role')!;
    const body = table.bodyCellElementsFor('role')[0]!;

    Object.defineProperty(header, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 260 }) });
    Object.defineProperty(body, 'getBoundingClientRect', { configurable: true, value: () => ({ width: 140 }) });

    table.autosizeColumns(['role']);
    fixture.detectChanges();

    expect(table.columnWidths()['role']).toBe(260);
  });
});
