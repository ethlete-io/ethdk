import { coerceElement } from '@angular/cdk/coercion';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  EffectRef,
  ElementRef,
  Injector,
  NgZone,
  PLATFORM_ID,
  QueryList,
  Renderer2,
  RendererStyleFlags2,
  Signal,
  WritableSignal,
  afterNextRender,
  computed,
  effect,
  inject,
  isDevMode,
  isSignal,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl } from '@angular/forms';
import { NavigationEnd, NavigationSkipped, Router } from '@angular/router';
import {
  Observable,
  debounceTime,
  distinctUntilChanged,
  filter,
  fromEvent,
  map,
  merge,
  of,
  pairwise,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { ET_PROPERTY_REMOVED, RouterState, RouterStateService, ViewportService } from '../services';
import { Breakpoint } from '../types';
import { nextFrame } from './animation.utils';
import { equal } from './equal.util';
import { createMediaQueryObservable } from './media-query-observable.util';
import { isElementVisible } from './scrollable.utils';

type SignalElementBindingComplexType =
  | HTMLElement
  | ElementRef<HTMLElement>
  | QueryList<ElementRef<HTMLElement> | HTMLElement>
  | Array<ElementRef<HTMLElement> | HTMLElement>
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
  /** @deprecated Always use currentElements  */
  currentElement: HTMLElement | null;

  /** @deprecated Always use previousElements  */
  previousElement: HTMLElement | null;
  currentElements: HTMLElement[];
  previousElements: HTMLElement[];
}>;

type ElementSignalValue = ReturnType<ElementSignal>;

function isElementSignal(el: unknown): el is ElementSignal {
  if (isSignal(el)) {
    const val = el();
    return typeof val === 'object' && val !== null && 'currentElement' in val && 'previousElement' in val;
  }

  return false;
}

const documentElementSignal = (): ElementSignal =>
  signal({
    currentElement: document.documentElement,
    previousElement: null,
    currentElements: [document.documentElement],
    previousElements: [],
  });

