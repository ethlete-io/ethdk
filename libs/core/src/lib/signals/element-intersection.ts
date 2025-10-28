import { DestroyRef, ElementRef, NgZone, Signal, effect, inject, signal, untracked } from '@angular/core';
import { isElementVisible } from '../utils';
import {
  ElementSignalValue,
  SignalElementBindingType,
  buildElementSignal,
  documentElementSignal,
  firstElementSignal,
} from './element';
import { signalIsRendered } from './render-utils';

export type SignalElementIntersectionOptions = Omit<IntersectionObserverInit, 'root'> & {
  root?: SignalElementBindingType;
  enabled?: Signal<boolean>;
};

export const signalElementIntersection = (el: SignalElementBindingType, options?: SignalElementIntersectionOptions) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const root = firstElementSignal(options?.root ? buildElementSignal(options?.root) : documentElementSignal());
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();
  const isEnabled = options?.enabled ?? signal(true);

  const elementIntersectionSignal = signal<IntersectionObserverEntry[]>([]);
  const observer = signal<IntersectionObserver | null>(null);

  const currentlyObservedElements = new Set<HTMLElement>();

  const updateIntersections = (entries: IntersectionObserverEntry[]) => {
    let currentValues = [...elementIntersectionSignal()];

    for (const entry of entries) {
      const existingEntryIndex = currentValues.findIndex((v) => v.target === entry.target);

      // Round the intersection ratio to the nearest 0.01 to avoid floating point errors and system scaling issues.
      const roundedIntersectionRatio = Math.round(entry.intersectionRatio * 100) / 100;

      const intersectionEntry: IntersectionObserverEntry = {
        boundingClientRect: entry.boundingClientRect,
        intersectionRatio: roundedIntersectionRatio,
        intersectionRect: entry.intersectionRect,
        isIntersecting: entry.isIntersecting,
        rootBounds: entry.rootBounds,
        target: entry.target,
        time: entry.time,
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

  const updateIntersectionObserver = (rendered: boolean, enabled: boolean, rootEl: HTMLElement | null) => {
    observer()?.disconnect();
    currentlyObservedElements.clear();

    if (!rendered || !enabled || !rootEl) {
      observer.set(null);
      return;
    }

    const newObserver = new IntersectionObserver((entries) => updateIntersections(entries), {
      ...options,
      root: rootEl,
    });

    observer.set(newObserver);
  };

  const updateObservedElements = (observer: IntersectionObserver | null, elements: ElementSignalValue) => {
    const rootEl = root().currentElement;

    if (!observer || !rootEl) return;

    const rootBounds = rootEl.getBoundingClientRect();

    const currIntersectionValue = elementIntersectionSignal();
    const newIntersectionValue: IntersectionObserverEntry[] = [];

    for (const el of elements.currentElements) {
      if (currentlyObservedElements.has(el)) {
        const existingEntryIndex = currIntersectionValue.findIndex((v) => v.target === el);
        const existingEntry = currIntersectionValue[existingEntryIndex];

        if (!existingEntry) {
          console.warn('Could not find existing entry for element. The intersection observer might be broken now.', el);
          continue;
        }

        newIntersectionValue.push(existingEntry);
        continue;
      }

      const elBounds = el.getBoundingClientRect();

      const initialElementVisibility = isElementVisible({
        container: rootEl,
        element: el,
        containerRect: rootBounds,
        elementRect: elBounds,
      });

      if (!initialElementVisibility) {
        console.error('No visibility data found for element.', {
          element: el,
          container: rootEl,
        });

        continue;
      }

      const intersectionEntry: IntersectionObserverEntry = {
        boundingClientRect: elBounds,
        intersectionRatio: initialElementVisibility.intersectionRatio,
        intersectionRect: elBounds,
        isIntersecting: initialElementVisibility.isIntersecting,
        rootBounds: rootBounds,
        target: el,
        time: performance.now(),
      };

      newIntersectionValue.push(intersectionEntry);

      currentlyObservedElements.add(el);
      observer.observe(el);
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

    untracked(() => updateIntersectionObserver(rendered, enabled, rootEl));
  });

  effect(() => {
    const els = elements();
    const obs = observer();

    untracked(() => updateObservedElements(obs, els));
  });

  destroyRef.onDestroy(() => observer()?.disconnect());

  return elementIntersectionSignal.asReadonly();
};

export const signalHostElementIntersection = (options?: SignalElementIntersectionOptions) =>
  signalElementIntersection(inject(ElementRef), options);
