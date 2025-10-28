import { DestroyRef, effect, ElementRef, inject, NgZone, signal } from '@angular/core';
import { buildElementSignal, SignalElementBindingType } from './element';
import { signalIsRendered } from './render-utils';

export const signalElementMutations = (el: SignalElementBindingType, options?: MutationObserverInit) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();

  const elementMutationsSignal = signal<MutationRecord | null>(null);

  const observer = new MutationObserver((e) => {
    if (!isRendered()) return;

    const entry = e[0];

    if (entry) {
      zone.run(() => elementMutationsSignal.set(entry));
    }
  });

  effect(() => {
    const els = elements();

    elementMutationsSignal.set(null);

    if (els.previousElement) {
      observer.disconnect();
    }

    if (els.currentElement) {
      observer.observe(els.currentElement, options);
    }
  });

  destroyRef.onDestroy(() => observer.disconnect());

  return elementMutationsSignal.asReadonly();
};

export const signalHostElementMutations = (options?: MutationObserverInit) =>
  signalElementMutations(inject(ElementRef), options);
