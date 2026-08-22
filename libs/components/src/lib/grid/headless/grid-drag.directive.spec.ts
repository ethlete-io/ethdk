import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { pointerEvent, query } from '../../testing/driver-core';
import { GridItemComponent } from '../grid-item.component';
import { createGridHarness, GridHarness } from '../testing/grid-driver';
import { GridDragDirective } from './grid-drag.directive';
import { GridDirective } from './grid.directive';
import { GridItemConfig } from './grid.types';

@Component({
  imports: [GridDirective, GridItemComponent],
  template: `
    <div [items]="items" etGrid>
      <et-grid-item itemId="drag-item" />
    </div>
  `,
})
class TestHostComponent {
  items: GridItemConfig[] = [
    {
      id: 'drag-item',
      type: 'test',
      data: undefined,
      layout: {
        lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      },
    },
  ];
}

describe('GridDragDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let grid: GridHarness;

  const getDragDirective = () =>
    fixture.debugElement.query(By.directive(GridDragDirective)).injector.get(GridDragDirective);

  const getGridDirective = () => fixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

  const itemEl = () => query(fixture, 'et-grid-item')!;

  /** Grabs the item and drags it one and a half cells right - past the commit threshold. */
  const dragRight = () => {
    pointerEvent(itemEl(), 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    pointerEvent(document, 'pointermove', { clientX: 400, clientY: 10, pointerId: 1 });
  };

  beforeEach(() => {
    grid = createGridHarness();

    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('instantiates without error', () => {
    fixture.detectChanges();
    expect(getDragDirective()).toBeDefined();
  });

  it('drag handle is not dragging by default', () => {
    fixture.detectChanges();
    expect(getDragDirective().dragHandle.isDragging()).toBe(false);
  });

  it('starts dragging once the pointer crosses the commit threshold', () => {
    fixture.detectChanges();
    grid.measure(fixture);

    dragRight();

    expect(getDragDirective().dragHandle.isDragging()).toBe(true);
    expect(getGridDirective().dragState()?.itemId).toBe('drag-item');

    pointerEvent(document, 'pointerup', { clientX: 400, clientY: 10, pointerId: 1 });

    expect(getDragDirective().dragHandle.isDragging()).toBe(false);
    expect(getGridDirective().dragState()).toBeNull();
  });

  it('cancels the drag and reverts the layout on Escape', () => {
    fixture.detectChanges();
    grid.measure(fixture);
    const before = getGridDirective().baseLayout();

    dragRight();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(getGridDirective().dragState()).toBeNull();
    expect(getGridDirective().baseLayout()).toEqual(before);
  });
});
