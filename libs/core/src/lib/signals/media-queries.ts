import { computed, DOCUMENT, inject, Renderer2 } from '@angular/core';
import { BuildMediaQueryOptions, injectBreakpointObserver } from '../providers';
import { createDocumentElementSignal } from './element';
import { signalElementDimensions } from './element-dimensions';
import { memoizeSignal } from './signal-data-utils';

/** Inject a signal containing a boolean value indicating if the viewport is xs */
export const injectIsXs = memoizeSignal(() => injectObserveBreakpoint({ max: 'xs' }));

/** Inject a signal containing a boolean value indicating if the viewport is sm */
export const injectIsSm = memoizeSignal(() => injectObserveBreakpoint({ min: 'sm', max: 'sm' }));

/** Inject a signal containing a boolean value indicating if the viewport is md */
export const injectIsMd = memoizeSignal(() => injectObserveBreakpoint({ min: 'md', max: 'md' }));

/** Inject a signal containing a boolean value indicating if the viewport is lg */
export const injectIsLg = memoizeSignal(() => injectObserveBreakpoint({ min: 'lg', max: 'lg' }));

/** Inject a signal containing a boolean value indicating if the viewport is xl */
export const injectIsXl = memoizeSignal(() => injectObserveBreakpoint({ min: 'xl', max: 'xl' }));

/** Inject a signal containing a boolean value indicating if the viewport is 2xl */
export const injectIs2Xl = memoizeSignal(() => injectObserveBreakpoint({ min: '2xl' }));

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
export const injectCurrentBreakpoint = memoizeSignal(() => {
  const isXs = injectIsXs();
  const isSm = injectIsSm();
  const isMd = injectIsMd();
  const isLg = injectIsLg();
  const isXl = injectIsXl();
  const is2Xl = injectIs2Xl();

  return computed(() => {
    switch (true) {
      case is2Xl():
        return '2xl';
      case isXl():
        return 'xl';
      case isLg():
        return 'lg';
      case isMd():
        return 'md';
      case isSm():
        return 'sm';
      case isXs():
      default:
        return 'xs';
    }
  });
});

/** Inject a signal that indicates if the user is using a portrait display */
export const injectIsPortrait = memoizeSignal(() => injectObserveMediaQuery('(orientation: portrait)'));

/** Inject a signal that indicates if the user is using a landscape display */
export const injectIsLandscape = memoizeSignal(() => injectObserveMediaQuery('(orientation: landscape)'));

/** Inject a signal containing the current display orientation */
export const injectDisplayOrientation = memoizeSignal(() => {
  const isPortrait = injectIsPortrait();

  return computed(() => {
    if (isPortrait()) return 'portrait';
    return 'landscape';
  });
});

/** Inject a signal that indicates if the device has a touch input */
export const injectHasTouchInput = memoizeSignal(() => injectObserveMediaQuery('(pointer: coarse)'));

/** Inject a signal that indicates if the device has a fine input (mouse or stylus)  */
export const injectHasPrecisionInput = memoizeSignal(() => injectObserveMediaQuery('(pointer: fine)'));

/** Inject a signal containing the current device input type */
export const injectDeviceInputType = memoizeSignal(() => {
  const isTouch = injectHasTouchInput();

  return computed(() => {
    if (isTouch()) return 'touch';
    return 'mouse';
  });
});

/** Inject a signal containing a boolean value indicating if the user can hover (eg. using a mouse) */
export const injectCanHover = memoizeSignal(() => injectObserveMediaQuery('(hover: hover)'));

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