const buildElementSignal = (el: SignalElementBindingType | null | undefined): ElementSignal => {
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

const firstElementSignal = (el: ElementSignal) => {
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

export interface BuildSignalEffectsConfig<T extends Record<string, Signal<unknown>>> {
  /** The tokens to apply and their signal value  */
  tokenMap: T;

  /** This function will be invoked for elements that were removed from the signal effects */
  cleanupFn: (el: HTMLElement, tokens: string[]) => void;

  /** This function will be invoked for elements that were added to the signal effects or when their signal value changes */
  updateFn: (el: HTMLElement, tokens: string[], conditionResult: unknown) => void;
}

export const buildSignalEffects = <T extends Record<string, Signal<unknown>>>(
  el: SignalElementBindingType,
  config: BuildSignalEffectsConfig<T>,
) => {
  const elements = buildElementSignal(el);
  const injector = inject(Injector);

  effect(() => {
    const { currentElements, previousElements } = elements();

    for (const previousEl of previousElements) {
      if (currentElements.includes(previousEl)) continue;

      const tokens = Object.keys(config.tokenMap)
        .map((key) => key.split(' '))
        .flat();

      if (!tokens.length) continue;

      config.cleanupFn(previousEl, tokens);
    }

    for (const currentEl of currentElements) {
      if (previousElements.includes(currentEl)) continue;

      for (const [tokens, condition] of Object.entries(config.tokenMap)) {
        untracked(() => {
          const tokenArray = tokens.split(' ');
          if (!tokenArray.length) return;

          config.updateFn(currentEl, tokenArray, condition());
        });
      }
    }
  });

  const effects: Record<string, EffectRef> = {};

  const has = (tokens: string) => tokens in effects;

  const push = (tokens: string, signal: Signal<unknown>) => {
    if (has(tokens)) return;

    runInInjectionContext(injector, () => {
      effects[tokens] = effect(() => {
        const { currentElements } = untracked(() => elements());
        const value = signal();

        for (const el of currentElements) {
          const tokenArray = tokens.split(' ');
          if (!tokenArray.length) continue;

          config.updateFn(el, tokenArray, value);
        }
      });
    });
  };

  const pushMany = (map: Record<string, Signal<unknown>>) => {
    for (const [tokens, signal] of Object.entries(map)) {
      push(tokens, signal);
    }
  };

  const remove = (tokens: string) => {
    effects[tokens]?.destroy();

    delete effects[tokens];

    for (const el of elements().currentElements) {
      const tokenArray = tokens.split(' ');
      if (!tokenArray.length) continue;

      config.cleanupFn(el, tokenArray);
    }
  };

  const removeMany = (tokens: string[]) => {
    for (const token of tokens) {
      remove(token);
    }
  };

  pushMany(config.tokenMap);

  return { remove, removeMany, has, push, pushMany };
};

export const signalIsRendered = () => {
  const isRendered = signal(false);

  afterNextRender(() => isRendered.set(true));

  return isRendered.asReadonly();
};

export const signalClasses = <T extends Record<string, Signal<unknown>>>(el: SignalElementBindingType, classMap: T) => {
  const renderer = inject(Renderer2);

  return buildSignalEffects(el, {
    tokenMap: classMap,
    cleanupFn: (el, tokens) => tokens.forEach((token) => renderer.removeClass(el, token)),
    updateFn: (el, tokens, condition) => {
      if (!condition) {
        tokens.forEach((token) => renderer.removeClass(el, token));
      } else {
        tokens.forEach((token) => renderer.addClass(el, token));
      }
    },
  });
};

export const signalHostClasses = <T extends Record<string, Signal<unknown>>>(classMap: T) =>
  signalClasses(inject(ElementRef), classMap);

const ALWAYS_TRUE_ATTRIBUTE_KEYS = ['disabled', 'readonly', 'required', 'checked', 'selected', 'hidden', 'inert'];

export const signalAttributes = <T extends Record<string, Signal<unknown>>>(
  el: SignalElementBindingType,
  attributeMap: T,
) => {
  const renderer = inject(Renderer2);

  return buildSignalEffects(el, {
    tokenMap: attributeMap,
    cleanupFn: (el, tokens) => tokens.forEach((token) => el.removeAttribute(token)),
    updateFn: (el, tokens, condition) => {
      for (const token of tokens) {
        if (ALWAYS_TRUE_ATTRIBUTE_KEYS.includes(token)) {
          if (condition) {
            renderer.setAttribute(el, token, '');
          } else {
            renderer.removeAttribute(el, token);
          }
          continue;
        }

        if (condition === null || condition === undefined) {
          renderer.removeAttribute(el, token);
        } else {
          renderer.setAttribute(el, token, `${condition}`);
        }
      }
    },
  });
};

export const signalHostAttributes = <T extends Record<string, Signal<unknown>>>(attributeMap: T) =>
  signalAttributes(inject(ElementRef), attributeMap);

export const signalStyles = <T extends Record<string, Signal<unknown>>>(el: SignalElementBindingType, styleMap: T) => {
  const renderer = inject(Renderer2);

  return buildSignalEffects(el, {
    tokenMap: styleMap,
    cleanupFn: (el, tokens) => tokens.forEach((token) => renderer.removeStyle(el, token, RendererStyleFlags2.DashCase)),
    updateFn: (el, tokens, condition) => {
      for (const token of tokens) {
        if (condition === null || condition === undefined) {
          renderer.removeStyle(el, token, RendererStyleFlags2.DashCase);
        } else {
          renderer.setStyle(el, token, `${condition}`, RendererStyleFlags2.DashCase);
        }
      }
    },
  });
};

export const signalHostStyles = <T extends Record<string, Signal<unknown>>>(styleMap: T) =>
  signalStyles(inject(ElementRef), styleMap);

export interface LogicalSize {
  inlineSize: number;
  blockSize: number;
}

export type ElementRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
  x: number;
  y: number;
};

export type ElementSize = {
  width: number;
  height: number;
};

export const boundingClientRectToElementRect = (rect: DOMRectReadOnly): ElementRect => ({
  bottom: rect.bottom,
  height: rect.height,
  left: rect.left,
  right: rect.right,
  top: rect.top,
  width: rect.width,
  x: rect.x,
  y: rect.y,
});

export const createElementDimensions = (el: HTMLElement | null, rect?: DOMRect): NullableElementDimensions => {
  if (!el) {
    return {
      rect: null,
      client: null,
      scroll: null,
      offset: null,
    };
  }

  const cachedNormalizedRect = rect ? boundingClientRectToElementRect(rect) : null;
  const rectFn = () =>
    cachedNormalizedRect ? cachedNormalizedRect : boundingClientRectToElementRect(el.getBoundingClientRect());

  return {
    rect: rectFn,
    client: { width: el.clientWidth, height: el.clientHeight },
    scroll: { width: el.scrollWidth, height: el.scrollHeight },
    offset: { width: el.offsetWidth, height: el.offsetHeight },
  };
};

export type ElementDimensions = {
  rect: () => ElementRect;
  client: ElementSize;
  scroll: ElementSize;
  offset: ElementSize;
};

export type NullableElementDimensions = {
  [K in keyof ElementDimensions]: ElementDimensions[K] | null;
};

export const signalElementDimensions = (el: SignalElementBindingType) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();

  const initialValue = () => createElementDimensions(elements().currentElement);

  const elementDimensionsSignal = signal<NullableElementDimensions>(initialValue());

  const observer = new ResizeObserver((e) => {
    if (!isRendered()) return;

    const entry = e[0];

    if (entry) {
      const target = entry.target as HTMLElement;
      const newDimensions = createElementDimensions(target);

      zone.run(() => elementDimensionsSignal.set(newDimensions));
    }
  });

  effect(() => {
    const els = elements();

    untracked(() => {
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
    });
  });

  destroyRef.onDestroy(() => observer.disconnect());

  return computed(() => elementDimensionsSignal(), {
    equal: (a, b) => equal(a, b),
  });
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

export type SignalElementScrollStateOptions = {
  /** The initial scroll position to scroll to. Once a truthy value get's emitted, all further values will be ignored. */
  initialScrollPosition?: Signal<ScrollToOptions | null>;
};

export type ElementScrollState = {
  canScroll: boolean;
  canScrollHorizontally: boolean;
  canScrollVertically: boolean;
  elementDimensions: NullableElementDimensions;
};

export const areScrollStatesEqual = (a: ElementScrollState, b: ElementScrollState) => {
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
  const elementMutations = signalElementMutations(elements, { childList: true, subtree: true, attributes: true });
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

export const signalHostElementScrollState = () => signalElementScrollState(inject(ElementRef));

export type SignalElementIntersectionOptions = Omit<IntersectionObserverInit, 'root'> & {
  root?: SignalElementBindingType;
  enabled?: Signal<boolean>;
};

export const signalElementIntersection = (el: SignalElementBindingType, options?: SignalElementIntersectionOptions) => {
  const destroyRef = inject(DestroyRef);
  const elements = buildElementSignal(el);
  const root = firstElementSignal(options?.root ? buildElementSignal(options?.root) : documentElementSignal());
  const zone = inject(NgZone);
  const isRendered = signalIsRendered();
  const isEnabled = options?.enabled ?? signal(true);

  const elementIntersectionSignal = signal<IntersectionObserverEntry[]>([]);
  const observer = signal<IntersectionObserver | null>(null);

  const currentlyObservedElements = new Set<HTMLElement>();

  const updateIntersections = (entries: IntersectionObserverEntry[]) => {
    let currentValues = [...elementIntersectionSignal()];

    for (const entry of entries) {
      const existingEntryIndex = currentValues.findIndex((v) => v.target === entry.target);

      // Round the intersection ratio to the nearest 0.01 to avoid floating point errors and system scaling issues.
      const roundedIntersectionRatio = Math.round(entry.intersectionRatio * 100) / 100;

      const intersectionEntry: IntersectionObserverEntry = {
        boundingClientRect: entry.boundingClientRect,
        intersectionRatio: roundedIntersectionRatio,
        intersectionRect: entry.intersectionRect,
        isIntersecting: entry.isIntersecting,
        rootBounds: entry.rootBounds,
        target: entry.target,
        time: entry.time,
      };

      if (existingEntryIndex !== -1) {
        currentValues = [
          ...currentValues.slice(0, existingEntryIndex),
          intersectionEntry,
          ...currentValues.slice(existingEntryIndex + 1),
        ];
      } else {
        currentValues = [...currentValues, intersectionEntry];
      }
    }

    zone.run(() => elementIntersectionSignal.set(currentValues));
  };

  const updateIntersectionObserver = (rendered: boolean, enabled: boolean, rootEl: HTMLElement | null) => {
    observer()?.disconnect();
    currentlyObservedElements.clear();

    if (!rendered || !enabled || !rootEl) {
      observer.set(null);
      return;
    }

    const newObserver = new IntersectionObserver((entries) => updateIntersections(entries), {
      ...options,
      root: rootEl,
    });

    observer.set(newObserver);
  };

  const updateObservedElements = (observer: IntersectionObserver | null, elements: ElementSignalValue) => {
    const rootEl = root().currentElement;

    if (!observer || !rootEl) return;

    const rootBounds = rootEl.getBoundingClientRect();

    const currIntersectionValue = elementIntersectionSignal();
    const newIntersectionValue: IntersectionObserverEntry[] = [];

    for (const el of elements.currentElements) {
      if (currentlyObservedElements.has(el)) {
        const existingEntryIndex = currIntersectionValue.findIndex((v) => v.target === el);
        const existingEntry = currIntersectionValue[existingEntryIndex];

        if (!existingEntry) {
          console.warn('Could not find existing entry for element. The intersection observer might be broken now.', el);
          continue;
        }

        newIntersectionValue.push(existingEntry);
        continue;
      }

      const elBounds = el.getBoundingClientRect();

      const initialElementVisibility = isElementVisible({
        container: rootEl,
        element: el,
        containerRect: rootBounds,
        elementRect: elBounds,
      });

      if (!initialElementVisibility) {
        console.error('No visibility data found for element.', {
          element: el,
          container: rootEl,
        });

        continue;
      }

      const intersectionEntry: IntersectionObserverEntry = {
        boundingClientRect: elBounds,
        intersectionRatio: initialElementVisibility.intersectionRatio,
        intersectionRect: elBounds,
        isIntersecting: initialElementVisibility.isIntersecting,
        rootBounds: rootBounds,
        target: el,
        time: performance.now(),
      };

      newIntersectionValue.push(intersectionEntry);

      currentlyObservedElements.add(el);
      observer.observe(el);
    }

    for (const el of elements.previousElements) {
      if (elements.currentElements.includes(el)) continue;

      observer.unobserve(el);
      currentlyObservedElements.delete(el);
    }

    elementIntersectionSignal.set(newIntersectionValue);
  };

  effect(() => {
    const rootEl = root().currentElement;
    const rendered = isRendered();
    const enabled = isEnabled();

    untracked(() => updateIntersectionObserver(rendered, enabled, rootEl));
  });

  effect(() => {
    const els = elements();
    const obs = observer();

    untracked(() => updateObservedElements(obs, els));
  });

  destroyRef.onDestroy(() => observer()?.disconnect());

  return elementIntersectionSignal.asReadonly();
};

export const signalHostElementIntersection = (options?: SignalElementIntersectionOptions) =>
  signalElementIntersection(inject(ElementRef), options);

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

export const previousSignalValue = <T>(signal: Signal<T>) => {
  const obs = toObservable(signal).pipe(
    pairwise(),
    map(([prev]) => prev),
  );

  return toSignal(obs);
};

export type SyncSignalOptions = {
  /**
   * If true, the target signal will not be updated with the source signal's value in a sync operation.
   * This should be set to true for signals that need to be initialized first before syncing (eg. required inputs)
   * @default false
   */
  skipSyncRead?: boolean;

  /**
   * If true, the first time the effect will be triggered will be skipped.
   * @default false
   */
  skipFirstRun?: boolean;
};

export const syncSignal = <T>(from: Signal<T>, to: WritableSignal<T>, options?: SyncSignalOptions) => {
  let isFirstRun = options?.skipSyncRead ? false : true;

  if (!options?.skipSyncRead) {
    try {
      // this might throw if the signal is not yet initialized (eg. a required signal input inside the constructor)
      // in that case we just skip the initial sync
      to.set(from());
    } catch {
      isFirstRun = false;

      if (isDevMode()) {
        console.warn('Failed to sync signals. The target signal is not yet initialized.', { from, to });
      }
    }
  }

  const ref = effect(() => {
    const formVal = from();

    if (options?.skipFirstRun && isFirstRun) {
      isFirstRun = false;
      return;
    }

    untracked(() => {
      to.set(formVal);
    });
  });

  return ref;
};

export interface ControlValueSignalOptions {
  debounceTime?: number;

  /**
   * @default false
   */
  debounceFirst?: boolean;
}

export const controlValueSignal = <
  TControlInput extends Signal<AbstractControl | null> | AbstractControl,
  TControl extends TControlInput extends Signal<infer TSignalControl> ? TSignalControl : TControlInput,
>(
  control: TControlInput,
  options?: ControlValueSignalOptions,
) => {
  type TValue = ReturnType<NonNullable<TControl>['getRawValue']>;

  let initialValue: TValue | null = null;

  const getRawValueSafe = (ctrl: Signal<AbstractControl | null> | AbstractControl | null): TValue | null => {
    try {
      return isSignal(ctrl) ? (ctrl()?.getRawValue() ?? null) : (ctrl?.getRawValue() ?? null);
    } catch {
      // Ignore errors. This can happen if the passed control is a required input and is not yet initialized.
      return null;
    }
  };

  initialValue = getRawValueSafe(control);

  const controlStream = isSignal(control)
    ? toObservable<AbstractControl | null>(control)
    : of<AbstractControl | null>(control);

  const controlObs = controlStream.pipe(
    switchMap((ctrl) => {
      if (!ctrl) return of(null);

      const vcsObs = options?.debounceTime
        ? ctrl.valueChanges.pipe(debounceTime(options.debounceTime))
        : ctrl.valueChanges;

      return vcsObs.pipe(
        startWith(ctrl.getRawValue()),
        map(() => ctrl.getRawValue()),
      );
    }),
  );

  const obs: Observable<TValue | null> = !options?.debounceFirst ? merge(of(initialValue), controlObs) : controlObs;

  return toSignal(obs.pipe(distinctUntilChanged((a, b) => equal(a, b))), {
    initialValue,
  });
};

/**
 * The first item in the pair is the previous value and the second item is the current value.
 */
export const controlValueSignalWithPrevious = <T extends AbstractControl>(
  control: T,
  options?: ControlValueSignalOptions,
) => {
  const obs = toObservable(controlValueSignal(control, options)).pipe(
    pairwise(),
    startWith([null, control.getRawValue()]),
  );

  return toSignal(obs, { requireSync: true });
};

/**
 * @deprecated Use `controlValueSignal` instead with `debounceTime` option.
 */
export interface DebouncedControlValueSignalOptions {
  /**
   * @default 300
   */
  debounceTime?: number;
}

/**
 * @deprecated Use `controlValueSignal` instead with `debounceTime` set to `300` and `debounceFirst` set to `true`.
 */
export const debouncedControlValueSignal = <T extends FormControl>(
  control: T,
  options?: DebouncedControlValueSignalOptions,
) => controlValueSignal(control, options ?? { debounceTime: 300, debounceFirst: true });

export type InjectUtilConfig = {
  /** The injector to use for the injection. Must be provided if the function is not called from within a injection context. */
  injector?: Injector;
};

export type InjectUtilTransformConfig<In, Out> = {
  /**
   * A transform function similar to the `transform` function in Angular input bindings.
   * Can be used to transform the value before it is returned.
   * E.g. transforming `"true"` to `true` for a boolean attribute.
   */
  transform?: (value: In) => Out;
};

export const transformOrReturn = <In, Out>(src: Signal<In>, config?: InjectUtilTransformConfig<In, Out>) => {
  const transformer = config?.transform;

  if (transformer) {
    return computed(() => transformer(src()));
  }

  return src as unknown as Signal<Out>;
};

/** Inject the current router event */
export const injectRouterEvent = () => {
  const routerStateService = inject(RouterStateService);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  if (!isBrowser) {
    return routerStateService.latestEvent.asReadonly();
  }

  const route = window.location.pathname + window.location.search + window.location.hash;

  return linkedSignal({
    source: () => new NavigationEnd(-1, route, route),
    computation: () => routerStateService.latestEvent(),
  }).asReadonly();
};

/**
 * Inject the current url.
 * The url includes query params as well as the fragment. Use `injectRoute` instead if you are not intrusted in those.
 * @example "/my-page?query=1&param=true#fragment"
 */
export const injectUrl = () => {
  const event = injectRouterEvent();
  const router = inject(Router);

  const url = signal(router.url);

  effect(() => {
    const currentEvent = event();

    untracked(() => {
      if (currentEvent instanceof NavigationEnd) {
        url.set(currentEvent.urlAfterRedirects);
      } else if (currentEvent instanceof NavigationSkipped) {
        url.set(currentEvent.url);
      }
    });
  });

  return url.asReadonly();
};

/**
 * Inject the current route
 * @example "/my-page"
 */
export const injectRoute = () => {
  const url = injectUrl();

  return computed(() => {
    const fullUrl = url();
    const urlWithoutQueryParams = fullUrl.split('?')[0] ?? '';
    const withoutFragment = urlWithoutQueryParams.split('#')[0] ?? '';

    return withoutFragment;
  });
};

const createRouterState = (router: Router) => {
  let route = router.routerState.snapshot.root;

  while (route.firstChild) {
    route = route.firstChild;
  }

  const { data, params, queryParams, title, fragment } = route;

  return {
    data,
    pathParams: params,
    queryParams,
    title: title ?? null,
    fragment,
  };
};

const createInitialRouterState = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID)))
    return {
      data: {},
      pathParams: {},
      queryParams: {},
      title: null,
      fragment: null,
    };

  const url = new URL(window.location.href);

  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const fragment = url.hash ? url.hash.substring(1) : null;

  const title = document.title || null;

  return {
    data: {},
    pathParams: {}, // Cannot determine path params without route configuration
    queryParams,
    title,
    fragment,
  };
};

