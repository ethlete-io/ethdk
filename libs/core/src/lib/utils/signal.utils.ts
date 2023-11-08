import { coerceElement } from '@angular/cdk/coercion';
import {
  ChangeDetectorRef,
  DestroyRef,
  EffectRef,
  ElementRef,
  QueryList,
  Signal,
  effect,
  inject,
  isDevMode,
  isSignal,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, map, of, pairwise, startWith, switchMap } from 'rxjs';

type SignalElementBindingComplexType =
  | HTMLElement
  | ElementRef<HTMLElement>
  | QueryList<ElementRef<HTMLElement> | HTMLElement>
  | null
  | undefined;

type SignalElementBindingType =
  | HTMLElement
  | ElementRef<HTMLElement>
  | Observable<SignalElementBindingComplexType>
  | Signal<SignalElementBindingComplexType>
  | QueryList<ElementRef<HTMLElement> | HTMLElement>;

const buildElementSignal = (el: SignalElementBindingType) => {
  let mElSignal: Signal<HTMLElement | null | undefined> | null = null;

  const switchElement = () =>
    switchMap((elOrRef) => {
      if (elOrRef instanceof QueryList) {
        return elOrRef.changes.pipe(
          startWith(elOrRef),
          map(() => (elOrRef.first ? coerceElement(elOrRef.first) : null)),
        );
      } else {
        return of(coerceElement(elOrRef));
      }
    });

  if (el instanceof Observable) {
    mElSignal = toSignal(el.pipe(switchElement()), { initialValue: null });
  } else if (isSignal(el)) {
    mElSignal = toSignal(toObservable(el).pipe(switchElement()));
  } else if (el instanceof QueryList) {
    mElSignal = toSignal(
      el.changes.pipe(
        startWith(el),
        map(() => (el.first ? coerceElement(el.first) : null)),
      ),
    );
  } else {
    mElSignal = signal(coerceElement(el));
  }

  return toSignal(
    toObservable(mElSignal).pipe(
      startWith(null),
      pairwise(),
      map(([previousElement, currentElement]) => ({
        currentElement,
        previousElement,
      })),
    ),
    { initialValue: { currentElement: null, previousElement: null } },
  );
};

export const buildSignalEffects = <T extends Record<string, Signal<unknown>>>(config: {
  map: T;
  eachItemFn: (pair: { key: string; value: unknown }) => void;
  cleanupFn: (pair: { key: string; value: unknown }) => void;
}) => {
  const { map, eachItemFn, cleanupFn } = config;

  const effectRefMap: Record<string, EffectRef> = {};

  for (const [tokenString, signal] of Object.entries(map)) {
    const tokenArray = tokenString.split(' ').filter((token) => !!token);

    for (const token of tokenArray) {
      const ref = effect(() => {
        const value = signal();
        eachItemFn({ key: token, value });
      });

      effectRefMap[token] = ref;
    }
  }

  const has = (token: string) => token in effectRefMap;

  const remove = (...tokens: string[]) => {
    for (const tokenString of tokens) {
      effectRefMap[tokenString]?.destroy();

      cleanupFn({ key: tokenString, value: map[tokenString]?.() });

      delete effectRefMap[tokenString];
    }
  };

  return { remove, has };
};

export const signalClasses = <T extends Record<string, Signal<unknown>>>(el: SignalElementBindingType, classMap: T) => {
  const elements = buildElementSignal(el);

  return buildSignalEffects({
    map: classMap,
    eachItemFn: ({ key, value }) => {
      if (value) {
        elements().currentElement?.classList.add(key);
      } else {
        elements().currentElement?.classList.remove(key);
      }
    },
    cleanupFn: ({ key }) => elements().currentElement?.classList.remove(key),
  });
};

export const signalHostClasses = <T extends Record<string, Signal<unknown>>>(classMap: T) =>
  signalClasses(inject(ElementRef), classMap);

