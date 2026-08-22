import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../testing/destroyed-mid-gesture';
import { pointerEvent } from '../testing/driver-core';
import { TableReorderDirective } from './table-reorder.directive';
import { TableComponent } from './table.component';
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
  public feature = viewChild.required(TableReorderDirective);
  public table = viewChild.required<TableComponent<Person>>(TableComponent);
}

/**
 * jsdom performs no layout, so a scroller's `scrollLeft` never leaves 0 - and the auto-scroll loop
 * stops on its first frame precisely when the position it wrote did not take.
 */
const makeScrollable = (element: HTMLElement) => {
  let scrollLeft = 0;

  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => void (scrollLeft = value),
  });
};

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();
  makeScrollable(fixture.componentInstance.feature().table.scrollElement());

  return fixture;
};

/**
 * Grabs the first header cell and drags it far past the table's trailing edge - which, with jsdom
 * measuring the table as a zero-width box, is any position beyond the auto-scroll zone.
 */
const dragToTrailingEdge = (fixture: ComponentFixture<HostComponent>) => {
  const cell = fixture.componentInstance.feature().table.headerCellElements()[0]!;

  pointerEvent(cell, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  pointerEvent(document, 'pointermove', { clientX: 200, clientY: 10, pointerId: 1 });
};

describe('TableReorderDirective', () => {
  it('scrolls the table under a drag held past its trailing edge', async () => {
    const fixture = create();
    const scroller = fixture.componentInstance.feature().table.scrollElement();

    dragToTrailingEdge(fixture);

    const firstFrame = scroller.scrollLeft;

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(firstFrame).toBeGreaterThan(0);
    expect(scroller.scrollLeft).toBeGreaterThan(firstFrame);
  });

  it('stops the edge auto-scroll loop when the table is destroyed mid-drag', async () => {
    const fixture = create();

    const activity = await expectNothingRunsAfterDestroy({
      fixture,
      start: () => dragToTrailingEdge(fixture),
    });

    expect(activity.framesRun).toBeGreaterThan(0);
  });
});
