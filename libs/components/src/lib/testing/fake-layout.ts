const ELEMENT_METRICS = ['clientHeight', 'clientWidth'] as const;
const HTML_ELEMENT_METRICS = ['offsetHeight', 'offsetLeft', 'offsetTop', 'offsetWidth'] as const;

export type LayoutMetric = number | ((element: Element) => number);

export type LayoutRect = Partial<DOMRect> | ((element: Element) => Partial<DOMRect>);

export type LayoutRule = {
  match: string | ((element: Element) => boolean);
  clientHeight?: LayoutMetric;
  clientWidth?: LayoutMetric;
  offsetHeight?: LayoutMetric;
  offsetLeft?: LayoutMetric;
  offsetTop?: LayoutMetric;
  offsetWidth?: LayoutMetric;
  rect?: LayoutRect;
};

type MetricName = (typeof ELEMENT_METRICS)[number] | (typeof HTML_ELEMENT_METRICS)[number];

export type ScrollCall = {
  method: 'scroll' | 'scrollTo';
  options: ScrollToOptions;
  target: Element;
};

export type FakeElementScroll = {
  calls: () => ScrollCall[];
  lastCall: () => ScrollCall | null;
  restore: () => void;
};

export type FakeResizeObserver = {
  fire: (target?: Element, entryInit?: Partial<ResizeObserverEntry>) => void;
  restore: () => void;
  targets: () => Element[];
};

export type FakeIntersectionObserver = {
  fire: (target?: Element, entryInit?: Partial<IntersectionObserverEntry>) => void;
  restore: () => void;
  targets: () => Element[];
};

const once = (restore: () => void) => {
  let restored = false;

  return () => {
    if (restored) return;

    restored = true;
    restore();
  };
};

const matchesRule = (rule: LayoutRule, element: Element) =>
  typeof rule.match === 'string' ? element.matches(rule.match) : rule.match(element);

const toRect = (partial: Partial<DOMRect>): DOMRect => {
  const x = partial.x ?? partial.left ?? 0;
  const y = partial.y ?? partial.top ?? 0;
  const width = partial.width ?? (partial.right ?? x) - x;
  const height = partial.height ?? (partial.bottom ?? y) - y;
  const rect = { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height, ...partial };

  return { ...rect, toJSON: () => rect } as DOMRect;
};

const installProperty = (prototype: object, property: string, value: unknown) => {
  const original = Object.getOwnPropertyDescriptor(prototype, property);

  Object.defineProperty(prototype, property, { configurable: true, value, writable: true });

  return () => {
    if (original) Object.defineProperty(prototype, property, original);
    else Reflect.deleteProperty(prototype, property);
  };
};

/**
 * Hands the elements a rule matches the metrics that rule names, for the rest of the current test. jsdom
 * performs no layout, so every offset, client size and bounding rect reads `0` - a component measuring its
 * own children cannot get off the ground without this.
 *
 * A rule matches by selector or predicate, and its values may be constants or functions of the element.
 * Only the metrics some rule names are patched at all, and an element no rule matches keeps the original
 * descriptor's answer - so faking a track's children never silently resizes the page around them.
 *
 * Restores itself when the test finishes; the returned function restores earlier, for a test that has to
 * observe both the unmeasurable and the measured state.
 */
export const fakeLayout = (rules: LayoutRule[]) => {
  const restores: (() => void)[] = [];

  const patchMetric = (prototype: object, metric: MetricName) => {
    if (!rules.some((rule) => rule[metric] !== undefined)) return;

    const original = Object.getOwnPropertyDescriptor(prototype, metric);

    Object.defineProperty(prototype, metric, {
      configurable: true,
      get(this: Element) {
        const rule = rules.find((candidate) => candidate[metric] !== undefined && matchesRule(candidate, this));
        const value = rule?.[metric];

        if (value === undefined) return original?.get?.call(this) ?? 0;

        return typeof value === 'function' ? value(this) : value;
      },
    });

    restores.push(() => {
      if (original) Object.defineProperty(prototype, metric, original);
      else Reflect.deleteProperty(prototype, metric);
    });
  };

  const patchRect = () => {
    if (!rules.some((rule) => rule.rect !== undefined)) return;

    const original = Element.prototype.getBoundingClientRect;

    restores.push(
      installProperty(Element.prototype, 'getBoundingClientRect', function (this: Element) {
        const rule = rules.find((candidate) => candidate.rect !== undefined && matchesRule(candidate, this));

        if (!rule?.rect) return original.call(this);

        return toRect(typeof rule.rect === 'function' ? rule.rect(this) : rule.rect);
      }),
    );
  };

  for (const metric of ELEMENT_METRICS) patchMetric(Element.prototype, metric);
  for (const metric of HTML_ELEMENT_METRICS) patchMetric(HTMLElement.prototype, metric);
  patchRect();

  const restore = once(() => restores.forEach((entry) => entry()));

  onTestFinished(restore);

  return restore;
};

