import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { queryAll } from '../testing/driver-core';
import { sortRows } from './headless/table-sort';
import { createTableDriver } from './testing/table-driver';
import { TableRowExpansionDirective } from './table-row-expansion.directive';
import { TableComponent } from './table.component';
import { TABLE_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS } from './table.imports';
import { TableColumns, TableSort } from './table.types';

type Person = { id: number; name: string; score: number };

const people = (): Person[] => [
  { id: 3, name: 'Charlie', score: 30 },
  { id: 1, name: 'Ada', score: 10 },
  { id: 2, name: 'Bob', score: 20 },
];

const columns = () =>
  ({
    name: { header: 'Name', value: (person) => person.name },
    score: { header: 'Score', value: (person) => person.score },
  }) satisfies TableColumns<Person>;

@Component({
  template: `
    <et-table
      [(sort)]="sort"
      [columns]="cols"
      [data]="data()"
      [rowKey]="rowKey"
      [expandedRowTemplate]="detail"
      [etTableRowExpansion]="{ expanded: expanded }"
      [etTableVirtualScroll]="{ estimateRowHeight: 40, overscan: 2, enabled: virtual() }"
    >
      <ng-template #detail let-person>detail {{ person.name }}</ng-template>
    </et-table>
  `,
  imports: [TABLE_IMPORTS, TABLE_ROW_EXPANSION_IMPORTS, TABLE_VIRTUAL_SCROLL_IMPORTS],
})
class HostComponent {
  public readonly cols = columns();
  public data = signal<Person[]>(people());
  public sort = signal<TableSort[]>([]);
  public expanded = signal<Set<unknown>>(new Set());
  public virtual = signal(false);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);
  public expansion = viewChild.required<TableRowExpansionDirective<Person>>(TableRowExpansionDirective);

  public rowKey = (row: Person) => row.id;
}

let viewportHeight = 240;
const scrollTops = new WeakMap<Element, number>();
const original = {
  clientHeight: Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight'),
  scrollTop: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
};

beforeEach(() => {
  viewportHeight = 240;
  Object.defineProperty(Element.prototype, 'clientHeight', { get: () => viewportHeight, configurable: true });
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

const create = (setup?: (host: HostComponent) => void) => {
  const fixture = TestBed.createComponent(HostComponent);
  setup?.(fixture.componentInstance);
  fixture.detectChanges();

  return fixture;
};

const renderedNames = (fixture: ComponentFixture<HostComponent>) =>
  fixture.componentInstance
    .table()
    .renderedRows()
    .map((row) => row.name);

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: index + 1, name: 'Person ' + (index + 1), score: index }));

