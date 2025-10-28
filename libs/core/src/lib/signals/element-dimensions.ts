import { computed, DestroyRef, effect, ElementRef, inject, isDevMode, NgZone, signal, untracked } from '@angular/core';
import { equal } from '../utils';
import { buildElementSignal, SignalElementBindingType } from './element';
import { signalIsRendered } from './render-utils';

export interface LogicalSize {
  inlineSize: number;
  blockSize: number;
}

export type ElementRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
};

export type ElementSize = {
  width: number;
  height: number;
};

export const boundingClientRectToElementRect = (rect: DOMRectReadOnly): ElementRect => ({
  bottom: rect.bottom,
  height: rect.height,
  left: rect.left,
  right: rect.right,
  top: rect.top,
  width: rect.width,
  x: rect.x,
  y: rect.y,
});

export const createElementDimensions = (el: HTMLElement | null, rect?: DOMRect): NullableElementDimensions => {
  if (!el) {
    return {
      rect: null,
      client: null,
      scroll: null,
      offset: null,
    };
  }

  const cachedNormalizedRect = rect ? boundingClientRectToElementRect(rect) : null;
  const rectFn = () =>
    cachedNormalizedRect ? cachedNormalizedRect : boundingClientRectToElementRect(el.getBoundingClientRect());

  return {
    rect: rectFn,
    client: { width: el.clientWidth, height: el.clientHeight },
    scroll: { width: el.scrollWidth, height: el.scrollHeight },
    offset: { width: el.offsetWidth, height: el.offsetHeight },
  };
};

export type ElementDimensions = {
  rect: () => ElementRect;
  client: ElementSize;
  scroll: ElementSize;
  offset: ElementSize;
};

export type NullableElementDimensions = {
  [K in keyof ElementDimensions]: ElementDimensions[K] | null;
};

export const signalElementDimensions = (el: SignalElementBindingType) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();

  const initialValue = () => createElementDimensions(elements().currentElement);

  const elementDimensionsSignal = signal<NullableElementDimensions>(initialValue());

  const observer = new ResizeObserver((e) => {
    if (!isRendered()) return;

    const entry = e[0];

    if (entry) {
      const target = entry.target as HTMLElement;
      const newDimensions = createElementDimensions(target);

      zone.run(() => elementDimensionsSignal.set(newDimensions));
    }
  });

  effect(() => {
    const els = elements();

    untracked(() => {
      elementDimensionsSignal.set(initialValue());

      if (els.previousElement) {
        observer.disconnect();
      }

      if (els.currentElement) {
        const computedDisplay = getComputedStyle(els.currentElement).display;
        const currentElIsAngularComponent = els.currentElement?.tagName.toLowerCase().includes('-');

        if (computedDisplay === 'inline' && isDevMode() && currentElIsAngularComponent) {
          console.error(
            `Element <${els.currentElement?.tagName.toLowerCase()}> is an Angular component and has a display of 'inline'. Inline elements cannot be observed for dimensions. Please change it to 'block' or something else.`,
          );
        }

        observer.observe(els.currentElement);
      }
    });
  });

  destroyRef.onDestroy(() => observer.disconnect());

  return computed(() => elementDimensionsSignal(), {
    equal: (a, b) => equal(a, b),
  });
};

export const signalHostElementDimensions = () => signalElementDimensions(inject(ElementRef));
