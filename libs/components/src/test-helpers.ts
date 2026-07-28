// Shared side-effect setup for specs. jsdom has no ResizeObserver — anything
// rendering a component/directive that uses signalElementDimensions needs this.
if (!globalThis.ResizeObserver) {
  class ResizeObserverMock {
    constructor(callback: ResizeObserverCallback) {
      void callback;
    }

    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
    writable: true,
  });
}

// jsdom has no IntersectionObserver either — anything that tracks child visibility (the scrollable's
// lazy child intersections, and so the carousel and its snapping) needs this to render at all. It never
// reports: jsdom has no layout to report, so intersection-derived state stays at its initial value.
if (!globalThis.IntersectionObserver) {
  class IntersectionObserverMock {
    public readonly root = null;
    public readonly rootMargin = '';
    public readonly thresholds: number[] = [];

    constructor(callback: IntersectionObserverCallback) {
      void callback;
    }

    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: IntersectionObserverMock,
    writable: true,
  });
}

export {};
