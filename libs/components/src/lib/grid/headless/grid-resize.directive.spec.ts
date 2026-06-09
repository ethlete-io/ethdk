import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridComponent } from '../grid.component';
import { GridItemComponent } from '../grid-item.component';
import { GridDirective } from './grid.directive';
import { GridResizeDirective } from './grid-resize.directive';
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
    <et-grid [initialItems]="items" [rowHeight]="100" [gap]="16">
      <et-grid-item itemId="resize-item" />
    </et-grid>
  `,
})
class TestHostComponent {
  items: GridItemConfig[] = [{ id: 'resize-item', type: 'test', version: 1, data: undefined, layout: {} }];
}

describe('GridResizeDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getResizeDirective = () =>
    fixture.debugElement.query(By.directive(GridResizeDirective)).injector.get(GridResizeDirective);

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

  it('beginResize sets isResizing to true when item has a position', () => {
    fixture.detectChanges();
    getResizeDirective().beginResize();
    expect(getResizeDirective().isResizing()).toBe(true);
  });

  it('finishResize clears isResizing', () => {
    fixture.detectChanges();
    getResizeDirective().beginResize();
    getResizeDirective().finishResize();
    expect(getResizeDirective().isResizing()).toBe(false);
  });

  it('finishResize calls commitResize on the grid', () => {
    fixture.detectChanges();
    const commitSpy = vi.spyOn(getGridDirective(), 'commitResize');
    getResizeDirective().finishResize();
    expect(commitSpy).toHaveBeenCalledOnce();
  });
});
