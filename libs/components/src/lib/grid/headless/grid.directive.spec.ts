import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridDirective } from './grid.directive';
import { GridItemConfig, GridItemConstraints, GridSerializedState } from './grid.types';

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
  imports: [GridDirective],
  template: `<div [initialItems]="items()" etGrid></div>`,
})
class TestHostComponent {
  items = input<GridItemConfig[]>([]);
}

describe('GridDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getDirective = () => fixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

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

  describe('initial state', () => {
    it('starts with empty items', () => {
      fixture.detectChanges();
      expect(getDirective().items()).toHaveLength(0);
    });

    it('starts with null drag state', () => {
      fixture.detectChanges();
      expect(getDirective().dragState()).toBeNull();
    });

    it('starts with null ghost position', () => {
      fixture.detectChanges();
      expect(getDirective().ghostPosition()).toBeNull();
    });

    it('is not ready before the container is measured', () => {
      fixture.detectChanges();
      expect(getDirective().isReady()).toBe(false);
    });

    it('becomes ready once the container is measured', () => {
      fixture.detectChanges();
      measureGrid();
      expect(getDirective().isReady()).toBe(true);
      expect(getDirective().containerWidth()).toBe(1216);
    });
  });

  describe('geometry', () => {
    it('derives cell width from container width, columns and gap', () => {
      fixture.detectChanges();
      measureGrid(1216);

      const geometry = getDirective().geometry();
      const columns = getDirective().activeColumns();
      expect(geometry.columns).toBe(columns);
      expect(geometry.cellWidth).toBeCloseTo((1216 - geometry.gap * (columns - 1)) / columns);
      expect(geometry.strideY).toBe(getDirective().rowHeight() + geometry.gap);
    });
  });

  describe('item registration', () => {
    const constraints: GridItemConstraints = { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 3 };

    it('stores constraints via registerConstraints and returns them from getConstraints', () => {
      fixture.detectChanges();
      getDirective().registerConstraints('test-id', constraints);
      expect(getDirective().getConstraints('test-id')).toEqual(constraints);
    });

    it('removes constraints on unregisterConstraints', () => {
      fixture.detectChanges();
      getDirective().registerConstraints('to-remove', constraints);
      getDirective().unregisterConstraints('to-remove');
      expect(getDirective().getConstraints('to-remove')).toEqual({
        minColSpan: 1,
        maxColSpan: 12,
        minRowSpan: 1,
        maxRowSpan: 24,
      });
    });

    it('returns default constraints for unregistered id', () => {
      fixture.detectChanges();
      const defaults = getDirective().getConstraints('unknown-id');
      expect(defaults.minColSpan).toBe(1);
      expect(defaults.maxColSpan).toBe(12);
    });
  });

  describe('initialItems', () => {
    it('loads items from initialItems input on first render', () => {
      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', data: undefined, layout: {} },
        { id: 'b', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();
      expect(getDirective().items()).toHaveLength(2);
    });

    it('adds new items when initialItems grows', () => {
      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', data: undefined, layout: {} },
        { id: 'b', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      expect(getDirective().items()).toHaveLength(2);
    });

    it('removes items when initialItems shrinks', () => {
      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', data: undefined, layout: {} },
        { id: 'b', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      expect(getDirective().items()).toHaveLength(1);
    });
  });

  describe('addItem / removeItem', () => {
    it('addItem appends an item to the layout', () => {
      fixture.detectChanges();
      getDirective().addItem('chart', undefined);
      expect(getDirective().items()).toHaveLength(1);
    });

    it('removeItem removes the item from the layout', () => {
      fixture.componentRef.setInput('items', [
        { id: 'x', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      getDirective().removeItem('x');
      fixture.detectChanges();

      expect(
        getDirective()
          .items()
          .find((i) => i.id === 'x'),
      ).toBeUndefined();
    });
  });

  describe('layout', () => {
    it('returns layout entries for all items', () => {
      fixture.componentRef.setInput('items', [
        { id: 'p', type: 'test', data: undefined, layout: {} },
        { id: 'q', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      const layout = getDirective().layout();
      expect(layout).toHaveLength(2);
      expect(layout.map((e) => e.id)).toContain('p');
      expect(layout.map((e) => e.id)).toContain('q');
    });

    it('all positions have non-negative col and row', () => {
      fixture.componentRef.setInput('items', [
        { id: 'r', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      const entry = getDirective()
        .layout()
        .find((e) => e.id === 'r');
      expect(entry?.position.col).toBeGreaterThanOrEqual(0);
      expect(entry?.position.row).toBeGreaterThanOrEqual(0);
    });
  });

  describe('drag lifecycle', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('items', [
        { id: 'drag-me', type: 'test', data: undefined, layout: {} },
        { id: 'other', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();
      measureGrid();
    });

    it('beginDrag sets dragState and returns the origin position', () => {
      const origin = getDirective().beginDrag('drag-me');
      expect(getDirective().dragState()?.itemId).toBe('drag-me');
      expect(origin).toEqual(getDirective().dragState()?.originPosition);
    });

    it('beginDrag returns null for an unknown item', () => {
      expect(getDirective().beginDrag('nope')).toBeNull();
      expect(getDirective().dragState()).toBeNull();
    });

    it('updateDragTarget keeps the span from the origin position', () => {
      const origin = getDirective().beginDrag('drag-me');
      getDirective().updateDragTarget({ col: 3, row: 2 });

      const target = getDirective().dragState()?.targetPosition;
      expect(target?.col).toBe(3);
      expect(target?.row).toBe(2);
      expect(target?.colSpan).toBe(origin?.colSpan);
      expect(target?.rowSpan).toBe(origin?.rowSpan);
    });

    it('commitDrag clears drag state and returns the final position', () => {
      getDirective().beginDrag('drag-me');
      getDirective().updateDragTarget({ col: 2, row: 0 });
      const final = getDirective().commitDrag();
      expect(getDirective().dragState()).toBeNull();
      expect(final).not.toBeNull();
    });

    it('cancelDrag clears drag state and reverts the layout', () => {
      const before = getDirective().baseLayout();
      getDirective().beginDrag('drag-me');
      getDirective().updateDragTarget({ col: 4, row: 3 });
      getDirective().cancelDrag();

      expect(getDirective().dragState()).toBeNull();
      expect(getDirective().layout()).toEqual(before);
    });

    it('ghostPosition is non-null while dragging', () => {
      getDirective().beginDrag('drag-me');
      expect(getDirective().ghostPosition()).not.toBeNull();
    });

    it('ghostPosition returns null after drag is committed', () => {
      getDirective().beginDrag('drag-me');
      getDirective().commitDrag();
      expect(getDirective().ghostPosition()).toBeNull();
    });
  });

  describe('resize lifecycle', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('items', [
        { id: 'resize-me', type: 'test', data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();
      measureGrid();
    });

    it('beginResize returns the start position and marks the resize active', () => {
      const start = getDirective().beginResize('resize-me');
      expect(start).not.toBeNull();
      expect(getDirective().isResizeActive()).toBe(true);
    });

    it('emits layoutChange once on commit, not per live update', () => {
      const emissions: GridSerializedState[] = [];
      getDirective().layoutChange.subscribe((state) => emissions.push(state));

      const start = getDirective().beginResize('resize-me');
      getDirective().updateResize('resize-me', { ...start!, colSpan: start!.colSpan + 1 });
      getDirective().updateResize('resize-me', { ...start!, colSpan: start!.colSpan + 2 });
      expect(emissions).toHaveLength(0);

      getDirective().commitResize();
      expect(emissions).toHaveLength(1);

      const committed = emissions[0]?.items.find((i) => i.id === 'resize-me');
      expect(committed).toBeDefined();
    });

    it('applies the resize target to the layout while active', () => {
      const start = getDirective().beginResize('resize-me');
      getDirective().updateResize('resize-me', { ...start!, colSpan: start!.colSpan + 1 });

      const entry = getDirective()
        .layout()
        .find((e) => e.id === 'resize-me');
      expect(entry?.position.colSpan).toBe(start!.colSpan + 1);
    });

    it('cancelResize restores the pre-resize layout', () => {
      const before = getDirective().baseLayout();
      const start = getDirective().beginResize('resize-me');
      getDirective().updateResize('resize-me', { ...start!, colSpan: start!.colSpan + 2 });
      getDirective().cancelResize();

      expect(getDirective().baseLayout()).toEqual(before);
      expect(getDirective().isResizeActive()).toBe(false);
    });

    it('resizeItem performs a one-shot resize with a single emission', () => {
      const emissions: GridSerializedState[] = [];
      getDirective().layoutChange.subscribe((state) => emissions.push(state));

      getDirective().resizeItem({ id: 'resize-me', newColSpan: 3, newRowSpan: 2 });

      expect(emissions).toHaveLength(1);
      const entry = getDirective()
        .baseLayout()
        .find((e) => e.id === 'resize-me');
      expect(entry?.position.colSpan).toBe(3);
      expect(entry?.position.rowSpan).toBe(2);
    });
  });

  describe('resize compaction', () => {
    // Row 0 holds a half-width item (its right half is free); rows 1 and 2 hold
    // full-width items. Shrinking b onto the right half frees space b could
    // compact into - but that must not happen until the gesture ends.
    beforeEach(() => {
      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', data: undefined, layout: { lg: { col: 0, row: 0, colSpan: 6, rowSpan: 1 } } },
        { id: 'b', type: 'test', data: undefined, layout: { lg: { col: 0, row: 1, colSpan: 12, rowSpan: 1 } } },
        { id: 'c', type: 'test', data: undefined, layout: { lg: { col: 0, row: 2, colSpan: 12, rowSpan: 1 } } },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();
      measureGrid();
    });

    it('does not collapse items upward while the resize is in progress', () => {
      const start = getDirective().beginResize('b');
      expect(start).toEqual({ col: 0, row: 1, colSpan: 12, rowSpan: 1 });

      // Shrink b from the left so it only covers the right half of row 1. The slot
      // above it (row 0, cols 6-11) is now free, but nothing may move up yet.
      getDirective().updateResize('b', { col: 6, row: 1, colSpan: 6, rowSpan: 1 });

      const during = getDirective().layout();
      expect(during.find((e) => e.id === 'b')?.position).toEqual({ col: 6, row: 1, colSpan: 6, rowSpan: 1 });
      expect(during.find((e) => e.id === 'c')?.position.row).toBe(2);
    });

    it('runs the withheld compaction on commit', () => {
      getDirective().beginResize('b');
      getDirective().updateResize('b', { col: 6, row: 1, colSpan: 6, rowSpan: 1 });

      const final = getDirective().commitResize();
      expect(final).toEqual({ col: 6, row: 0, colSpan: 6, rowSpan: 1 });

      const after = getDirective().baseLayout();
      expect(after.find((e) => e.id === 'c')?.position.row).toBe(1);
    });

    it('lets items pushed down by the resize return to their start row mid-gesture', () => {
      getDirective().beginResize('a');

      // Grow a to full width - b and c get pushed down one row each.
      getDirective().updateResize('a', { col: 0, row: 0, colSpan: 12, rowSpan: 2 });
      let layout = getDirective().layout();
      expect(layout.find((e) => e.id === 'b')?.position.row).toBe(2);
      expect(layout.find((e) => e.id === 'c')?.position.row).toBe(3);

      // Shrink back - they return to their gesture-start rows, not above them.
      getDirective().updateResize('a', { col: 0, row: 0, colSpan: 6, rowSpan: 1 });
      layout = getDirective().layout();
      expect(layout.find((e) => e.id === 'b')?.position.row).toBe(1);
      expect(layout.find((e) => e.id === 'c')?.position.row).toBe(2);
    });
  });
});
