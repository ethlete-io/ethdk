import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridComponent } from './grid.component';
import { GridDirective } from './headless/grid.directive';
import { GridItemConfig } from './headless/grid.types';

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
  imports: [GridComponent],
  template: ` <et-grid [rowHeight]="rowHeight" [gap]="gap" [initialItems]="items" /> `,
})
class TestHostComponent {
  rowHeight = 120;
  gap = 8;
  items: GridItemConfig[] = [];
}

describe('GridComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getGrid = () => fixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

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

  it('renders the grid host element with class et-grid', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.et-grid')).not.toBeNull();
  });

  it('has role="region" on the grid element', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const grid = el.querySelector('.et-grid') as HTMLElement;
    expect(grid.getAttribute('role')).toBe('region');
  });

  it('starts with no items in the grid directive', () => {
    fixture.detectChanges();
    expect(getGrid().items()).toHaveLength(0);
  });

  it('starts with null drag state', () => {
    fixture.detectChanges();
    expect(getGrid().dragState()).toBeNull();
  });

  it('starts with null ghost position', () => {
    fixture.detectChanges();
    expect(getGrid().ghostPosition()).toBeNull();
  });

  it('forwards rowHeight input to the grid directive', () => {
    fixture.detectChanges();
    expect(getGrid().rowHeight()).toBe(120);
  });

  it('forwards gap input to the grid directive', () => {
    fixture.detectChanges();
    expect(getGrid().gap()).toBe(8);
  });

  it('loads initial items on first render', () => {
    fixture.componentInstance.items = [
      { id: 'a', type: 'test', version: 1, data: undefined, layout: {} },
      { id: 'b', type: 'test', version: 1, data: undefined, layout: {} },
    ];
    fixture.detectChanges();
    expect(getGrid().items()).toHaveLength(2);
  });

  it('renders the ghost element when drag is active', () => {
    fixture.componentInstance.items = [{ id: 'a', type: 'test', version: 1, data: undefined, layout: {} }];
    fixture.detectChanges();

    getGrid().beginDrag('a');
    fixture.detectChanges();

    const ghost = (fixture.nativeElement as HTMLElement).querySelector('.et-grid-ghost');
    expect(ghost).not.toBeNull();
  });
});
