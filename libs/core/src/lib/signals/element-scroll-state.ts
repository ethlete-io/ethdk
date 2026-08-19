import { ElementRef, Signal, computed, effect, inject } from '@angular/core';
import { equal } from '../utils';
import { SignalElementBindingType, buildElementSignal, firstElementSignal } from './element';
import { NullableElementDimensions, signalElementDimensions } from './element-dimensions';
import { signalElementMutations } from './element-mutations';
import { signalIsRendered } from './render-utils';

export type SignalElementScrollStateOptions = {
  /** The initial scroll position to scroll to. Once a truthy value get's emitted, all further values will be ignored. */
  initialScrollPosition?: Signal<ScrollToOptions | null>;

  /**
   * What the underlying `MutationObserver` watches for - a proxy for "the content may have changed size, so
   * re-measure whether it still overflows". The default is deliberately broad.
   *
   * Narrow it wherever the consumer knows better. `attributes: true` means every inline style or class write
   * anywhere in the subtree re-runs the measurement, and the measurement reads `scrollWidth`/`scrollHeight`
   * - so a descendant written to per animation frame buys a forced layout per frame.
   */
  mutations?: MutationObserverInit;
};

const DEFAULT_SCROLL_STATE_MUTATIONS: MutationObserverInit = { childList: true, subtree: true, attributes: true };

export type ElementScrollState = {
  canScroll: boolean;
  canScrollHorizontally: boolean;
  canScrollVertically: boolean;
  elementDimensions: NullableElementDimensions;
};

const areScrollStatesEqual = (a: ElementScrollState, b: ElementScrollState) => {
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
  const elementMutations = signalElementMutations(elements, options?.mutations ?? DEFAULT_SCROLL_STATE_MUTATIONS);
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

export const signalHostElementScrollState = () => signalElementScrollState(inject<ElementRef<HTMLElement>>(ElementRef));
