import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TableComponent } from './table.component';
import { TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

// Deliberately not a template literal: an interpolated one above the inline template below breaks
// Angular language service completions there. See `ethlete/no-template-literal-before-inline-template`.
const MANY: Person[] = Array.from({ length: 100 }, (_, index) => ({
  id: index + 1,
  name: 'Person ' + (index + 1),
  role: 'Viewer',
}));

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    role: { header: 'Role', value: (person) => person.role },
  }) satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table
      [columns]="cols"
      [data]="data"
      [etTableVirtualScroll]="{ estimateRowHeight: 40, overscan: 2, enabled: virtual() }"
    />
  `,
  imports: [TABLE_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS],
})
class HostComponent {
  public virtual = signal(false);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);

  public readonly cols = columns();
  public readonly data = MANY;
}

// jsdom has no layout - back the geometry the virtual window reads with plain values. The feature is
// a directive on the table, so its window is built during the fixture's first render: the stub has to
// be in place before that, which means stubbing the prototype rather than the rendered element.
const VIEWPORT_HEIGHT = 240;
const scrollTops = new WeakMap<Element, number>();
const original = {
  clientHeight: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'),
  scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
};

beforeEach(() => {
  Object.defineProperty(Element.prototype, 'clientHeight', { value: VIEWPORT_HEIGHT, configurable: true });
  Object.defineProperty(Element.prototype, 'scrollTop', {
    get(this: Element) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      scrollTops.set(this, Math.max(0, value));
    },
    configurable: true,
  });
});

afterEach(() => {
  if (original.clientHeight) Object.defineProperty(Element.prototype, 'clientHeight', original.clientHeight);
  if (original.scrollTop) Object.defineProperty(Element.prototype, 'scrollTop', original.scrollTop);
});

const create = (virtual = true) => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.virtual.set(virtual);
  fixture.detectChanges();

  return fixture;
};

const tableElement = (fixture: ComponentFixture<HostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector('et-table') as HTMLElement;

describe('TableVirtualScrollDirective', () => {
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
