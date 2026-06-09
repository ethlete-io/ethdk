import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridComponent } from '../grid.component';
import { GridDirective } from './grid.directive';
import { GridItemConfig, GridItemConstraints } from './grid.types';

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
  template: `<et-grid [initialItems]="items()" />`,
})
class TestHostComponent {
  items = input<GridItemConfig[]>([]);
}

describe('GridDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getDirective = () => fixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

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
  });

  describe('item registration', () => {
    const constraints: GridItemConstraints = { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 3 };

    it('stores constraints via registerItem and returns them from getConstraints', () => {
      fixture.detectChanges();
      const el = document.createElement('div');
      getDirective().registerItem('test-id', { el, constraints });
      expect(getDirective().getConstraints('test-id')).toEqual(constraints);
    });

    it('removes element and constraints on unregisterItem', () => {
      fixture.detectChanges();
      const el = document.createElement('div');
      getDirective().registerItem('to-remove', { el, constraints });
      getDirective().unregisterItem('to-remove');
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

  describe('ghost element', () => {
    it('accepts a ghost element via setGhostElement', () => {
      fixture.detectChanges();
      const el = document.createElement('div');
      getDirective().setGhostElement(el);
      getDirective().snapshotRects();
    });

    it('is a no-op when setting the same element twice', () => {
      fixture.detectChanges();
      const el = document.createElement('div');
      getDirective().setGhostElement(el);
      expect(() => getDirective().setGhostElement(el)).not.toThrow();
    });
  });

  describe('initialItems', () => {
    it('loads items from initialItems input on first render', () => {
      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', version: 1, data: undefined, layout: {} },
        { id: 'b', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();
      expect(getDirective().items()).toHaveLength(2);
    });

    it('adds new items when initialItems grows', () => {
      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', version: 1, data: undefined, layout: {} },
        { id: 'b', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      expect(getDirective().items()).toHaveLength(2);
    });

    it('removes items when initialItems shrinks', () => {
      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', version: 1, data: undefined, layout: {} },
        { id: 'b', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      fixture.componentRef.setInput('items', [
        { id: 'a', type: 'test', version: 1, data: undefined, layout: {} },
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
        { id: 'x', type: 'test', version: 1, data: undefined, layout: {} },
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
        { id: 'p', type: 'test', version: 1, data: undefined, layout: {} },
        { id: 'q', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      const layout = getDirective().layout();
      expect(layout).toHaveLength(2);
      expect(layout.map((e) => e.id)).toContain('p');
      expect(layout.map((e) => e.id)).toContain('q');
    });

    it('all positions have non-negative col and row', () => {
      fixture.componentRef.setInput('items', [
        { id: 'r', type: 'test', version: 1, data: undefined, layout: {} },
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
    it('beginDrag sets dragState with the item id', () => {
      fixture.componentRef.setInput('items', [
        { id: 'drag-me', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      getDirective().beginDrag('drag-me');
      expect(getDirective().dragState()?.itemId).toBe('drag-me');
    });

    it('commitDrag clears drag state', () => {
      fixture.componentRef.setInput('items', [
        { id: 'drag-me', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      getDirective().beginDrag('drag-me');
      getDirective().commitDrag();
      expect(getDirective().dragState()).toBeNull();
    });

    it('ghostPosition is non-null while dragging', () => {
      fixture.componentRef.setInput('items', [
        { id: 'drag-me', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      getDirective().beginDrag('drag-me');
      expect(getDirective().ghostPosition()).not.toBeNull();
    });

    it('ghostPosition returns null after drag is committed', () => {
      fixture.componentRef.setInput('items', [
        { id: 'drag-me', type: 'test', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();

      getDirective().beginDrag('drag-me');
      getDirective().commitDrag();
      expect(getDirective().ghostPosition()).toBeNull();
    });
  });

  describe('migration status', () => {
    it('getMigrationStatus returns ok for items with no migrations configured', () => {
      fixture.componentRef.setInput('items', [
        { id: 'no-migration', type: 'widget', version: 1, data: undefined, layout: {} },
      ] satisfies GridItemConfig[]);
      fixture.detectChanges();
      expect(getDirective().getMigrationStatus('no-migration').state).toBe('ok');
    });
  });
});
