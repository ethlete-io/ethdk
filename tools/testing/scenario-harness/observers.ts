type FakeObserverRecord = {
  observer: IntersectionObserver;
  callback: IntersectionObserverCallback;
  observed: Set<Element>;
};

const createEntry = (target: Element, isIntersecting: boolean): IntersectionObserverEntry => {
  const rect = target.getBoundingClientRect();

  return {
    target,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: rect,
    intersectionRect: rect,
    rootBounds: null,
    time: performance.now(),
  };
};

/**
 * An `IntersectionObserver` that reports only what the scenario tells it to. jsdom has none, and a
 * real one would decide intersection from layout jsdom does not compute.
 */
export const installFakeIntersectionObserver = () => {
  const globals = globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver };
  const original = globals.IntersectionObserver;
  const records = new Set<FakeObserverRecord>();

  class FakeIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds: readonly number[] = [0];
    private readonly record: FakeObserverRecord;

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.root = options?.root ?? null;
      this.record = { observer: this, callback, observed: new Set() };
      records.add(this.record);
    }

    observe(target: Element) {
      this.record.observed.add(target);
    }

    unobserve(target: Element) {
      this.record.observed.delete(target);
    }

    disconnect() {
      this.record.observed.clear();
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globals.IntersectionObserver = FakeIntersectionObserver;

  return {
    observed: () => [...records].flatMap((record) => [...record.observed]),
    intersect: (target: Element, isIntersecting: boolean) => {
      records.forEach((record) => {
        if (record.observed.has(target)) record.callback([createEntry(target, isIntersecting)], record.observer);
      });
    },
    restore: () => {
      if (original) globals.IntersectionObserver = original;
      else delete globals.IntersectionObserver;
    },
  };
};