/**
 * Inject the complete router state. This includes the current route data, path params, query params, title and fragment.
 */
export const injectRouterState = () => {
  const event = injectRouterEvent();
  const router = inject(Router);

  const routerState = signal<RouterState>(createInitialRouterState());

  effect(() => {
    const e = event();

    untracked(() => {
      if (e instanceof NavigationEnd && e.id === -1) {
        return;
      } else {
        routerState.set(createRouterState(router));
      }
    });
  });

  return computed(() => routerState(), { equal });
};

/** Inject a signal containing the current route fragment (the part after the # inside the url if present) */
export const injectFragment = <T = string | null>(
  config?: InjectUtilConfig & InjectUtilTransformConfig<string | null, T>,
) => {
  const routerState = injectRouterState();
  const fragment = computed(() => routerState().fragment);

  return transformOrReturn(fragment, config);
};

/** Inject all currently available query parameters as a signal */
export const injectQueryParams = () => {
  const routerState = injectRouterState();

  const queryParams = computed(() => routerState().queryParams);

  return queryParams;
};

/** Inject all currently available route data as a signal */
export const injectRouteData = () => {
  const routerState = injectRouterState();

  const data = computed(() => routerState().data);

  return data;
};

/** Inject the current route title as a signal */
export const injectRouteTitle = <T = string | null>(config?: InjectUtilTransformConfig<string | null, T>) => {
  const routerState = injectRouterState();
  const title = computed(() => routerState().title);

  return transformOrReturn(title, config);
};

