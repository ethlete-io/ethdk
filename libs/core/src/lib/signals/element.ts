import { coerceElement } from '@angular/cdk/coercion';
import {
  DOCUMENT,
  ElementRef,
  QueryList,
  Signal,
  computed,
  inject,
  isDevMode,
  isSignal,
  linkedSignal,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, map, pairwise, startWith } from 'rxjs';

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
  /** @deprecated Always use currentElements */
  currentElement: HTMLElement | null;
  /** @deprecated Always use previousElements */
  previousElement: HTMLElement | null;
  currentElements: HTMLElement[];
  previousElements: HTMLElement[];
}>;

export type ElementSignalValue = ReturnType<ElementSignal>;

export const isElementSignal = (el: unknown): el is ElementSignal => {
  if (!isSignal(el)) return false;

  const val = el();
  return (
    typeof val === 'object' &&
    val !== null &&
    'currentElement' in val &&
    'previousElement' in val &&
    'currentElements' in val &&
    'previousElements' in val
  );
};

export const createDocumentElementSignal = (): ElementSignal => {
  const documentElement = inject(DOCUMENT).documentElement;
  return signal({
    currentElement: documentElement,
    previousElement: null,
    currentElements: [documentElement],
    previousElements: [],
  });
};

export const createEmptyElementSignal = (): ElementSignal =>
  signal({
    currentElement: null,
    previousElement: null,
    currentElements: [],
    previousElements: [],
  });

const areElementArraysEqual = (a: HTMLElement[], b: HTMLElement[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areElementSignalValuesEqual = (a: ElementSignalValue, b: ElementSignalValue): boolean =>
  a.currentElement === b.currentElement &&
  a.previousElement === b.previousElement &&
  areElementArraysEqual(a.currentElements, b.currentElements) &&
  areElementArraysEqual(a.previousElements, b.previousElements);

export const buildElementSignal = (el: SignalElementBindingType | null | undefined): ElementSignal => {
  if (el === null || el === undefined) return createEmptyElementSignal();
  if (isElementSignal(el)) return el;

  if (el instanceof HTMLElement || el instanceof ElementRef) {
    const element = coerceElement(el);
    if (!element) return createEmptyElementSignal();

    return signal({
      currentElement: element,
      previousElement: null,
      currentElements: [element],
      previousElements: [],
    });
  }

  if (isSignal(el)) return createElementSignalFromSignal(el);

  return createElementSignalFromObservable(createElementsObservable(el));
};

const createElementSignalFromSignal = (input: Signal<SignalElementBindingComplexType>): ElementSignal => {
  return linkedSignal({
    source: input,
    computation: (source, previous) => {
      const currentElements = coerceValueToElementArray(source);
      const previousElements = previous?.value.currentElements ?? [];

      return {
        currentElements,
        previousElements,
        currentElement: currentElements[0] ?? null,
        previousElement: previousElements[0] ?? null,
      };
    },
    equal: areElementSignalValuesEqual,
  });
};

const createElementSignalFromObservable = (elements$: Observable<HTMLElement[]>): ElementSignal => {
  return toSignal(
    elements$.pipe(
      startWith([]),
      pairwise(),
      map(([previousElements, currentElements]) => {
        if (isDevMode()) {
          const invalidElement = currentElements.find((el) => el && !(el instanceof HTMLElement));
          if (invalidElement) {
            console.error(
              'Received an element that is not an HTMLElement. You are probably using viewChild or contentChild on a component without the read option set to ElementRef.',
              invalidElement,
            );
          }
        }

        return {
          previousElements,
          currentElements,
          previousElement: previousElements[0] ?? null,
          currentElement: currentElements[0] ?? null,
        };
      }),
    ),
    {
      initialValue: {
        currentElement: null,
        previousElement: null,
        previousElements: [],
        currentElements: [],
      },
      equal: areElementSignalValuesEqual,
    },
  ) as ElementSignal;
};

const coerceValueToElementArray = (value: SignalElementBindingComplexType): HTMLElement[] => {
  if (value === null || value === undefined) return [];

  const items = value instanceof QueryList ? value.toArray() : Array.isArray(value) ? value : [value];

  const result: HTMLElement[] = [];
  for (const item of items) {
    const el = coerceElement(item);
    if (el) result.push(el);
  }
  return result;
};

const createElementsObservable = (
  input: Observable<SignalElementBindingComplexType> | QueryList<ElementRef<HTMLElement> | HTMLElement>,
): Observable<HTMLElement[]> => {
  if (input instanceof QueryList) {
    return input.changes.pipe(
      startWith(input),
      map(() => coerceValueToElementArray(input)),
    );
  }

  return input.pipe(map(coerceValueToElementArray));
};

export const firstElementSignal = (el: ElementSignal) =>
  computed(
    () => {
      const { currentElements, previousElements } = el();

      if (isDevMode() && currentElements.length > 1) {
        console.warn(
          'More than one element is bound to the signal. Only the first element will be used.',
          currentElements,
        );
      }

      return {
        currentElement: currentElements[0] ?? null,
        previousElement: previousElements[0] ?? null,
      };
    },
    {
      equal: (a, b) => a.currentElement === b.currentElement && a.previousElement === b.previousElement,
    },
  );