const ALWAYS_TRUE_ATTRIBUTE_KEYS = ['disabled', 'readonly', 'required', 'checked', 'selected'];

export const signalAttributes = <T extends Record<string, Signal<unknown>>>(
  el: SignalElementBindingType,
  attributeMap: T,
) => {
  const elements = buildElementSignal(el);

  return buildSignalEffects({
    map: attributeMap,
    eachItemFn: ({ key, value }) => {
      const valueString = `${value}`;

      if (ALWAYS_TRUE_ATTRIBUTE_KEYS.includes(key)) {
        if (value) {
          elements().currentElement?.setAttribute(key, '');
        } else {
          elements().currentElement?.removeAttribute(key);
        }
      } else {
        if (value === null || value === undefined) {
          elements().currentElement?.removeAttribute(key);
        } else {
          elements().currentElement?.setAttribute(key, valueString);
        }
      }
    },
    cleanupFn: ({ key }) => elements().currentElement?.removeAttribute(key),
  });
};

export const signalHostAttributes = <T extends Record<string, Signal<unknown>>>(attributeMap: T) =>
  signalAttributes(inject(ElementRef), attributeMap);

export const signalStyles = <T extends Record<string, Signal<unknown>>>(el: SignalElementBindingType, styleMap: T) => {
  const elements = buildElementSignal(el);

  return buildSignalEffects({
    map: styleMap,
    eachItemFn: ({ key, value }) => {
      const valueString = `${value}`;

      elements().currentElement?.style.setProperty(key, valueString);
    },
    cleanupFn: ({ key }) => elements().currentElement?.style.removeProperty(key),
  });
};

export const signalHostStyles = <T extends Record<string, Signal<unknown>>>(styleMap: T) =>
  signalStyles(inject(ElementRef), styleMap);

export interface LogicalSize {
  inlineSize: number;
  blockSize: number;
}

export interface ElementDimensions {
  rect: DOMRectReadOnly | null;
  borderBoxSize: LogicalSize | null;
  contentBoxSize: LogicalSize | null;
  devicePixelContentBoxSize: LogicalSize | null;
}

export const signalElementDimensions = (el: SignalElementBindingType) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const cdr = inject(ChangeDetectorRef);

  const initialValue = () => ({
    rect: elements().currentElement?.getBoundingClientRect() ?? null,
    borderBoxSize: null,
    contentBoxSize: null,
    devicePixelContentBoxSize: null,
  });

  const elementDimensionsSignal = signal<ElementDimensions>(initialValue());

  const observer = new ResizeObserver((e) => {
    const entry = e[0];

    if (entry) {
      const devicePixelContentBoxSize = entry.devicePixelContentBoxSize?.[0] ?? null;
      const borderBoxSize = entry.borderBoxSize?.[0] ?? null;
      const contentBoxSize = entry.contentBoxSize?.[0] ?? null;

      elementDimensionsSignal.set({
        rect: entry.contentRect,
        borderBoxSize: borderBoxSize
          ? { inlineSize: borderBoxSize.inlineSize, blockSize: borderBoxSize.blockSize }
          : null,
        contentBoxSize: contentBoxSize
          ? { inlineSize: contentBoxSize.inlineSize, blockSize: contentBoxSize.blockSize }
          : null,
        devicePixelContentBoxSize: devicePixelContentBoxSize
          ? { inlineSize: devicePixelContentBoxSize.inlineSize, blockSize: devicePixelContentBoxSize.blockSize }
          : null,
      });

      cdr.detectChanges();
    }
  });

  effect(
    () => {
      const els = elements();

      elementDimensionsSignal.set(initialValue());

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

      if (els.previousElement) {
        observer.unobserve(els.previousElement);
      }
    },
    { allowSignalWrites: true },
  );

  destroyRef.onDestroy(() => observer.disconnect());

  return elementDimensionsSignal;
};

export const signalHostElementDimensions = () => signalElementDimensions(inject(ElementRef));