/** Inject all currently available path parameters as a signal */
export const injectPathParams = () => {
  const routerState = injectRouterState();

  const pathParams = computed(() => routerState().pathParams);

  return pathParams;
};

/** Inject a specific query parameter as a signal */
export const injectQueryParam = <T = string | null>(
  key: string,
  config?: InjectUtilTransformConfig<string | null, T>,
) => {
  const queryParams = injectQueryParams();
  const src = computed(() => queryParams()[key] ?? null) as Signal<string | null>;

  return transformOrReturn(src, config);
};

/** Inject a specific route data item as a signal */
export const injectRouteDataItem = <T = unknown>(key: string, config?: InjectUtilTransformConfig<unknown, T>) => {
  const data = injectRouteData();
  const src = computed(() => data()[key] ?? null) as Signal<T>;

  return transformOrReturn(src, config);
};

/** Inject a specific path parameter as a signal */
export const injectPathParam = <T = string | null>(
  key: string,
  config?: InjectUtilTransformConfig<string | null, T>,
) => {
  const pathParams = injectPathParams();
  const src = computed(() => pathParams()[key] ?? null) as Signal<string | null>;

  return transformOrReturn(src, config);
};

/**
 * Inject query params that changed during navigation. Unchanged query params will be ignored.
 * Removed query params will be represented by the symbol `ET_PROPERTY_REMOVED`.
 */
