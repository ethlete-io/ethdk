import { DestroyRef, effect, ElementRef, inject, NgZone, signal } from '@angular/core';
import { buildElementSignal, firstElementSignal, SignalElementBindingType } from './element';
import { signalIsRendered } from './render-utils';

export const signalElementMutations = (el: SignalElementBindingType, options?: MutationObserverInit) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const firstEl = firstElementSignal(elements);
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();

  const elementMutationsSignal = signal<MutationRecord[]>([]);

  let observer: MutationObserver | null = null;

  effect(() => {
    const els = firstEl();
    const rendered = isRendered();

    elementMutationsSignal.set([]);

    if (!rendered || typeof MutationObserver === 'undefined') {
      return;
    }

    observer ??= new MutationObserver((records) => {
      if (records.length) {
        zone.run(() => elementMutationsSignal.set(records));
      }
    });
    observer.disconnect();

    if (els.currentElement) {
      observer.observe(els.currentElement, options);
    }
  });

  destroyRef.onDestroy(() => observer?.disconnect());

  return elementMutationsSignal.asReadonly();
};

export const signalHostElementMutations = (options?: MutationObserverInit) =>
  signalElementMutations(inject<ElementRef<HTMLElement>>(ElementRef), options);
