import { TestBed } from '@angular/core/testing';
import { injectSurfaceContextTracker } from './surface-context-tracker';

describe('surfaceContextTracker', () => {
  const inTracker = <T>(fn: (tracker: ReturnType<typeof injectSurfaceContextTracker>) => T): T =>
    TestBed.runInInjectionContext(() => fn(injectSurfaceContextTracker()));

  const el = (parent?: HTMLElement) => {
    const node = document.createElement('div');
    (parent ?? document.body).appendChild(node);
    return node;
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null for an element outside every registered overlay', () => {
    inTracker((tracker) => {
      const pane = el();
      const outside = el();
      tracker.register('dark', 1, pane);

      expect(tracker.surfaceForElement(outside)).toBeNull();
    });
  });

  it('returns the surface of the overlay pane that contains the element', () => {
    inTracker((tracker) => {
      const pane = el();
      const inside = el(pane);
      tracker.register('dark', 1, pane);

      expect(tracker.surfaceForElement(inside)).toEqual({ type: 'dark', elevation: 1 });
    });
  });

  it('picks the innermost overlay when panes are nested via containment', () => {
    inTracker((tracker) => {
      const outerPane = el();
      const innerPane = el(outerPane);
      const inside = el(innerPane);

      tracker.register('dark', 1, outerPane);
      tracker.register('dark', 2, innerPane);

      expect(tracker.surfaceForElement(inside)).toEqual({ type: 'dark', elevation: 2 });
    });
  });

  it('stops matching once the overlay is unregistered', () => {
    inTracker((tracker) => {
      const pane = el();
      const inside = el(pane);
      const unregister = tracker.register('dark', 1, pane);

      expect(tracker.surfaceForElement(inside)).not.toBeNull();

      unregister();

      expect(tracker.surfaceForElement(inside)).toBeNull();
    });
  });
});
