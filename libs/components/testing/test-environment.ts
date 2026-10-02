class ResizeObserverFake {
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

class IntersectionObserverFake {
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

class AnimationFake extends EventTarget {
  public finished: Promise<AnimationFake>;
  public currentTime: number | null = 0;
  public playState = 'finished';
  public onfinish: (() => void) | null = null;
  public oncancel: (() => void) | null = null;

  // An animation settles once: without the latch a `cancel()` before the queued auto-finish would fire
  // `oncancel` and then `onfinish`. It is set before notifying, so a handler that re-enters
  // `cancel()`/`finish()` is a no-op.
  private settled = false;

  constructor() {
    super();
    this.finished = Promise.resolve(this);
    queueMicrotask(() => this.finish());
  }

  cancel() {
    if (this.settled) return;
    this.settled = true;
    this.playState = 'idle';
    this.dispatchEvent(new Event('cancel'));
    this.oncancel?.();
  }

  finish() {
    if (this.settled) return;
    this.settled = true;
    this.playState = 'finished';
    this.dispatchEvent(new Event('finish'));
    this.onfinish?.();
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

const fakeMediaQueryList = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

const defineMissing = (target: object, key: string, value: unknown) => {
  if (Reflect.get(target, key)) return;

  Object.defineProperty(target, key, { configurable: true, value, writable: true });
};

/**
 * Installs the browser APIs jsdom lacks and `@ethlete/components` needs to render: `ResizeObserver`,
 * `IntersectionObserver`, `matchMedia` and `Element.prototype.animate`. Call it once in a test setup file;
 * an API that already exists is left alone. The fakes never report: observers never fire, no media query
 * matches, and an animation finishes on the next microtask.
 */
export const setupComponentsTestEnvironment = () => {
  defineMissing(globalThis, 'ResizeObserver', ResizeObserverFake);
  defineMissing(globalThis, 'IntersectionObserver', IntersectionObserverFake);
  defineMissing(globalThis, 'matchMedia', fakeMediaQueryList);
  defineMissing(Element.prototype, 'animate', () => new AnimationFake() as unknown as Animation);
};
