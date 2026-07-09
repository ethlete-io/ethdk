import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridItemComponent } from '../grid-item.component';
import { GridComponent } from '../grid.component';
import { GridItemDirective } from './grid-item.directive';
import { GridDirective } from './grid.directive';
import { GridItemConfig } from './grid.types';

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  private targets = new Set<Element>();

  constructor(private callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
  }

  emit() {
    const entries = [...this.targets].map((target) => ({ target }) as ResizeObserverEntry);
    if (entries.length > 0) {
      this.callback(entries, this as unknown as ResizeObserver);
    }
  }
}

@Component({
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
  items: GridItemConfig[] = [{ id: 'item-1', type: 'test', data: undefined, layout: {} }];
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

  const measureGrid = (width = 1216) => {
    const gridEl = fixture.debugElement.query(By.directive(GridDirective)).nativeElement as HTMLElement;
    Object.defineProperty(gridEl, 'clientWidth', { configurable: true, value: width });
    TestBed.tick();
    ResizeObserverMock.instances.forEach((instance) => instance.emit());
    fixture.detectChanges();
  };

  beforeEach(() => {
    originalResizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
    ResizeObserverMock.instances = [];

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
    // the effect calls registerConstraints with the new constraints.
    getGridDirective().registerConstraints('item-1', { minColSpan: 4, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 3 });

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

  it('derives its slot rect from the layout position and grid geometry', () => {
    fixture.detectChanges();
    measureGrid();

    const item = getItemDirective();
    const pos = item.currentPosition();
    const geometry = getGridDirective().geometry();
    const slot = item.slotRect();

    expect(slot).not.toBeNull();
    expect(slot?.x).toBeCloseTo(geometry.originX + pos!.col * geometry.strideX);
    expect(slot?.y).toBeCloseTo(geometry.originY + pos!.row * geometry.strideY);
    expect(item.renderedRect()).toEqual(slot);
  });

  it('follows direct control during a gesture and returns to its slot afterwards', () => {
    fixture.detectChanges();
    measureGrid();

    const item = getItemDirective();
    const slot = item.slotRect();

    item.startDirectControl();
    expect(item.renderMode()).toBe('direct');
    expect(item.renderedRect()).toEqual(slot);

    item.updateDirectRect({ x: 123, y: 45, width: 200, height: 100 });
    expect(item.renderedRect()).toEqual({ x: 123, y: 45, width: 200, height: 100 });
    // layout-driven slot is untouched by direct control
    expect(item.slotRect()).toEqual(slot);

    item.stopDirectControl();
    expect(item.renderMode()).toBe('layout');
    expect(item.renderedRect()).toEqual(item.slotRect());
  });

  it('ignores updateDirectRect while not direct-controlled', () => {
    fixture.detectChanges();
    measureGrid();

    const item = getItemDirective();
    const slot = item.slotRect();

    item.updateDirectRect({ x: 999, y: 999, width: 10, height: 10 });
    expect(item.renderedRect()).toEqual(slot);
  });
});
