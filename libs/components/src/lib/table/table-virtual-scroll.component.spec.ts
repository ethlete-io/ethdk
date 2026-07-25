import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { tableColumns } from './table-columns';
import { TableComponent } from './table.component';
import { TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS } from './table.imports';

type Person = { id: number; name: string; role: string };

const MANY: Person[] = Array.from({ length: 100 }, (_, index) => ({
  id: index + 1,
  name: `Person ${index + 1}`,
  role: 'Viewer',
}));

const columns = () =>
  tableColumns<Person>([
    { key: 'name', header: 'Name', value: (person) => person.name },
    { key: 'role', header: 'Role', value: (person) => person.role },
  ]);

@Component({
  template: `
    <et-table [columns]="cols" [data]="data">
      @if (virtual()) {
        <et-table-virtual-scroll [estimateRowHeight]="40" [overscan]="2" />
      }
    </et-table>
  `,
  imports: [TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS],
})
class HostComponent {
  public virtual = signal(false);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);

  public readonly cols = columns();
  public readonly data = MANY;
}

// jsdom has no layout — back the geometry the virtual window reads with plain values.
const mockScrollGeometry = (host: HTMLElement, viewportHeight: number) => {
  let scrollTop = 0;

  Object.defineProperty(host, 'clientHeight', { value: viewportHeight, configurable: true });
  Object.defineProperty(host, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.max(0, value);
    },
    configurable: true,
  });
};

const create = (virtual = true) => {
  // Render the plain table first so the host element exists, stub its geometry, and only then let the
  // feature build its window — it reads the viewport height as it initialises.
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.virtual.set(false);
  fixture.detectChanges();
  mockScrollGeometry(tableElement(fixture), 240);

  fixture.componentInstance.virtual.set(virtual);
  fixture.detectChanges();

  return fixture;
};

const tableElement = (fixture: ComponentFixture<HostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector('et-table') as HTMLElement;

describe('TableVirtualScrollComponent', () => {
  it('renders every row and keeps a zero index offset without the feature', () => {
    const fixture = create(false);
    const table = fixture.componentInstance.table();

    expect(table.renderedRows()).toHaveLength(100);
    expect(table.rowIndexOffset()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-spacer')).toHaveLength(0);
  });

  it('renders only a window of rows, with spacers standing in for the rest', () => {
    const fixture = create();
    const table = fixture.componentInstance.table();

    // 240px viewport / 40px rows = 6 visible + 2 overscan below, starting at the top
    expect(table.renderedRows().length).toBe(8);
    expect(table.rowIndexOffset()).toBe(0);

    const spacers = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.et-table-spacer')];
    expect(spacers).toHaveLength(2);
    expect((spacers[0] as HTMLElement).style.blockSize).toBe('0px');
    expect((spacers[1] as HTMLElement).style.blockSize).toBe(`${(100 - 8) * 40}px`);
  });

  it('shifts the window and the index offset as the container scrolls', () => {
    const fixture = create();
    const host = tableElement(fixture);

    host.scrollTop = 400;
    host.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    const table = fixture.componentInstance.table();
    const start = table.rowIndexOffset();

    expect(start).toBeGreaterThan(0);
    // the rendered slice lines up with the window over the source rows
    expect(table.renderedRows()[0]).toBe(MANY[start]);
  });
});
