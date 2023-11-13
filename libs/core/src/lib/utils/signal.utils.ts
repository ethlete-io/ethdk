import { coerceElement } from '@angular/cdk/coercion';
import {
  DestroyRef,
  EffectRef,
  ElementRef,
  NgZone,
  QueryList,
  Signal,
  afterNextRender,
  computed,
  effect,
  inject,
  isDevMode,
  isSignal,
  signal,
  untracked,
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
  | QueryList<ElementRef<HTMLElement> | HTMLElement>
  | ElementSignal;

type ElementSignal = Signal<{
  currentElement: HTMLElement | null;
  previousElement: HTMLElement | null;
}>;

function isElementSignal(el: unknown): el is ElementSignal {
  if (isSignal(el)) {
    const val = el();
    return typeof val === 'object' && val !== null && 'currentElement' in val && 'previousElement' in val;
  }

  return false;
}

const documentElementSignal = (): ElementSignal =>
  signal({ currentElement: document.documentElement, previousElement: null });

const buildElementSignal = (el: SignalElementBindingType | null | undefined): ElementSignal => {
  if (el === null || el === undefined) {
    return signal({ currentElement: null, previousElement: null });
  }

  if (isElementSignal(el)) {
    return el;
  }

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
        currentElement: currentElement ?? null,
        previousElement: previousElement ?? null,
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

export const signalIsRendered = () => {
  const isRendered = signal(false);

  afterNextRender(() => isRendered.set(true));

  return isRendered.asReadonly();
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
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();

  const initialValue = () => ({
    rect: elements().currentElement?.getBoundingClientRect() ?? null,
    borderBoxSize: null,
    contentBoxSize: null,
    devicePixelContentBoxSize: null,
  });

  const elementDimensionsSignal = signal<ElementDimensions>(initialValue());

  const observer = new ResizeObserver((e) => {
    if (!isRendered()) return;

    const entry = e[0];

    if (entry) {
      const devicePixelContentBoxSize = entry.devicePixelContentBoxSize?.[0] ?? null;
      const borderBoxSize = entry.borderBoxSize?.[0] ?? null;
      const contentBoxSize = entry.contentBoxSize?.[0] ?? null;

      zone.run(() =>
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
        }),
      );
    }
  });

  effect(
    () => {
      const els = elements();

      elementDimensionsSignal.set(initialValue());

      if (els.previousElement) {
        observer.disconnect();
      }

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
    },
    { allowSignalWrites: true },
  );

  destroyRef.onDestroy(() => observer.disconnect());

  return elementDimensionsSignal.asReadonly();
};

export const signalHostElementDimensions = () => signalElementDimensions(inject(ElementRef));

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

  effect(
    () => {
      const els = elements();

      elementMutationsSignal.set(null);

      if (els.previousElement) {
        observer.disconnect();
      }

      if (els.currentElement) {
        observer.observe(els.currentElement, options);
      }
    },
    { allowSignalWrites: true },
  );

  destroyRef.onDestroy(() => observer.disconnect());

  return elementMutationsSignal.asReadonly();
};

export const signalHostElementMutations = (options?: MutationObserverInit) =>
  signalElementMutations(inject(ElementRef), options);

export const signalElementScrollState = (el: SignalElementBindingType) => {
  const elements = buildElementSignal(el);
  const elementDimensions = signalElementDimensions(elements);
  const elementMutations = signalElementMutations(elements, { childList: true, subtree: true });
  const isRendered = signalIsRendered();

  return computed(() => {
    const element = elements().currentElement;
    const dimensions = elementDimensions();

    const notScrollable = () => ({
      canScroll: false,
      canScrollHorizontally: false,
      canScrollVertically: false,
      scrollWidth: element?.scrollWidth ?? null,
      scrollHeight: element?.scrollHeight ?? null,
      elementDimensions: dimensions,
    });

    // We are not interested what the mutation is, just that there is one.
    // Changes to the DOM can affect the scroll state of the element.
    elementMutations();

    if (!element || !dimensions.rect || !isRendered()) return notScrollable();

    const { scrollWidth, scrollHeight } = element;
    const { width, height } = dimensions.rect;

    const canScrollHorizontally = scrollWidth > width;
    const canScrollVertically = scrollHeight > height;

    return {
      canScroll: canScrollHorizontally || canScrollVertically,
      canScrollHorizontally,
      canScrollVertically,
      scrollWidth,
      scrollHeight,
      elementDimensions: dimensions,
    };
  });
};

export const signalHostElementScrollState = () => signalElementScrollState(inject(ElementRef));

export type SignalElementIntersectionOptions = Omit<IntersectionObserverInit, 'root'> & {
  root?: SignalElementBindingType;
};

export const signalElementIntersection = (el: SignalElementBindingType, options?: SignalElementIntersectionOptions) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const root = options?.root ? buildElementSignal(options?.root) : documentElementSignal();
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();

  const elementIntersectionSignal = signal<IntersectionObserverEntry | null>(null);

  const observer = signal<IntersectionObserver | null>(null);

  effect(
    () => {
      const rootEl = root().currentElement;

      untracked(() => observer()?.disconnect());

      const newObserver = new IntersectionObserver(
        (e) => {
          if (!isRendered()) return;
          const entry = e[0];
          if (entry) {
            zone.run(() => elementIntersectionSignal.set(entry));
          }
        },
        { ...options, root: rootEl },
      );

      observer.set(newObserver);
    },
    { allowSignalWrites: true },
  );

  effect(
    () => {
      const els = elements();
      const obs = observer();

      elementIntersectionSignal.set(null);

      if (els.previousElement) {
        obs?.disconnect();
      }

      if (els.currentElement) {
        obs?.observe(els.currentElement);
      }
    },
    { allowSignalWrites: true },
  );

  destroyRef.onDestroy(() => observer()?.disconnect());

  return elementIntersectionSignal;
};

export const signalHostElementIntersection = (options?: SignalElementIntersectionOptions) =>
  signalElementIntersection(inject(ElementRef), options);
