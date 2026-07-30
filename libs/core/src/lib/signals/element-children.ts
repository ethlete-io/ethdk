import { computed } from '@angular/core';
import { SignalElementBindingType, buildElementSignal, firstElementSignal } from './element';
import { signalElementMutations } from './element-mutations';
import { signalIsRendered } from './render-utils';

export type SignalElementChildrenOptions = {
  /**
   * What the underlying `MutationObserver` watches for. The default is deliberately broad, because any DOM
   * change *might* change which children an element has.
   *
   * Narrow it wherever the consumer knows better. `attributes: true` in particular makes every inline style
   * or class write anywhere in the subtree re-run this — which for a scroll container whose descendants are
   * written to per animation frame is a change detection tick per frame for nothing. Pass an
   * `attributeFilter` (or drop `attributes`) in that case.
   */
  mutations?: MutationObserverInit;
};

const DEFAULT_CHILDREN_MUTATIONS: MutationObserverInit = { childList: true, subtree: true, attributes: true };

export const signalElementChildren = (el: SignalElementBindingType, options?: SignalElementChildrenOptions) => {
  const elements = buildElementSignal(el);
  const firstEl = firstElementSignal(elements);
  const isRendered = signalIsRendered();
  const elementMutations = signalElementMutations(elements, options?.mutations ?? DEFAULT_CHILDREN_MUTATIONS);

  return computed(
    () => {
      if (!isRendered()) return [];

      const els = firstEl();

      // We are not interested what the mutation is, just that there is one.
      // Changes to the DOM may affect the children of the element.
      elementMutations();

      if (!els.currentElement) return [];

      const children: HTMLElement[] = [];

      for (let index = 0; index < els.currentElement.children.length; index++) {
        const element = els.currentElement.children[index];

        if (element instanceof HTMLElement) {
          children.push(element);
        }
      }

      return children;
    },
    { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
  );
};