export const injectQueryParamChanges = () => {
  const queryParams = injectQueryParams();
  const prevQueryParams = previousSignalValue(queryParams);

  return computed(() => {
    const current = queryParams();
    const previous = prevQueryParams() ?? {};

    const changes: Record<string, unknown> = {};

    const allKeys = new Set<keyof typeof previous & keyof typeof current>([
      ...Object.keys(previous),
      ...Object.keys(current),
    ]);

    for (const key of allKeys) {
      if (!equal(previous[key], current[key])) {
        const val = current[key] === undefined ? ET_PROPERTY_REMOVED : current[key];

        changes[key] = val;
      }
    }

    return changes;
  });
};

/**
 * Inject path params that changed during navigation. Unchanged path params will be ignored.
 * Removed path params will be represented by the symbol `ET_PROPERTY_REMOVED`.
 */
export const injectPathParamChanges = () => {
  const pathParams = injectPathParams();
  const prevPathParams = previousSignalValue(pathParams);

  return computed(() => {
    const current = pathParams();
    const previous = prevPathParams() ?? {};

    const changes: Record<string, unknown> = {};

    const allKeys = new Set<keyof typeof previous & keyof typeof current>([
      ...Object.keys(previous),
      ...Object.keys(current),
    ]);

    for (const key of allKeys) {
      if (!equal(previous[key], current[key])) {
        const val = current[key] === undefined ? ET_PROPERTY_REMOVED : current[key];

        changes[key] = val;
      }
    }

    return changes;
  });
};

