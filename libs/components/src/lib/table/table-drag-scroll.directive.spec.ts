import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../testing/destroyed-mid-gesture';
import { createTableDriver } from './testing/table-driver';
import { TABLE_DRAG_SCROLL_IMPORTS, TABLE_IMPORTS } from './table.imports';
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
  template: `<et-table [columns]="cols()" [data]="data()" etTableDragScroll />`,
  imports: [TABLE_IMPORTS, TABLE_DRAG_SCROLL_IMPORTS],
})
class HostComponent {
  public cols = signal<TableColumns<Person>>(columns());
  public data = signal<Person[]>(PEOPLE);
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  const driver = createTableDriver(fixture);

  driver.fakeScrollExtent({ scrollWidth: 680, viewportWidth: 320 });
  driver.makeScrollable();
  fixture.componentInstance.cols.set(columns());
  fixture.detectChanges();

  return { driver, fixture };
};

const press = (target: Element, clientX: number) =>
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX,
      clientY: 100,
      pointerId: 1,
      pointerType: 'mouse',
    }),
  );

const moveTo = (clientX: number) =>
  document.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY: 100, pointerId: 1 }));

describe('TableDragScrollDirective', () => {
  it('becomes drag-scrollable when rows arriving after mount make it overflow', () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.componentInstance.data.set([]);
    fixture.detectChanges();

    const driver = createTableDriver(fixture);

    driver.fakeScrollExtent({ scrollWidth: 320, viewportWidth: 320 });
    fixture.componentInstance.cols.set(columns());
    fixture.detectChanges();

    expect(driver.host().classList.contains('et-table-host--drag-scrollable')).toBe(false);

    driver.fakeScrollExtent({ scrollWidth: 680, viewportWidth: 320 });
    fixture.componentInstance.data.set(PEOPLE);
    fixture.detectChanges();

    expect(driver.host().classList.contains('et-table-host--drag-scrollable')).toBe(true);
  });

  it('stops panning when the table is destroyed mid-drag', async () => {
    const { driver, fixture } = create();

    await expectNothingRunsAfterDestroy({
      fixture,
      start: () => {
        press(driver.cell(0, 'role')!, 200);
        moveTo(150);
      },
    });
  });
});
