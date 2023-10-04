import { coerceElement } from '@angular/cdk/coercion';
import { EffectRef, ElementRef, Signal, computed, effect, inject, isSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';

type SignalElementBindingType =
  | HTMLElement
  | ElementRef<HTMLElement>
  | Observable<HTMLElement | ElementRef<HTMLElement> | null | undefined>
  | Signal<HTMLElement | ElementRef<HTMLElement> | null | undefined>;

const buildElementSignal = (el: SignalElementBindingType) => {
  let mElSignal: Signal<HTMLElement | null | undefined> | null = null;

  if (el instanceof Observable) {
    mElSignal = toSignal(el.pipe(map((elOrRef) => coerceElement(elOrRef))), { initialValue: null });
  } else if (isSignal(el)) {
    mElSignal = computed(() => coerceElement(el()));
  } else {
    mElSignal = signal(coerceElement(el));
  }

  return mElSignal as Signal<HTMLElement | null | undefined>;
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
  const element = buildElementSignal(el);

  return buildSignalEffects({
    map: classMap,
    eachItemFn: ({ key, value }) => {
      if (value) {
        element()?.classList.add(key);
      } else {
        element()?.classList.remove(key);
      }
    },
    cleanupFn: ({ key }) => element()?.classList.remove(key),
  });
};

export const signalHostClasses = <T extends Record<string, Signal<unknown>>>(classMap: T) =>
  signalClasses(inject(ElementRef), classMap);

const ALWAYS_TRUE_ATTRIBUTE_KEYS = ['disabled', 'readonly', 'required', 'checked', 'selected'];

export const signalAttributes = <T extends Record<string, Signal<unknown>>>(
  el: SignalElementBindingType,
  attributeMap: T,
) => {
  const element = buildElementSignal(el);

  return buildSignalEffects({
    map: attributeMap,
    eachItemFn: ({ key, value }) => {
      const valueString = `${value}`;

      if (ALWAYS_TRUE_ATTRIBUTE_KEYS.includes(key)) {
        if (value) {
          element()?.setAttribute(key, '');
        } else {
          element()?.removeAttribute(key);
        }
      } else {
        if (value === null || value === undefined) {
          element()?.removeAttribute(key);
        } else {
          element()?.setAttribute(key, valueString);
        }
      }
    },
    cleanupFn: ({ key }) => element!()?.removeAttribute(key),
  });
};

export const signalHostAttributes = <T extends Record<string, Signal<unknown>>>(attributeMap: T) =>
  signalAttributes(inject(ElementRef), attributeMap);

export const signalStyles = <T extends Record<string, Signal<unknown>>>(el: SignalElementBindingType, styleMap: T) => {
  const element = buildElementSignal(el);

  return buildSignalEffects({
    map: styleMap,
    eachItemFn: ({ key, value }) => {
      const valueString = `${value}`;

      element()?.style.setProperty(key, valueString);
    },
    cleanupFn: ({ key }) => element()?.style.removeProperty(key),
  });
};

export const signalHostStyles = <T extends Record<string, Signal<unknown>>>(styleMap: T) =>
  signalStyles(inject(ElementRef), styleMap);
