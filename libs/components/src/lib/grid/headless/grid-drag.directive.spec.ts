import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridItemComponent } from '../grid-item.component';
import { GridDragDirective } from './grid-drag.directive';
import { GridDirective } from './grid.directive';
import { GridItemConfig } from './grid.types';

class ResizeObserverMock {
  observe() {
    return;
  }

  unobserve() {
    return;
  }

  disconnect() {
    return;
  }
}

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
      version: 1,
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
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getDragDirective = () =>
    fixture.debugElement.query(By.directive(GridDragDirective)).injector.get(GridDragDirective);

  beforeEach(() => {
    originalResizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    });

    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
  });

  afterEach(() => {
    if (originalResizeObserverDescriptor) {
      Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserverDescriptor);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).ResizeObserver;
    }
  });

  it('instantiates without error', () => {
    fixture.detectChanges();
    expect(getDragDirective()).toBeDefined();
  });

  it('drag handle is not dragging by default', () => {
    fixture.detectChanges();
    expect(getDragDirective().dragHandle.isDragging()).toBe(false);
  });
});
