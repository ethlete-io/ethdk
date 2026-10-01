import {
  DestroyRef,
  ElementRef,
  NgZone,
  Signal,
  afterRenderEffect,
  effect,
  inject,
  isSignal,
  signal,
  untracked,
} from '@angular/core';
import { isElementVisible } from '../scrolling';
import {
  ElementSignalValue,
  SignalElementBindingType,
  buildElementSignal,
  createEmptyElementSignal,
  firstElementSignal,
} from './element';
import { signalIsRendered } from './render-utils';
import { MaybeSignal } from './signal-data-utils';

export type SignalElementIntersectionOptions = Omit<IntersectionObserverInit, 'root' | 'rootMargin' | 'threshold'> & {
  root?: SignalElementBindingType;
  rootMargin?: MaybeSignal<string>;
  threshold?: MaybeSignal<number | number[]>;
  enabled?: Signal<boolean>;
};

export type IntersectionObserverEntryWithDetails = IntersectionObserverEntry & {
  isAbove: boolean;
  isBelow: boolean;
  isLeft: boolean;
  isRight: boolean;
  isVisible: boolean;
};

const createPositionObject = (entry: IntersectionObserverEntry) => {
  const boundingRect = entry.boundingClientRect;
  const rootBounds = entry.rootBounds;

  let isAbove = false;
  let isBelow = false;
  let isLeft = false;
  let isRight = false;

  if (rootBounds) {
    isAbove = boundingRect.bottom < rootBounds.top;
    isBelow = boundingRect.top > rootBounds.bottom;
    isLeft = boundingRect.right < rootBounds.left;
    isRight = boundingRect.left > rootBounds.right;
  }

  // We cant use entry.isIntersecting to determine actual visibility since we are using a big threshold array to get more intersection events.
  const isVisible = !isAbove && !isBelow && !isLeft && !isRight && entry.intersectionRatio > 0;

  return {
    isAbove,
    isBelow,
    isLeft,
    isRight,
    isVisible,
  };
};

const unwrap = <T>(value: MaybeSignal<T>) => (isSignal(value) ? value() : value);

const isZeroMargin = (margin: string | undefined) => !margin || /^(0(px|%)?\s*)+$/.test(margin.trim());

export const signalElementIntersection = (el: SignalElementBindingType, options?: SignalElementIntersectionOptions) => {
  const { root: rootBinding, enabled, rootMargin, threshold, ...observerOptions } = options ?? {};
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const root = firstElementSignal(rootBinding ? buildElementSignal(rootBinding) : createEmptyElementSignal());
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();
  const isEnabled = enabled ?? signal(true);

  const elementIntersectionSignal = signal<IntersectionObserverEntryWithDetails[]>([]);
  const observer = signal<IntersectionObserver | null>(null);

  const currentlyObservedElements = new Set<HTMLElement>();
  let observedRootMargin: string | undefined;

  const updateIntersections = (entries: IntersectionObserverEntry[]) => {
    let currentValues = [...elementIntersectionSignal()];

    for (const entry of entries) {
      const existingEntryIndex = currentValues.findIndex((v) => v.target === entry.target);

      // Round the intersection ratio to the nearest 0.01 to avoid floating point errors and system scaling issues.
      const roundedIntersectionRatio = Math.round(entry.intersectionRatio * 100) / 100;

      const intersectionEntry: IntersectionObserverEntryWithDetails = {
        boundingClientRect: entry.boundingClientRect,
        intersectionRatio: roundedIntersectionRatio,
        intersectionRect: entry.intersectionRect,
        isIntersecting: entry.isIntersecting,
        rootBounds: entry.rootBounds,
        target: entry.target,
        time: entry.time,
        ...createPositionObject(entry),
      };

      if (existingEntryIndex !== -1) {
        currentValues = [
          ...currentValues.slice(0, existingEntryIndex),
          intersectionEntry,
          ...currentValues.slice(existingEntryIndex + 1),
        ];
      } else {
        currentValues = [...currentValues, intersectionEntry];
      }
    }

    zone.run(() => elementIntersectionSignal.set(currentValues));
  };

  const updateIntersectionObserver = (
    rendered: boolean,
    enabled: boolean,
    rootEl: HTMLElement | null,
    margin: string | undefined,
    thresholdValue: number | number[] | undefined,
  ) => {
    observer()?.disconnect();
    currentlyObservedElements.clear();

    if (!rendered || !enabled) {
      observer.set(null);
      elementIntersectionSignal.set([]);

      return;
    }

    const newObserver = new IntersectionObserver((entries) => updateIntersections(entries), {
      ...observerOptions,
      ...(margin !== undefined && { rootMargin: margin }),
      ...(thresholdValue !== undefined && { threshold: thresholdValue }),
      root: rootEl,
    });

    observedRootMargin = margin;
    observer.set(newObserver);
  };

  const updateObservedElements = (observer: IntersectionObserver | null, elements: ElementSignalValue) => {
    const rootEl = root().currentElement;

    if (!observer) {
      elementIntersectionSignal.set([]);

      return;
    }

    const currIntersectionValue = elementIntersectionSignal();
    const newIntersectionValue: IntersectionObserverEntryWithDetails[] = [];

    for (const el of elements.currentElements) {
      if (currentlyObservedElements.has(el)) {
        const existingEntry = currIntersectionValue.find((v) => v.target === el);

        if (existingEntry) newIntersectionValue.push(existingEntry);
        continue;
      }

      currentlyObservedElements.add(el);
      observer.observe(el);

      // isElementVisible ignores rootMargin, so with one set the observer's own first entry is the only correct one.
      if (!isZeroMargin(observedRootMargin)) continue;

      const initialElementVisibility = isElementVisible({
        container: rootEl,
        element: el,
      });
      if (!initialElementVisibility) continue;

      const intersectionEntry: IntersectionObserverEntry = {
        boundingClientRect: initialElementVisibility.elementRect,
        intersectionRatio: initialElementVisibility.intersectionRatio,
        intersectionRect: initialElementVisibility.elementRect,
        isIntersecting: initialElementVisibility.isIntersecting,
        rootBounds: initialElementVisibility.containerRect,
        target: el,
        time: performance.now(),
      };

      newIntersectionValue.push({
        ...intersectionEntry,
        ...createPositionObject(intersectionEntry),
      });
    }

    for (const el of elements.previousElements) {
      if (elements.currentElements.includes(el)) continue;

      observer.unobserve(el);
      currentlyObservedElements.delete(el);
    }

    elementIntersectionSignal.set(newIntersectionValue);
  };

  effect(() => {
    const rootEl = root().currentElement;
    const rendered = isRendered();
    const enabled = isEnabled();
    const margin = rootMargin === undefined ? undefined : unwrap(rootMargin);
    const thresholdValue = threshold === undefined ? undefined : unwrap(threshold);

    untracked(() => updateIntersectionObserver(rendered, enabled, rootEl, margin, thresholdValue));
  });

  // The initial entries are measured here, not in an effect: an effect runs during change detection,
  // before elements rendered in the same pass have their layout.
  afterRenderEffect(() => {
    const els = elements();
    const obs = observer();

    untracked(() => updateObservedElements(obs, els));
  });

  destroyRef.onDestroy(() => observer()?.disconnect());

  return elementIntersectionSignal.asReadonly();
};

export const signalHostElementIntersection = (options?: SignalElementIntersectionOptions) =>
  signalElementIntersection(inject<ElementRef<HTMLElement>>(ElementRef), options);
