import { computed, DOCUMENT, inject, Renderer2 } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ViewportService } from '../services';
import { createMediaQueryObservable } from '../utils';
import { Breakpoint } from './core';
import { createDocumentElementSignal } from './element';
import { signalElementDimensions } from './element-dimensions';
import { memoizeSignal } from './signal-data-utils';

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

/** Inject a signal containing the viewport dimensions */
export const injectViewportDimensions = memoizeSignal(() => signalElementDimensions(createDocumentElementSignal()));

/** Inject a signal containing the scrollbar dimensions. Dimensions will be 0 if scrollbars overlap the page contents (like on mobile). */
export const injectScrollbarDimensions = memoizeSignal(() => {
  const document = inject(DOCUMENT);
  const renderer = inject(Renderer2);

  const scrollbarRuler = renderer.createElement('div');
  scrollbarRuler.style.width = '100px';
  scrollbarRuler.style.height = '100px';
  scrollbarRuler.style.overflow = 'scroll';
  scrollbarRuler.style.position = 'absolute';
  scrollbarRuler.style.top = '-9999px';
  renderer.appendChild(document.body, scrollbarRuler);

  const scrollContainerDimensions = signalElementDimensions(scrollbarRuler);

  return scrollContainerDimensions;
});
