// Shared side-effect setup for specs. jsdom has no ResizeObserver - anything
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

// jsdom has no IntersectionObserver either - anything that tracks child visibility (the scrollable's
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

// jsdom has no matchMedia - anything reading a media query (the animation utils' reduced-motion
// check, the overlay's breakpoint strategies) needs this. Nothing ever matches: jsdom has no
// viewport to match against, so query-derived state stays at its "no match" default.
if (!globalThis.matchMedia) {
  const mediaQueryListMock = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });

  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value: mediaQueryListMock,
    writable: true,
  });
}

// jsdom has no Web Animations API - anything running a FLIP or an element transition (the segmented
// button's moving indicator, the picker panel's resize) needs this to render at all. There is no
// compositor to drive frames, so the animation reports finished right away and callers waiting on
// `finish` still get their cleanup.
if (!Element.prototype.animate) {
  class AnimationMock extends EventTarget {
    public finished: Promise<AnimationMock>;
    public currentTime: number | null = 0;
    public playState = 'finished';
    public onfinish: (() => void) | null = null;
    public oncancel: (() => void) | null = null;

    constructor() {
      super();
      this.finished = Promise.resolve(this);
      queueMicrotask(() => this.dispatchEvent(new Event('finish')));
    }

    cancel() {
      this.dispatchEvent(new Event('cancel'));
    }

    finish() {
      this.dispatchEvent(new Event('finish'));
    }

    play() {
      return undefined;
    }

    pause() {
      return undefined;
    }

    reverse() {
      return undefined;
    }

    commitStyles() {
      return undefined;
    }
  }

  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: () => new AnimationMock() as unknown as Animation,
    writable: true,
  });
}

export {};
