import { computed } from '@angular/core';
import { SignalElementBindingType, buildElementSignal } from './element';
import { signalElementMutations } from './element-mutations';
import { signalIsRendered } from './render-utils';

export const signalElementChildren = (el: SignalElementBindingType) => {
  const elements = buildElementSignal(el);
  const isRendered = signalIsRendered();
  const elementMutations = signalElementMutations(elements, { childList: true, subtree: true, attributes: true });

  return computed(
    () => {
      if (!isRendered()) return [];

      const els = elements();

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