describe('table edge cases', { timeout: 30_000 }, () => {
  describe('empty rows', () => {
    it('renders no body rows and no detail rows for empty data, even with a row expanded', () => {
      const fixture = create((host) => host.expanded.set(new Set([1])));

      fixture.componentInstance.data.set([]);
      fixture.detectChanges();

      expect(fixture.componentInstance.table().renderedRows()).toEqual([]);
      expect(queryAll(fixture, '.et-table-detail-row')).toHaveLength(0);
      expect(queryAll(fixture, '.et-table-expander-cell .et-table-expander')).toHaveLength(0);
    });

    it('renders no spacers for empty data under virtual scroll', () => {
      const fixture = create((host) => {
        host.virtual.set(true);
        host.data.set([]);
      });

      expect(fixture.componentInstance.table().renderedRows()).toEqual([]);

      for (const spacer of queryAll(fixture, '.et-table-spacer')) expect(spacer.style.blockSize).toBe('0px');
    });

    it('sorts empty data without throwing', () => {
      const fixture = create((host) => host.data.set([]));

      fixture.componentInstance.sort.set([{ key: 'name', direction: 'desc' }]);
      fixture.detectChanges();

      expect(fixture.componentInstance.table().rows()).toEqual([]);
    });
  });

  describe('rows that change identity during sort', () => {
    it('keeps the sort order when the data is replaced by fresh row objects', () => {
      const fixture = create((host) => host.sort.set([{ key: 'name', direction: 'desc' }]));

      expect(renderedNames(fixture)).toEqual(['Charlie', 'Bob', 'Ada']);

      fixture.componentInstance.data.set([...people(), { id: 4, name: 'Dora', score: 40 }]);
      fixture.detectChanges();

      expect(renderedNames(fixture)).toEqual(['Dora', 'Charlie', 'Bob', 'Ada']);
    });

    it('reuses the row element for a re-created row with the same key after a re-sort', () => {
      const fixture = create();
      const before = queryAll(fixture, '.et-table-row').find((row) => row.textContent?.includes('Ada'));

      fixture.componentInstance.data.set(people());
      fixture.componentInstance.sort.set([{ key: 'score', direction: 'desc' }]);
      fixture.detectChanges();

      const after = queryAll(fixture, '.et-table-row').find((row) => row.textContent?.includes('Ada'));

      expect(after).toBe(before);
      expect(renderedNames(fixture)).toEqual(['Charlie', 'Bob', 'Ada']);
    });

    it('sinks NaN sort values to the bottom in both directions, like nullish ones', () => {
      const rows = [
        { id: 1, name: 'a', score: 2 },
        { id: 2, name: 'b', score: NaN },
        { id: 3, name: 'c', score: 1 },
        { id: 4, name: 'd', score: 3 },
        { id: 5, name: 'e', score: NaN },
      ];

      const asc = sortRows({ rows, sort: [{ key: 'score', direction: 'asc' }], columns: columns() });
      const desc = sortRows({ rows, sort: [{ key: 'score', direction: 'desc' }], columns: columns() });

      expect(asc.map((row) => row.name)).toEqual(['c', 'a', 'd', 'b', 'e']);
      expect(desc.map((row) => row.name)).toEqual(['d', 'a', 'c', 'b', 'e']);
    });

    it('sinks invalid dates to the bottom', () => {
      const dated = [new Date('nope'), new Date(2020, 0, 2), new Date(2020, 0, 1)].map((at, id) => ({ id, at }));
      const sorted = sortRows({
        rows: dated,
        sort: [{ key: 'at', direction: 'asc' }],
        columns: { at: { header: 'At', value: (row: { at: Date }) => row.at } },
      });

      expect(sorted.map((row) => row.id)).toEqual([2, 1, 0]);
    });

    it('throws ET3514 when a sortable column without sortValue reads an object', () => {
      const rows = [
        { id: 1, address: { city: 'B' } },
        { id: 2, address: { city: 'A' } },
      ];
      const columns = { address: { header: 'Address', value: (row: (typeof rows)[number]) => row.address } };

      expect(() => sortRows({ rows, sort: [{ key: 'address', direction: 'asc' }], columns })).toThrow(/ET3514/);
      expect(
        sortRows({
          rows,
          sort: [{ key: 'address', direction: 'asc' }],
          columns: { address: { ...columns.address, sortValue: (row) => row.address.city } },
        }).map((row) => row.id),
      ).toEqual([2, 1]);
    });
  });

  describe('expandable rows after the data changes', () => {
    it('keeps a keyed row expanded when the data is replaced and re-sorted', () => {
      const fixture = create();
      fixture.componentInstance.expansion().toggle(fixture.componentInstance.data()[1]!);
      fixture.detectChanges();

      fixture.componentInstance.data.set(people().map((person) => ({ ...person, name: person.name + '!' })));
      fixture.componentInstance.sort.set([{ key: 'score', direction: 'desc' }]);
      fixture.detectChanges();

      const details = queryAll(fixture, '.et-table-detail-row');
      expect(details).toHaveLength(1);
      expect(details[0]!.textContent).toContain('detail Ada!');
    });

    it('drops the detail row of an expanded row that leaves the data, and restores it when the row returns', () => {
      const fixture = create();
      fixture.componentInstance.expansion().toggle(fixture.componentInstance.data()[1]!);
      fixture.detectChanges();

      fixture.componentInstance.data.set(people().filter((person) => person.id !== 1));
      fixture.detectChanges();
      expect(queryAll(fixture, '.et-table-detail-row')).toHaveLength(0);

      fixture.componentInstance.data.set(people());
      fixture.detectChanges();
      expect(queryAll(fixture, '.et-table-detail-row')).toHaveLength(1);
    });
  });

  describe('virtual scroll with expanded rows', () => {
    it('counts open detail rows in aria-rowcount and in every aria-rowindex', () => {
      const fixture = create((host) => {
        host.virtual.set(true);
        host.data.set(many(50));
        host.expanded.set(new Set([1, 3]));
      });

      const indexOf = (selector: string) =>
        queryAll(fixture, selector).map((element) => element.getAttribute('aria-rowindex'));

      expect(queryAll(fixture, '[role="table"]')[0]!.getAttribute('aria-rowcount')).toBe('53');
      expect(indexOf('.et-table-row').slice(0, 4)).toEqual(['2', '4', '5', '7']);
      expect(indexOf('.et-table-detail-row')).toEqual(['3', '6']);
    });
  });

  describe('virtual scroll with a zero-height viewport', () => {
    it('renders a bounded fallback window rather than nothing or everything', () => {
      viewportHeight = 0;
      const fixture = create((host) => {
        host.virtual.set(true);
        host.data.set(many(500));
      });

      const rendered = fixture.componentInstance.table().renderedRows().length;

      expect(rendered).toBeGreaterThan(0);
      expect(rendered).toBeLessThan(500);
    });

    it('keeps rows rendered when the data shrinks while scrolled far down', () => {
      const fixture = create((host) => {
        host.virtual.set(true);
        host.data.set(many(500));
      });
      const host = createTableDriver(fixture).host();

      host.scrollTop = 40 * 400;
      host.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      fixture.componentInstance.data.set(many(3));
      fixture.detectChanges();

      expect(fixture.componentInstance.table().renderedRows().length).toBeGreaterThan(0);

      for (const spacer of queryAll(fixture, '.et-table-spacer'))
        expect(parseFloat(spacer.style.blockSize || '0')).toBeGreaterThanOrEqual(0);
    });
  });
});