export const createIsRenderedSignal = () => {
  const value = signal(false);

  nextFrame(() => {
    if (!value()) {
      console.error(
        'Render signal was not set to true. This can cause unexpected behavior. Make sure to .bind() the render signal at the end of the constructor.',
      );
    }
  });

  return {
    state: value,
    bind: () => effect(() => value.set(true)),
  };
};

export const createCanAnimateSignal = () => {
  const value = signal(false);

  nextFrame(() => {
    value.set(true);
  });

  return {
    state: value.asReadonly(),
  };
};

export type ElementLastScrollDirectionType = 'up' | 'down' | 'left' | 'right';

export type ElementLastScrollDirection = {
  type: ElementLastScrollDirectionType;
  time: number;
};

export const signalElementLastScrollDirection = (el: SignalElementBindingType) => {
  const elements = buildElementSignal(el);
  const element = firstElementSignal(elements);
  const destroyRef = inject(DestroyRef);
  const lastScrollDirection = signal<ElementLastScrollDirection | null>(null);

  let lastScrollTop = 0;
  let lastScrollLeft = 0;

  toObservable(element)
    .pipe(
      switchMap(({ currentElement }) => {
        if (!currentElement) {
          lastScrollDirection.set(null);
          lastScrollTop = 0;
          lastScrollLeft = 0;

          return of(null);
        }

        return fromEvent(currentElement, 'scroll').pipe(
          tap(() => {
            const { scrollTop, scrollLeft } = currentElement;
            const time = Date.now();

            if (scrollTop > lastScrollTop) {
              lastScrollDirection.set({ type: 'down', time });
            } else if (scrollTop < lastScrollTop) {
              lastScrollDirection.set({ type: 'up', time });
            } else if (scrollLeft > lastScrollLeft) {
              lastScrollDirection.set({ type: 'right', time });
            } else if (scrollLeft < lastScrollLeft) {
              lastScrollDirection.set({ type: 'left', time });
            }

            lastScrollTop = scrollTop;
            lastScrollLeft = scrollLeft;
          }),
        );
      }),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe();

  return lastScrollDirection.asReadonly();
};

export const signalHostElementLastScrollDirection = () => signalElementLastScrollDirection(inject(ElementRef));

export type CursorDragScrollDirection = 'horizontal' | 'vertical' | 'both';

export type MaybeSignal<T> = T | Signal<T>;

export const maybeSignalValue = <T>(value: MaybeSignal<T>) => {
  if (isSignal(value)) {
    return value();
  }

  return value;
};

export type CursorDragScrollOptions = {
  /** If true, cursor drag scrolling will be enabled. */
  enabled?: Signal<boolean>;

  /** The allowed scroll direction. */
  allowedDirection?: MaybeSignal<CursorDragScrollDirection>;
};

/** The deadzone in pixels after which the cursor drag scroll will take effect. */
const CURSOR_DRAG_SCROLL_DEADZONE = 5;

/** The class that is added to the element when the cursor is being dragged. */
const CURSOR_DRAG_SCROLLING_CLASS = 'et-cursor-drag-scroll--scrolling';
const CURSOR_DRAG_INIT_CLASS = 'et-cursor-drag-scroll--init';

/** A function to apply cursor drag scroll behavior to an element. */
export const useCursorDragScroll = (el: SignalElementBindingType, options?: CursorDragScrollOptions) => {
  const elements = buildElementSignal(el);
  const element = firstElementSignal(elements);
  const destroyRef = inject(DestroyRef);
  const { enabled = signal(true), allowedDirection = 'both' } = options ?? {};
  const scrollState = signalElementScrollState(elements);
  const renderer = inject(Renderer2);
  const isDragging = signal(false);
  const isInitDragging = signal(false);
  const initialDragPosition = signal({ x: 0, y: 0 });
  const initialScrollPosition = signal({ x: 0, y: 0 });
  const dragAmount = signal({ x: 0, y: 0 });
  const document = inject(DOCUMENT);

  const canScroll = computed(() => {
    const currentScrollState = scrollState();
    const direction = maybeSignalValue(allowedDirection);

    switch (direction) {
      case 'both':
        return currentScrollState.canScrollHorizontally || currentScrollState.canScrollVertically;
      case 'horizontal':
        return currentScrollState.canScrollHorizontally;
      case 'vertical':
        return currentScrollState.canScrollVertically;
    }
  });

  // Cleanup if the element the cursor drag scroll is bound to gets changed
  effect(() => {
    const { previousElement } = element();

    if (previousElement) {
      renderer.removeStyle(previousElement, 'cursor');
    }
  });

  // Conditionally apply styles/classes to the element and the document
  effect(() => {
    const currCanScroll = canScroll();
    const isEnabled = enabled();
    const currIsDragging = isDragging();
    const currIsInitDragging = isInitDragging();

    untracked(() => {
      const el = element().currentElement;

      if (!el) return;

      if (!currCanScroll || !isEnabled) {
        renderer.removeStyle(el, 'cursor');
        renderer.removeStyle(el, 'scrollSnapType');
        renderer.removeStyle(el, 'scrollBehavior');
        renderer.removeClass(el, CURSOR_DRAG_SCROLLING_CLASS);
        renderer.removeClass(el, CURSOR_DRAG_INIT_CLASS);
        renderer.removeStyle(document.documentElement, 'cursor');
        return;
      }

      if (currIsInitDragging) {
        renderer.addClass(el, CURSOR_DRAG_INIT_CLASS);
      }

      if (currIsDragging) {
        renderer.addClass(el, CURSOR_DRAG_SCROLLING_CLASS);
        renderer.setStyle(el, 'scrollSnapType', 'none');
        renderer.setStyle(el, 'scrollBehavior', 'unset');
        renderer.setStyle(el, 'cursor', 'grabbing');
        renderer.setStyle(document.documentElement, 'cursor', 'grabbing');
      }

      if (!currIsInitDragging && !currIsDragging) {
        renderer.setStyle(el, 'cursor', 'grab');
        renderer.removeStyle(el, 'scrollSnapType');
        renderer.removeStyle(el, 'scrollBehavior');
        renderer.removeClass(el, CURSOR_DRAG_SCROLLING_CLASS);
        renderer.removeClass(el, CURSOR_DRAG_INIT_CLASS);
        renderer.removeStyle(document.documentElement, 'cursor');
      }
    });
  });

  // Update the element's scroll position when the user drags
  effect(() => {
    const currDragAmount = dragAmount();

    untracked(() => {
      const currIsDragging = isDragging();
      const el = element().currentElement;
      const { x: dragX, y: dragY } = currDragAmount;
      const { x: scrollX, y: scrollY } = initialScrollPosition();
      const currAllowedDirection = maybeSignalValue(allowedDirection);

      if (!el || !currIsDragging) return;

      switch (currAllowedDirection) {
        case 'both':
          el.scroll({
            top: dragY + scrollY,
            left: dragX + scrollX,
            behavior: 'instant',
          });
          break;
        case 'horizontal':
          el.scroll({
            left: dragX + scrollX,
            behavior: 'instant',
          });
          break;
        case 'vertical':
          el.scroll({
            top: dragY + scrollY,
            behavior: 'instant',
          });
          break;
      }
    });
  });

  const updateDragging = (e: MouseEvent) => {
    const el = element().currentElement;

    if (!el) return;

    const dx = (e.clientX - initialDragPosition().x) * -1;
    const dy = (e.clientY - initialDragPosition().y) * -1;

    dragAmount.set({ x: dx, y: dy });

    if (Math.abs(dx) > CURSOR_DRAG_SCROLL_DEADZONE || Math.abs(dy) > CURSOR_DRAG_SCROLL_DEADZONE) {
      isDragging.set(true);
    }
  };

  const updateDraggingEnd = () => {
    isDragging.set(false);
    isInitDragging.set(false);
    initialDragPosition.set({ x: 0, y: 0 });
    initialScrollPosition.set({ x: 0, y: 0 });
    dragAmount.set({ x: 0, y: 0 });
  };

  const setupDragging = (e: MouseEvent) => {
    const mouseUp = fromEvent<MouseEvent>(document, 'mouseup');
    const mouseMove = fromEvent<MouseEvent>(document, 'mousemove');
    const el = element().currentElement;

    if (!el) return;

    mouseMove
      .pipe(
        takeUntilDestroyed(destroyRef),
        takeUntil(mouseUp),
        tap((e) => updateDragging(e)),
      )
      .subscribe();

    mouseUp
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap(() => updateDraggingEnd()),
      )
      .subscribe();

    initialDragPosition.set({ x: e.clientX, y: e.clientY });
    initialScrollPosition.set({ x: el.scrollLeft, y: el.scrollTop });
    isInitDragging.set(true);
  };

  toObservable(element)
    .pipe(
      map((e) => e?.currentElement),
      switchMap((el) => (el ? fromEvent<MouseEvent>(el, 'mousedown') : of(null))),
      filter((e): e is MouseEvent => !!e),
      filter(() => enabled()),
      tap((e) => setupDragging(e)),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    isDragging: isDragging.asReadonly(),
    currentDragAmount: dragAmount.asReadonly(),
  };
};

