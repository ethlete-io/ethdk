import { coerceElement } from '@angular/cdk/coercion';
import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  EffectRef,
  ElementRef,
  Injector,
  NgZone,
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
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
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
import { RouterStateService, ViewportService } from '../services';
import { Breakpoint } from '../types';
import { nextFrame } from './animation.utils';
import { equal } from './equal.util';
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
      map(([previousElements, currentElements]) => ({
        previousElements: previousElements ?? [],
        currentElements: currentElements ?? [],
        currentElement: currentElements?.[0] ?? null,
        previousElement: previousElements?.[0] ?? null,
      })),
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

        for (const el of currentElements) {
          const tokenArray = tokens.split(' ');
          if (!tokenArray.length) continue;

          config.updateFn(el, tokenArray, signal());
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
    cleanupFn: (el, tokens) => tokens.forEach((token) => renderer.removeStyle(el, token)),
    updateFn: (el, tokens, condition) => {
      for (const token of tokens) {
        if (condition === null || condition === undefined) {
          renderer.removeStyle(el, token);
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

export type SignalElementScrollStateOptions = {
  /** The initial scroll position to scroll to. Once a truthy value get's emitted, all further values will be ignored. */
  initialScrollPosition?: Signal<ScrollToOptions | null>;
};

export const signalElementScrollState = (el: SignalElementBindingType, options?: SignalElementScrollStateOptions) => {
  const elements = buildElementSignal(el);
  const elementDimensions = signalElementDimensions(elements);
  const elementMutations = signalElementMutations(elements, { childList: true, subtree: true, attributes: true });
  const isRendered = signalIsRendered();

  const initialScrollPosition = options?.initialScrollPosition;

  if (initialScrollPosition) {
    const ref = effect(() => {
      if (!isRendered()) return;

      const scrollPosition = initialScrollPosition();
      const element = elements().currentElement;

      if (scrollPosition && element) {
        if (scrollPosition.left !== undefined) element.scrollLeft = scrollPosition.left;
        if (scrollPosition.top !== undefined) element.scrollTop = scrollPosition.top;
        ref.destroy();
      }
    });
  }

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
    const rootBounds = rootEl?.getBoundingClientRect();

    if (!observer || !rootEl) return;

    const currIntersecionValue = elementIntersectionSignal();
    const newIntersectionValue: IntersectionObserverEntry[] = [];

    for (const el of elements.currentElements) {
      if (currentlyObservedElements.has(el)) {
        const existingEntryIndex = currIntersecionValue.findIndex((v) => v.target === el);
        const existingEntry = currIntersecionValue[existingEntryIndex];

        if (!existingEntry) {
          console.warn('Could not find existing entry for element. The intersection observer might be broken now.', el);
          continue;
        }

        newIntersectionValue.push(existingEntry);
        continue;
      }

      const initialElementVisibility = isElementVisible({
        container: rootEl,
        element: el,
      });

      if (!initialElementVisibility) {
        console.error('No visibility data found for element.', {
          element: el,
          container: rootEl,
        });

        continue;
      }

      const elBounds = el.getBoundingClientRect();

      const inlineIntersectionRatio = initialElementVisibility.inlineIntersection / 100;
      const blockIntersectionRatio = initialElementVisibility.blockIntersection / 100;
      const isIntersecting = inlineIntersectionRatio > 0 && blockIntersectionRatio > 0;
      const intersectionRatio = Math.min(inlineIntersectionRatio, blockIntersectionRatio);

      // Round the intersection ratio to the nearest 0.01 to avoid floating point errors and system scaling issues.
      const roundedIntersectionRatio = Math.round(intersectionRatio * 100) / 100;

      const intersectionEntry: IntersectionObserverEntry = {
        boundingClientRect: elBounds,
        intersectionRatio: roundedIntersectionRatio,
        intersectionRect: elBounds,
        isIntersecting,
        rootBounds: rootBounds ?? null,
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

  effect(
    () => {
      const rootEl = root().currentElement;
      const rendered = isRendered();
      const enabled = isEnabled();

      untracked(() => updateIntersectionObserver(rendered, enabled, rootEl));
    },
    { allowSignalWrites: true },
  );

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

  return computed(() => {
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
  });
};

export const previousSignalValue = <T>(signal: Signal<T>) => {
  const obs = toObservable(signal).pipe(
    pairwise(),
    map(([prev]) => prev),
  );

  return toSignal(obs);
};

export const syncSignal = <T>(from: Signal<T>, to: WritableSignal<T>) => {
  effect(() => {
    const formVal = from();

    untracked(() => {
      to.set(formVal);
    });
  });
};

export interface ControlValueSignalOptions {
  /**
   * @default 300
   */
  debounceTime?: number;

  /**
   * @default false
   */
  debounceFirst?: boolean;
}

export const controlValueSignal = <T extends FormControl | FormGroup | FormArray>(
  control: T,
  options?: ControlValueSignalOptions,
) => {
  const vcsObs = options?.debounceTime
    ? control.valueChanges.pipe(debounceTime(options?.debounceTime ?? 300))
    : control.valueChanges;

  const obs: Observable<ReturnType<T['getRawValue']>> = options?.debounceFirst
    ? merge(of(control.value), vcsObs)
    : vcsObs.pipe(startWith(control.getRawValue()));

  return toSignal(obs.pipe(distinctUntilChanged((a, b) => equal(a, b))), {
    requireSync: true,
  });
};

/**
 * The first item in the pair is the previous value and the second item is the current value.
 */
export const controlValueSignalWithPrevious = <T extends FormControl | FormGroup | FormArray>(
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

export const injectOrRunInContext = <T>(fn: () => T, config?: InjectUtilConfig) => {
  if (config?.injector) {
    return runInInjectionContext(config.injector, fn);
  }

  return fn();
};

export const transformOrReturn = <In, Out>(src: Signal<In>, config?: InjectUtilTransformConfig<In, Out>) => {
  const transformer = config?.transform;

  if (transformer) {
    return computed(() => transformer(src()));
  }

  return src as unknown as Signal<Out>;
};

/** Inject a signal containing the current route fragment (the part after the # inside the url if present) */
export const injectFragment = <T = string | null>(
  config?: InjectUtilConfig & InjectUtilTransformConfig<string | null, T>,
) => {
  return injectOrRunInContext(() => {
    const routerStateService = inject(RouterStateService);
    const src = toSignal(routerStateService.fragment$, { initialValue: routerStateService.fragment });

    return transformOrReturn(src, config);
  }, config);
};

/** Inject all currently available query parameters as a signal */
export const injectQueryParams = (config?: InjectUtilConfig) => {
  return injectOrRunInContext(() => {
    const routerStateService = inject(RouterStateService);

    return toSignal(routerStateService.queryParams$, { initialValue: routerStateService.queryParams });
  }, config);
};

/** Inject all currently available route data as a signal */
export const injectRouteData = (config?: InjectUtilConfig) => {
  return injectOrRunInContext(() => {
    const routerStateService = inject(RouterStateService);

    return toSignal(routerStateService.data$, { initialValue: routerStateService.data });
  }, config);
};

/** Inject the current route title as a signal */
export const injectRouteTitle = <T = string | null>(
  config?: InjectUtilConfig & InjectUtilTransformConfig<string | null, T>,
) => {
  return injectOrRunInContext(() => {
    const routerStateService = inject(RouterStateService);
    const src = toSignal(routerStateService.title$, { initialValue: routerStateService.title });

    return transformOrReturn(src, config);
  }, config);
};

/** Inject all currently available path parameters as a signal */
export const injectPathParams = (config?: InjectUtilConfig) => {
  return injectOrRunInContext(() => {
    const routerStateService = inject(RouterStateService);

    return toSignal(routerStateService.pathParams$, { initialValue: routerStateService.pathParams });
  }, config);
};

/** Inject a specific query parameter as a signal */
export const injectQueryParam = <T = string | null>(
  key: string,
  config?: InjectUtilConfig & InjectUtilTransformConfig<string | null, T>,
) => {
  const queryParams = injectQueryParams(config);
  const src = computed(() => queryParams()[key] ?? null) as Signal<string | null>;

  return transformOrReturn(src, config);
};

/** Inject a specific route data item as a signal */
export const injectRouteDataItem = <T = unknown>(
  key: string,
  config?: InjectUtilConfig & InjectUtilTransformConfig<unknown, T>,
) => {
  const data = injectRouteData(config);
  const src = computed(() => data()[key] ?? null) as Signal<T>;

  return transformOrReturn(src, config);
};

/** Inject a specific path parameter as a signal */
export const injectPathParam = <T = string | null>(
  key: string,
  config?: InjectUtilConfig & InjectUtilTransformConfig<string | null, T>,
) => {
  const pathParams = injectPathParams(config);
  const src = computed(() => pathParams()[key] ?? null) as Signal<string | null>;

  return transformOrReturn(src, config);
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
    bind: () => effect(() => value.set(true), { allowSignalWrites: true }),
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

  const ref = effect(
    () => {
      const val = source();

      if (val) {
        value.set(val);
        ref.destroy();
      }
    },
    { allowSignalWrites: true },
  );

  return value.asReadonly();
};

/**
 * A computed that will only be reactive until the source signal contains a falsy value.
 * All subsequent changes inside the computation will be ignored.
 */
export const computedTillFalsy = <T>(source: Signal<T>) => {
  const value = signal<T | null>(null);

  const ref = effect(
    () => {
      const val = source();

      if (!val) {
        value.set(val);
        ref.destroy();
      }
    },
    { allowSignalWrites: true },
  );

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
