import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { TablePageStickyHeaderDirective } from './table-page-sticky-header.directive';
import { TABLE_IMPORTS, TABLE_PAGE_STICKY_HEADER_IMPORTS } from './table.imports';
import { TableColumns } from './table.types';

type Person = { id: number; name: string; role: string };

const PEOPLE: Person[] = [
  { id: 1, name: 'Ada', role: 'Admin' },
  { id: 2, name: 'Alan', role: 'Viewer' },
];

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    role: { header: 'Role', value: (person) => person.role },
  }) satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table [columns]="cols" [data]="data" [etTablePageStickyHeader]="{ enabled: pinned(), offset: offset() }" />
  `,
  imports: [TABLE_IMPORTS, TABLE_PAGE_STICKY_HEADER_IMPORTS],
})
class HostComponent {
  public pinned = signal(true);
  public offset = signal(0);
  public feature = viewChild.required(TablePageStickyHeaderDirective);

  public readonly cols = columns();
  public readonly data = PEOPLE;
}

// jsdom has no layout, so the boxes the travel is measured from are stubbed: a grid 900 tall starting
// 200 below the top of the page, whose header row is the first 40 of it.
const HEADER_HEIGHT = 40;
const GRID_HEIGHT = 900;
let gridTop = 200;

const originals = {
  rect: Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect'),
  offsetTop: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop'),
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
};

const define = (target: object, name: string, descriptor: PropertyDescriptor) =>
  Object.defineProperty(target, name, { configurable: true, ...descriptor });

beforeEach(() => {
  gridTop = 200;

  define(Element.prototype, 'getBoundingClientRect', { value: () => ({ top: gridTop }) as DOMRect });
  define(HTMLElement.prototype, 'offsetTop', { get: () => 0 });
  define(HTMLElement.prototype, 'offsetHeight', {
    get(this: HTMLElement) {
      return this.classList.contains('et-table') ? GRID_HEIGHT : HEADER_HEIGHT;
    },
  });
});

afterEach(() => {
  if (originals.rect) define(Element.prototype, 'getBoundingClientRect', originals.rect);
  if (originals.offsetTop) define(HTMLElement.prototype, 'offsetTop', originals.offsetTop);
  if (originals.offsetHeight) define(HTMLElement.prototype, 'offsetHeight', originals.offsetHeight);
});

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  return fixture;
};

const hostOf = (fixture: ComponentFixture<HostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.et-table-host')!;

const rangeOf = (fixture: ComponentFixture<HostComponent>) => {
  const host = hostOf(fixture);

  return {
    travel: host.style.getPropertyValue('--_et-table-page-header-travel'),
    from: host.style.getPropertyValue('--_et-table-page-header-from'),
    to: host.style.getPropertyValue('--_et-table-page-header-to'),
  };
};

describe('TablePageStickyHeaderDirective', () => {
  it('marks the table, and stops marking it when turned off', () => {
    const fixture = create();

    expect(hostOf(fixture).classList.contains('et-table-host--page-sticky-header')).toBe(true);

    fixture.componentInstance.pinned.set(false);
    fixture.detectChanges();

    expect(hostOf(fixture).classList.contains('et-table-host--page-sticky-header')).toBe(false);
  });

  it('runs the header from where the table meets the top of the page to the last row', () => {
    const fixture = create();

    // 860: the grid's height less the header's own, which is as far as the header can go before it
    // would leave the table. It starts travelling the moment the table's top reaches the viewport.
    expect(rangeOf(fixture)).toEqual({ travel: '860px', from: '200px', to: '1060px' });
  });

  it('starts the travel earlier by the offset, so the header stops under whatever is pinned above it', () => {
    const fixture = create();

    fixture.componentInstance.offset.set(64);
    fixture.detectChanges();

    expect(rangeOf(fixture)).toEqual({ travel: '860px', from: '136px', to: '996px' });
  });

  it('moves the header nowhere while it is turned off', () => {
    const fixture = create();

    fixture.componentInstance.pinned.set(false);
    fixture.detectChanges();

    expect(rangeOf(fixture)).toEqual({ travel: '0px', from: '0px', to: '0px' });
  });
});