/**
 * A computed that will only be reactive until the source signal contains a truthy value.
 * All subsequent changes inside the computation will be ignored.
 */
export const computedTillTruthy = <T>(source: Signal<T>) => {
  const value = signal<T | null>(null);

  const ref = effect(() => {
    const val = source();

    if (val) {
      value.set(val);
      ref.destroy();
    }
  });

  return value.asReadonly();
};

/**
 * A computed that will only be reactive until the source signal contains a falsy value.
 * All subsequent changes inside the computation will be ignored.
 */
export const computedTillFalsy = <T>(source: Signal<T>) => {
  const value = signal<T | null>(null);

  const ref = effect(() => {
    const val = source();

    if (!val) {
      value.set(val);
      ref.destroy();
    }
  });

  return value.asReadonly();
};

/**
 * A writeable signal that will be set to the provided value once all inputs are set.
 * During that time, the signal will be set to `null`.
 */
export const deferredSignal = <T extends () => unknown>(valueFn: T) => {
  const valueSignal = signal<ReturnType<T> | null>(null);

  afterNextRender(() => {
    valueSignal.set(valueFn() as ReturnType<T>);
  });

  return valueSignal;
};

/** Inject a signal containing a boolean value indicating if the viewport is xs */
export const injectIsXs = () => {
  return toSignal(inject(ViewportService).isXs$, { requireSync: true });
};

