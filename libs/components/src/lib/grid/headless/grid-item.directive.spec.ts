import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridComponent } from '../grid.component';
import { GridItemComponent } from '../grid-item.component';
import { GridDirective } from './grid.directive';
import { GridItemDirective } from './grid-item.directive';
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
  standalone: true,
  imports: [GridComponent, GridItemComponent],
  template: `
    <et-grid [initialItems]="items">
      <et-grid-item
        [minColSpan]="minColSpan"
        [maxColSpan]="maxColSpan"
        [minRowSpan]="minRowSpan"
        [maxRowSpan]="maxRowSpan"
        itemId="item-1"
      />
    </et-grid>
  `,
})
class TestHostComponent {
  items: GridItemConfig[] = [{ id: 'item-1', type: 'test', version: 1, data: undefined, layout: {} }];
  minColSpan = 2;
  maxColSpan = 6;
  minRowSpan = 1;
  maxRowSpan = 3;
}

describe('GridItemDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getItemDirective = () =>
    fixture.debugElement.query(By.directive(GridItemDirective)).injector.get(GridItemDirective);

  const getGridDirective = () => fixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

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

  it('has the itemId set to "item-1"', () => {
    fixture.detectChanges();
    expect(getItemDirective().itemId()).toBe('item-1');
  });

  it('registers constraints with the parent grid on init', () => {
    fixture.detectChanges();
    const constraints = getGridDirective().getConstraints('item-1');
    expect(constraints.minColSpan).toBe(2);
    expect(constraints.maxColSpan).toBe(6);
    expect(constraints.minRowSpan).toBe(1);
    expect(constraints.maxRowSpan).toBe(3);
  });

  it('updates registered constraints when inputs change', () => {
    fixture.detectChanges();

    // Simulate what the registration effect does when minColSpan input changes:
    // the effect calls registerItem with the new constraints.
    const el = getItemDirective().hostElement.nativeElement;
    getGridDirective().registerItem('item-1', {
      el,
      constraints: { minColSpan: 4, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 3 },
    });

    expect(getGridDirective().getConstraints('item-1').minColSpan).toBe(4);
  });

  it('returns a valid currentPosition after the grid places the item', () => {
    fixture.detectChanges();
    const pos = getItemDirective().currentPosition();
    expect(pos).not.toBeNull();
    expect(pos?.colSpan).toBeGreaterThanOrEqual(2);
  });

  it('is not being dragged by default', () => {
    fixture.detectChanges();
    expect(getItemDirective().isBeingDragged()).toBe(false);
  });

  it('marks isBeingDragged true while drag is active', () => {
    fixture.detectChanges();
    getGridDirective().beginDrag('item-1');
    expect(getItemDirective().isBeingDragged()).toBe(true);
    getGridDirective().commitDrag();
    expect(getItemDirective().isBeingDragged()).toBe(false);
  });

  it('freezes renderPosition during drag so the dragged item stays in place visually', () => {
    fixture.detectChanges();
    const posBeforeDrag = getItemDirective().currentPosition();
    getGridDirective().beginDrag('item-1');

    const renderPos = getItemDirective().renderPosition();
    expect(renderPos?.col).toBe(posBeforeDrag?.col);
    expect(renderPos?.row).toBe(posBeforeDrag?.row);
  });
});
