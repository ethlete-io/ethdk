import { ElementRef, Signal, computed, effect, inject } from '@angular/core';
import { equal } from '../utils';
import { SignalElementBindingType, buildElementSignal, firstElementSignal } from './element';
import { NullableElementDimensions, signalElementDimensions } from './element-dimensions';
import { signalElementMutations } from './element-mutations';
import { signalIsRendered } from './render-utils';

export type SignalElementScrollStateOptions = {
  /** The initial scroll position to scroll to. Once a truthy value get's emitted, all further values will be ignored. */
  initialScrollPosition?: Signal<ScrollToOptions | null>;
};

export type ElementScrollState = {
  canScroll: boolean;
  canScrollHorizontally: boolean;
  canScrollVertically: boolean;
  elementDimensions: NullableElementDimensions;
};

export const areScrollStatesEqual = (a: ElementScrollState, b: ElementScrollState) => {
  return (
    a.canScroll === b.canScroll &&
    a.canScrollHorizontally === b.canScrollHorizontally &&
    a.canScrollVertically === b.canScrollVertically &&
    equal(a.elementDimensions, b.elementDimensions)
  );
};

export const signalElementScrollState = (el: SignalElementBindingType, options?: SignalElementScrollStateOptions) => {
  const elements = buildElementSignal(el);
  const observedEl = firstElementSignal(elements);
  const elementDimensions = signalElementDimensions(elements);
  const elementMutations = signalElementMutations(elements, { childList: true, subtree: true, attributes: true });
  const isRendered = signalIsRendered();

  const initialScrollPosition = options?.initialScrollPosition;

  if (initialScrollPosition) {
    const ref = effect(() => {
      if (!isRendered()) return;

      const scrollPosition = initialScrollPosition();
      const element = observedEl().currentElement;

      if (scrollPosition && element) {
        if (scrollPosition.left !== undefined) element.scrollLeft = scrollPosition.left;
        if (scrollPosition.top !== undefined) element.scrollTop = scrollPosition.top;
        ref.destroy();
      }
    });
  }

  const notScrollable = (dimensions: NullableElementDimensions) => ({
    canScroll: false,
    canScrollHorizontally: false,
    canScrollVertically: false,
    elementDimensions: dimensions,
  });

  return computed<ElementScrollState>(
    () => {
      const element = observedEl().currentElement;
      const dimensions = elementDimensions();

      // We are not interested what the mutation is, just that there is one.
      // Changes to the DOM can affect the scroll state of the element.
      elementMutations();

      if (!element || !isRendered()) return notScrollable(dimensions);

      const { scrollWidth, scrollHeight, clientHeight, clientWidth } = element;

      const canScrollHorizontally = scrollWidth > clientWidth;
      const canScrollVertically = scrollHeight > clientHeight;

      return {
        canScroll: canScrollHorizontally || canScrollVertically,
        canScrollHorizontally,
        canScrollVertically,
        elementDimensions: dimensions,
      };
    },
    { equal: (a, b) => areScrollStatesEqual(a, b) },
  );
};

export const signalHostElementScrollState = () => signalElementScrollState(inject(ElementRef));
