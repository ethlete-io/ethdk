import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridItemComponent } from '../grid-item.component';
import { GridComponent } from '../grid.component';
import { GridResizeDirective } from './grid-resize.directive';
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
    <et-grid [initialItems]="items" [rowHeight]="100" [gap]="16">
      <et-grid-item itemId="resize-item" />
    </et-grid>
  `,
})
class TestHostComponent {
  items: GridItemConfig[] = [{ id: 'resize-item', type: 'test', data: undefined, layout: {} }];
}

describe('GridResizeDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getResizeDirective = () =>
    fixture.debugElement.query(By.directive(GridResizeDirective)).injector.get(GridResizeDirective);

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

  it('instantiates without error', () => {
    fixture.detectChanges();
    expect(getResizeDirective()).toBeDefined();
  });

  it('is not resizing by default', () => {
    fixture.detectChanges();
    expect(getResizeDirective().isResizing()).toBe(false);
  });

  it('exposes all 8 resize edges', () => {
    fixture.detectChanges();
    expect(getResizeDirective().resizeEdges()).toHaveLength(8);
  });

  it('does not begin a resize before the grid is measured', () => {
    fixture.detectChanges();
    getResizeDirective().beginResize();
    expect(getResizeDirective().isResizing()).toBe(false);
  });

  it('beginResize sets isResizing to true when the grid is measured', () => {
    fixture.detectChanges();
    measureGrid();
    getResizeDirective().beginResize();
    expect(getResizeDirective().isResizing()).toBe(true);
  });

  it('finishResize clears isResizing', () => {
    fixture.detectChanges();
    measureGrid();
    getResizeDirective().beginResize();
    getResizeDirective().finishResize();
    expect(getResizeDirective().isResizing()).toBe(false);
  });

  it('finishResize commits the resize on the grid', () => {
    fixture.detectChanges();
    measureGrid();
    const commitSpy = vi.spyOn(getGridDirective(), 'commitResize');
    getResizeDirective().beginResize();
    getResizeDirective().finishResize();
    expect(commitSpy).toHaveBeenCalledOnce();
  });

  it('grows the item by one column when the east edge crosses a cell midpoint', () => {
    fixture.detectChanges();
    measureGrid();

    const geometry = getGridDirective().geometry();
    getResizeDirective().beginResize();
    getResizeDirective().updateResize({
      edge: 'e',
      dx: geometry.strideX * 0.7,
      dy: 0,
      clientX: 0,
      clientY: 0,
    });
    getResizeDirective().finishResize();

    const entry = getGridDirective()
      .baseLayout()
      .find((e) => e.id === 'resize-item');
    expect(entry?.position.colSpan).toBe(2);
  });

  it('cancelResize restores the pre-resize layout', () => {
    fixture.detectChanges();
    measureGrid();

    const before = getGridDirective().baseLayout();
    const geometry = getGridDirective().geometry();

    getResizeDirective().beginResize();
    getResizeDirective().updateResize({
      edge: 'e',
      dx: geometry.strideX * 1.7,
      dy: 0,
      clientX: 0,
      clientY: 0,
    });
    getResizeDirective().cancelResize();

    expect(getGridDirective().baseLayout()).toEqual(before);
    expect(getResizeDirective().isResizing()).toBe(false);
  });
});
