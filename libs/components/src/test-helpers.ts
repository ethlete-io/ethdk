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

export {};
