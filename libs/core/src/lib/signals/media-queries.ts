import { computed, DestroyRef, DOCUMENT, inject, signal } from '@angular/core';
import {
  Breakpoint,
  BREAKPOINT_ORDER,
  BuildMediaQueryOptions,
  injectBreakpointObserver,
  injectRenderer,
} from '../providers';
import { createDocumentElementSignal } from './element';
import { signalElementDimensions } from './element-dimensions';
import { memoizeSignal } from './signal-data-utils';

/** Inject a signal containing a boolean value indicating if the viewport is xs */
export const injectIsXs = /* @__PURE__ */ memoizeSignal(() => injectObserveBreakpoint({ max: 'xs' }));

/** Inject a signal containing a boolean value indicating if the viewport is sm */
export const injectIsSm = /* @__PURE__ */ memoizeSignal(() => injectObserveBreakpoint({ min: 'sm', max: 'sm' }));

/** Inject a signal containing a boolean value indicating if the viewport is md */
export const injectIsMd = /* @__PURE__ */ memoizeSignal(() => injectObserveBreakpoint({ min: 'md', max: 'md' }));

/** Inject a signal containing a boolean value indicating if the viewport is lg */
export const injectIsLg = /* @__PURE__ */ memoizeSignal(() => injectObserveBreakpoint({ min: 'lg', max: 'lg' }));

/** Inject a signal containing a boolean value indicating if the viewport is xl */
export const injectIsXl = /* @__PURE__ */ memoizeSignal(() => injectObserveBreakpoint({ min: 'xl', max: 'xl' }));

/** Inject a signal containing a boolean value indicating if the viewport is 2xl */
export const injectIs2Xl = /* @__PURE__ */ memoizeSignal(() => injectObserveBreakpoint({ min: '2xl' }));

/**
 * Inject a boolean value indicating if the viewport is matching the provided options.
 * This value is not reactive. If you want to react to changes, use the {@link injectObserveBreakpoint} function instead.
 */
export const injectBreakpointIsMatched = (options: BuildMediaQueryOptions) =>
  injectBreakpointObserver().isBreakpointMatched(options);

/**
 * Inject a boolean value indicating if the media query is matched.
 * This value is not reactive. If you want to react to changes, use the {@link injectObserveMediaQuery} function instead.
 */
export const injectMediaQueryIsMatched = (mediaQuery: string) =>
  injectBreakpointObserver().isMediaQueryMatched(mediaQuery);

/**
 * Inject a signal containing a boolean value indicating if the viewport is matching the provided options.
 */
export const injectObserveBreakpoint = (options: BuildMediaQueryOptions) =>
  injectBreakpointObserver().observeBreakpoint(options);

/**
 * Inject a signal containing a boolean value indicating if the media query is matched.
 */
export const injectObserveMediaQuery = (mediaQuery: string) => injectBreakpointObserver().observeMediaQuery(mediaQuery);

/** Inject a signal containing the current breakpoint. */
export const injectCurrentBreakpoint = /* @__PURE__ */ memoizeSignal(() => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const first = BREAKPOINT_ORDER[0]!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const last = BREAKPOINT_ORDER[BREAKPOINT_ORDER.length - 1]!;
  const highToLow = [...BREAKPOINT_ORDER].reverse() as Breakpoint[];
  const signals = highToLow.map((bp) =>
    injectObserveBreakpoint(bp === first ? { max: bp } : bp === last ? { min: bp } : { min: bp, max: bp }),
  );

  return computed(() => {
    for (let i = 0; i < highToLow.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (signals[i]!()) return highToLow[i]!;
    }
    return first;
  });
});

/** Inject a signal that indicates if the user is using a portrait display */
export const injectIsPortrait = /* @__PURE__ */ memoizeSignal(() => injectObserveMediaQuery('(orientation: portrait)'));

/** Inject a signal that indicates if the user is using a landscape display */
export const injectIsLandscape = /* @__PURE__ */ memoizeSignal(() =>
  injectObserveMediaQuery('(orientation: landscape)'),
);

/** Inject a signal containing the current display orientation */
export const injectDisplayOrientation = /* @__PURE__ */ memoizeSignal(() => {
  const isPortrait = injectIsPortrait();

  return computed(() => {
    if (isPortrait()) return 'portrait';
    return 'landscape';
  });
});

/** Inject a signal that indicates if the device has a touch input */
export const injectHasTouchInput = /* @__PURE__ */ memoizeSignal(() => injectObserveMediaQuery('(pointer: coarse)'));

/** Inject a signal that indicates if the device has a fine input (mouse or stylus)  */
export const injectHasPrecisionInput = /* @__PURE__ */ memoizeSignal(() => injectObserveMediaQuery('(pointer: fine)'));

/** Inject a signal containing the current device input type */
export const injectDeviceInputType = /* @__PURE__ */ memoizeSignal(() => {
  const isTouch = injectHasTouchInput();

  return computed(() => {
    if (isTouch()) return 'touch';
    return 'mouse';
  });
});

/** Inject a signal that indicates if the user prefers reduced motion */
export const injectPrefersReducedMotion = /* @__PURE__ */ memoizeSignal(() =>
  injectObserveMediaQuery('(prefers-reduced-motion: reduce)'),
);

/** Inject a signal containing a boolean value indicating if the user can hover (eg. using a mouse) */
export const injectCanHover = /* @__PURE__ */ memoizeSignal(() => injectObserveMediaQuery('(hover: hover)'));

/** Inject a signal containing the viewport dimensions */
export const injectViewportDimensions = /* @__PURE__ */ memoizeSignal(() =>
  signalElementDimensions(createDocumentElementSignal()),
);

/** Inject a signal containing the scrollbar dimensions. Dimensions will be 0 if scrollbars overlap the page contents (like on mobile). */
export const injectScrollbarDimensions = /* @__PURE__ */ memoizeSignal(() => {
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);
  const renderer = injectRenderer();
  const view = document.defaultView;

  if (!view) return signal<{ width: number; height: number } | null>(null).asReadonly();

  const scrollbarRuler = renderer.createElement('div');
  scrollbarRuler.style.width = '100px';
  scrollbarRuler.style.height = '100px';
  scrollbarRuler.style.overflow = 'scroll';
  scrollbarRuler.style.position = 'absolute';
  scrollbarRuler.style.top = '-9999px';
  scrollbarRuler.style.scrollbarWidth = view.getComputedStyle(document.documentElement).scrollbarWidth;
  renderer.appendChild(document.body, scrollbarRuler);
  destroyRef.onDestroy(() => {
    const parent = renderer.parentNode(scrollbarRuler);
    if (parent) renderer.removeChild(parent, scrollbarRuler);
  });

  const scrollContainerDimensions = signalElementDimensions(scrollbarRuler);

  return computed(() => {
    const client = scrollContainerDimensions().client;
    if (!client) return null;
    return {
      width: Math.max(0, 100 - client.width),
      height: Math.max(0, 100 - client.height),
    };
  });
});