/** Inject a signal containing a boolean value indicating if the viewport is sm */
export const injectIsSm = () => {
  return toSignal(inject(ViewportService).isSm$, { requireSync: true });
};

/** Inject a signal containing a boolean value indicating if the viewport is md */
export const injectIsMd = () => {
  return toSignal(inject(ViewportService).isMd$, { requireSync: true });
};

/** Inject a signal containing a boolean value indicating if the viewport is lg */
export const injectIsLg = () => {
  return toSignal(inject(ViewportService).isLg$, { requireSync: true });
};

/** Inject a signal containing a boolean value indicating if the viewport is xl */
export const injectIsXl = () => {
  return toSignal(inject(ViewportService).isXl$, { requireSync: true });
};

/** Inject a signal containing a boolean value indicating if the viewport is 2xl */
export const injectIs2Xl = () => {
  return toSignal(inject(ViewportService).is2Xl$, { requireSync: true });
};

/**
 * Inject a boolean value indicating if the viewport is matching the provided options.
 * This value is not reactive. If you want to react to changes, use the {@link injectObserveBreakpoint} function instead.
 */
export const injectBreakpointIsMatched = (options: { min?: number | Breakpoint; max?: number | Breakpoint }) => {
  return inject(ViewportService).isMatched(options);
};

/**
 * Inject a signal containing a boolean value indicating if the viewport is matching the provided options.
 */
export const injectObserveBreakpoint = (options: { min?: number | Breakpoint; max?: number | Breakpoint }) => {
  return toSignal(inject(ViewportService).observe(options), { initialValue: injectBreakpointIsMatched(options) });
};

/** Inject a signal containing the current breakpoint. */
export const injectCurrentBreakpoint = () => {
  return toSignal(inject(ViewportService).currentViewport$, {
    initialValue: inject(ViewportService).currentViewport,
  });
};

/** Inject a signal that indicates if the user is using a portrait display */
export const injectIsPortrait = () => {
  const queryResult = toSignal(createMediaQueryObservable('(orientation: portrait)'), { requireSync: true });

  return computed(() => queryResult()?.matches);
};

/** Inject a signal that indicates if the user is using a landscape display */
export const injectIsLandscape = () => {
  const queryResult = toSignal(createMediaQueryObservable('(orientation: landscape)'), { requireSync: true });

  return computed(() => queryResult()?.matches);
};

/** Inject a signal containing the current display orientation */
export const injectDisplayOrientation = () => {
  const isPortrait = injectIsPortrait();

  return computed(() => {
    if (isPortrait()) return 'portrait';
    return 'landscape';
  });
};

/** Inject a signal that indicates if the device has a touch input */
export const injectHasTouchInput = () => {
  const queryResult = toSignal(createMediaQueryObservable('(pointer: coarse)'), { requireSync: true });

  return computed(() => queryResult()?.matches);
};

/** Inject a signal that indicates if the device has a fine input (mouse or stylus)  */
export const injectHasPrecisionInput = () => {
  const queryResult = toSignal(createMediaQueryObservable('(pointer: fine)'), { requireSync: true });

  return computed(() => queryResult()?.matches);
};

/** Inject a signal containing the current device input type */
export const injectDeviceInputType = () => {
  const isTouch = injectHasTouchInput();

  return computed(() => {
    if (isTouch()) return 'touch';
    return 'mouse';
  });
};

/** Inject a signal containing a boolean value indicating if the user can hover (eg. using a mouse) */
export const injectCanHover = () => {
  const queryResult = toSignal(createMediaQueryObservable('(hover: hover)'), { requireSync: true });

  return computed(() => queryResult()?.matches);
};