/**
 * A {@link fakeLayout} rule laying the elements matching `selector` out in a row of `size`-wide boxes: each
 * reports `size` as its `offsetWidth` and its index among the matching siblings times `size` as its
 * `offsetLeft`. This is the shape a scroll track has, and what a carousel or a tab bar measures.
 */
export const stackedChildren = (selector: string, size: number): LayoutRule => ({
  match: selector,
  offsetWidth: size,
  offsetLeft: (element) => {
    const siblings = Array.from(element.parentElement?.children ?? []).filter((child) => child.matches(selector));

    return Math.max(siblings.indexOf(element), 0) * size;
  },
});

/**
 * A `ResizeObserver` whose callbacks a test can fire, for the rest of the current test - the global mock in
 * `test-helpers` installs the API but never reports. `fire()` reports every observed target, `fire(target)`
 * only that one, each in its own callback invocation; `targets()` is what the component asked to watch.
 */
export const fakeResizeObserver = (): FakeResizeObserver => {
  const observations: { callback: ResizeObserverCallback; targets: Element[] }[] = [];

  class RecordingResizeObserver {
    private observation: { callback: ResizeObserverCallback; targets: Element[] };

    constructor(callback: ResizeObserverCallback) {
      this.observation = { callback, targets: [] };
      observations.push(this.observation);
    }

    observe(target: Element) {
      if (!this.observation.targets.includes(target)) this.observation.targets.push(target);
    }

    unobserve(target: Element) {
      this.observation.targets = this.observation.targets.filter((candidate) => candidate !== target);
    }

    disconnect() {
      this.observation.targets = [];
    }
  }

  const restore = once(installProperty(globalThis, 'ResizeObserver', RecordingResizeObserver));

  onTestFinished(restore);

  return {
    restore,
    targets: () => observations.flatMap((observation) => observation.targets),
    fire: (target, entryInit) => {
      for (const observation of observations) {
        for (const observed of observation.targets) {
          if (target && observed !== target) continue;

          observation.callback([{ target: observed, ...entryInit } as ResizeObserverEntry], {} as ResizeObserver);
        }
      }
    },
  };
};

/**
 * An `IntersectionObserver` whose callbacks a test can fire, for the rest of the current test - the global
 * mock in `test-helpers` installs the API but never reports. A fired entry defaults to fully intersecting,
 * so a test only spells out what it is actually asserting on; `targets()` is what the component asked to
 * watch.
 */
export const fakeIntersectionObserver = (): FakeIntersectionObserver => {
  const observations: { callback: IntersectionObserverCallback; targets: Element[] }[] = [];

  class RecordingIntersectionObserver {
    public readonly root: Element | Document | null = null;
    public readonly rootMargin = '';
    public readonly thresholds: readonly number[] = [];

    private observation: { callback: IntersectionObserverCallback; targets: Element[] };

    constructor(callback: IntersectionObserverCallback) {
      this.observation = { callback, targets: [] };
      observations.push(this.observation);
    }

    observe(target: Element) {
      if (!this.observation.targets.includes(target)) this.observation.targets.push(target);
    }

    unobserve(target: Element) {
      this.observation.targets = this.observation.targets.filter((candidate) => candidate !== target);
    }

    disconnect() {
      this.observation.targets = [];
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  const restore = once(installProperty(globalThis, 'IntersectionObserver', RecordingIntersectionObserver));

  onTestFinished(restore);

  return {
    restore,
    targets: () => observations.flatMap((observation) => observation.targets),
    fire: (target, entryInit) => {
      for (const observation of observations) {
        for (const observed of observation.targets) {
          if (target && observed !== target) continue;

          const rect = observed.getBoundingClientRect();
          const entry = {
            boundingClientRect: rect,
            intersectionRatio: 1,
            intersectionRect: rect,
            isIntersecting: true,
            rootBounds: null,
            target: observed,
            time: 0,
            ...entryInit,
          } as IntersectionObserverEntry;

          observation.callback([entry], {} as IntersectionObserver);
        }
      }
    },
  };
};

/**
 * Records the `scroll`/`scrollTo` calls a component makes on any element, for the rest of the current test.
 * jsdom implements neither, so scrolling either throws or silently does nothing - and the scroll position a
 * component asked for is the only observable half of scrolling here. Both signatures are recorded as
 * `ScrollToOptions`.
 */
export const fakeElementScroll = (): FakeElementScroll => {
  const calls: ScrollCall[] = [];

  const record = (method: ScrollCall['method']) =>
    function (this: Element, optionsOrLeft?: ScrollToOptions | number, top?: number) {
      const options = typeof optionsOrLeft === 'number' ? { left: optionsOrLeft, top } : (optionsOrLeft ?? {});

      calls.push({ method, options, target: this });
    };

  const restores = [
    installProperty(Element.prototype, 'scroll', record('scroll')),
    installProperty(Element.prototype, 'scrollTo', record('scrollTo')),
  ];

  const restore = once(() => restores.forEach((entry) => entry()));

  onTestFinished(restore);

  return {
    restore,
    calls: () => [...calls],
    lastCall: () => calls.at(-1) ?? null,
  };
};
