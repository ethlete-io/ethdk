import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridItemComponent } from './grid-item.component';
import { GridItemDirective } from './headless/grid-item.directive';
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

const TEST_ITEM: GridItemConfig = {
  id: 'test-item',
  type: 'test',
  version: 1,
  data: undefined,
  layout: {
    lg: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
    md: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
    sm: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
  },
};

@Component({
  imports: [GridDirective, GridItemComponent],
  template: `
    <div [items]="items" [readOnly]="readOnly" etGrid>
      <et-grid-item [ariaLabel]="ariaLabel" itemId="test-item">
        <input type="text" />
      </et-grid-item>
    </div>
  `,
})
class TestHostComponent {
  items: GridItemConfig[] = [TEST_ITEM];
  ariaLabel = 'My widget';
  readOnly = false;
}

describe('GridItemComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getItemEl = () => (fixture.nativeElement as HTMLElement).querySelector('et-grid-item') as HTMLElement;

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

  it('renders with class et-grid-item', () => {
    fixture.detectChanges();
    expect(getItemEl().classList.contains('et-grid-item')).toBe(true);
  });

  it('has tabindex="0"', () => {
    fixture.detectChanges();
    expect(getItemEl().getAttribute('tabindex')).toBe('0');
  });

  it('has role="group"', () => {
    fixture.detectChanges();
    expect(getItemEl().getAttribute('role')).toBe('group');
  });

  it('reflects ariaLabel in aria-label', () => {
    fixture.detectChanges();
    expect(getItemEl().getAttribute('aria-label')).toBe('My widget');
  });

  it('registers with the parent grid directive', () => {
    fixture.detectChanges();
    const constraints = getGridDirective().getConstraints('test-item');
    expect(constraints).toBeDefined();
    expect(constraints.minColSpan).toBeGreaterThanOrEqual(1);
  });

  it('is not being dragged by default', () => {
    fixture.detectChanges();
    expect(getItemDirective().isBeingDragged()).toBe(false);
  });

  it('locks touch-action while editable so touch drags are not claimed for scrolling', () => {
    fixture.detectChanges();
    expect(getItemEl().style.touchAction).toBe('none');
  });

  it('releases the touch-action lock when the grid is read-only', () => {
    fixture.componentInstance.readOnly = true;
    fixture.detectChanges();
    expect(getItemEl().style.touchAction).toBe('auto');
  });

  it('has a valid current position once the grid has placed it', () => {
    fixture.detectChanges();
    const pos = getItemDirective().currentPosition();
    expect(pos).not.toBeNull();
    expect(pos?.colSpan).toBeGreaterThanOrEqual(1);
    expect(pos?.rowSpan).toBeGreaterThanOrEqual(1);
  });

  describe('keyboard navigation', () => {
    it('does not move item when no modifier key is held', () => {
      fixture.detectChanges();
      const initialPos = getItemDirective().currentPosition();

      getItemEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      fixture.detectChanges();

      expect(getItemDirective().currentPosition()?.col).toBe(initialPos?.col);
    });

    it('resizes item larger on Shift+ArrowRight', () => {
      fixture.detectChanges();
      const initialPos = getItemDirective().currentPosition();
      if (!initialPos) return;

      getItemEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
      fixture.detectChanges();

      const newPos = getItemDirective().currentPosition();
      expect(newPos?.colSpan).toBe(initialPos.colSpan + 1);
    });

    it('ignores shortcuts that bubble out of a form field inside the item', () => {
      fixture.detectChanges();
      const initialPos = getItemDirective().currentPosition();
      const input = getItemEl().querySelector('input') as HTMLInputElement;

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', ctrlKey: true, bubbles: true }));
      fixture.detectChanges();

      const newPos = getItemDirective().currentPosition();
      expect(newPos?.colSpan).toBe(initialPos?.colSpan);
      expect(getGridDirective().getConstraints('test-item')).toBeDefined();
    });

    it('moves without resizing on Ctrl+Shift+Arrow', () => {
      fixture.detectChanges();
      const initialPos = getItemDirective().currentPosition();
      if (!initialPos) return;

      getItemEl().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, shiftKey: true, bubbles: true }),
      );
      fixture.detectChanges();

      const newPos = getItemDirective().currentPosition();
      expect(newPos?.col).toBe(initialPos.col + 1);
      expect(newPos?.colSpan).toBe(initialPos.colSpan);
    });
  });
});
