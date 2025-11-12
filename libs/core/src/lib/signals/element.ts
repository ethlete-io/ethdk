import { coerceElement } from '@angular/cdk/coercion';
import { DOCUMENT, ElementRef, QueryList, Signal, computed, inject, isSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, map, of, pairwise, startWith, switchMap } from 'rxjs';

export type SignalElementBindingComplexType =
  | HTMLElement
  | ElementRef<HTMLElement>
  | QueryList<ElementRef<HTMLElement> | HTMLElement>
  | Array<ElementRef<HTMLElement> | HTMLElement>
  | null
  | undefined;

export type SignalElementBindingType =
  | HTMLElement
  | ElementRef<HTMLElement>
  | Observable<SignalElementBindingComplexType>
  | Signal<SignalElementBindingComplexType>
  | QueryList<ElementRef<HTMLElement> | HTMLElement>
  | ElementSignal;

export type ElementSignal = Signal<{
  /** @deprecated Always use currentElements  */
  currentElement: HTMLElement | null;

  /** @deprecated Always use previousElements  */
  previousElement: HTMLElement | null;

  currentElements: HTMLElement[];
  previousElements: HTMLElement[];
}>;

export type ElementSignalValue = ReturnType<ElementSignal>;

export const isElementSignal = (el: unknown): el is ElementSignal => {
  if (isSignal(el)) {
    const val = el();
    return typeof val === 'object' && val !== null && 'currentElement' in val && 'previousElement' in val;
  }

  return false;
};

export const createDocumentElementSignal = (): ElementSignal =>
  signal({
    currentElement: inject(DOCUMENT).documentElement,
    previousElement: null,
    currentElements: [inject(DOCUMENT).documentElement],
    previousElements: [],
  });

export const createEmptyElementSignal = (): ElementSignal =>
  signal({
    currentElement: null,
    previousElement: null,
    currentElements: [],
    previousElements: [],
  });

export const buildElementSignal = (el: SignalElementBindingType | null | undefined): ElementSignal => {
  if (el === null || el === undefined) {
    return signal({ currentElement: null, previousElement: null, currentElements: [], previousElements: [] });
  }

  if (isElementSignal(el)) {
    return el;
  }

  let mElSignal: Signal<HTMLElement[] | null> | null = null;

  const switchElement = () =>
    switchMap((elOrRef: SignalElementBindingComplexType) => {
      if (elOrRef instanceof QueryList) {
        return elOrRef.changes.pipe(
          startWith(elOrRef),
          map(() => elOrRef.toArray().map((r) => coerceElement(r))),
        );
      } else if (Array.isArray(elOrRef)) {
        return of(elOrRef.map((r) => coerceElement(r)));
      } else {
        const coercedEl = coerceElement(elOrRef);
        return of(coercedEl ? [coercedEl] : null);
      }
    });

  if (el instanceof Observable) {
    mElSignal = toSignal(el.pipe(switchElement()), { initialValue: null });
  } else if (isSignal(el)) {
    mElSignal = toSignal(toObservable(el).pipe(switchElement()), { initialValue: null });
  } else if (el instanceof QueryList) {
    mElSignal = toSignal(
      el.changes.pipe(
        startWith(el),
        map(() => el.toArray().map((r) => coerceElement(r))),
      ),
      { initialValue: null },
    );
  } else {
    mElSignal = signal([coerceElement(el)]);
  }

  const elSig = toSignal(
    toObservable(mElSignal).pipe(
      startWith(null),
      pairwise(),
      map(([previousElements, currentElements]) => {
        const previousEl = previousElements?.[0] ?? null;
        const currentEl = currentElements?.[0] ?? null;

        if (currentEl && !(currentEl instanceof HTMLElement)) {
          console.error(
            'Received an element that is not an HTMLElement. You are probably using viewChild or contentChild on a component without the read option set to ElementRef. This will cause issues. Received:',
            currentEl,
          );
        }

        return {
          previousElements: previousElements ?? [],
          currentElements: currentElements ?? [],
          currentElement: currentEl,
          previousElement: previousEl,
        };
      }),
    ),
    { initialValue: { currentElement: null, previousElement: null, previousElements: [], currentElements: [] } },
  );

  return computed(() => elSig(), {
    equal: (a, b) =>
      a.currentElement === b.currentElement &&
      a.previousElement === b.previousElement &&
      a.currentElements.length === b.currentElements.length &&
      a.currentElements.every((v, i) => v === b.currentElements[i]) &&
      a.previousElements.length === b.previousElements.length &&
      a.previousElements.every((v, i) => v === b.previousElements[i]),
  });
};

export const firstElementSignal = (el: ElementSignal) => {
  return computed(
    () => {
      const current = el();

      if (current.currentElements.length > 1) {
        console.warn(
          'More than one element is bound to the signal. Only the first element will be used.',
          current.currentElements,
        );
      }

      const curr = current.currentElements[0] ?? null;
      const prev = current.previousElements[0] ?? null;

      return { currentElement: curr, previousElement: prev };
    },
    { equal: (a, b) => a.currentElement === b.currentElement && a.previousElement === b.previousElement },
  );
};
