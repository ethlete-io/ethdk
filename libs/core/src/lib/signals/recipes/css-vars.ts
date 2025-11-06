import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, effect, inject, PLATFORM_ID, Renderer2 } from '@angular/core';
import { injectScrollbarDimensions, injectViewportDimensions } from '../media-queries';

/**
 * Applies scrollbar size CSS variables to the documentElement (html tag) in pixels.
 * - `--et-sw`: scrollbar width
 * - `--et-sh`: scrollbar height
 */
export const writeScrollbarSizeToCssVariables = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const document = inject(DOCUMENT);
  const renderer = inject(Renderer2);
  const scrollbarDimensions = injectScrollbarDimensions();

  effect(() => {
    const dimensions = scrollbarDimensions().rect?.();

    if (!dimensions) return;

    renderer.setStyle(document.documentElement, '--et-sw', `${dimensions.width}px`);
    renderer.setStyle(document.documentElement, '--et-sh', `${dimensions.height}px`);
  });
};

/**
 * Applies viewport size CSS variables to the documentElement (html tag) in pixels.
 * - `--et-vw`: viewport width excluding scrollbar width
 * - `--et-vh`: viewport height excluding scrollbar height
 */
export const writeViewportSizeToCssVariables = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const document = inject(DOCUMENT);
  const renderer = inject(Renderer2);
  const htmlElementDimensions = injectViewportDimensions();

  effect(() => {
    const dimensions = htmlElementDimensions().rect?.();

    if (!dimensions) return;

    renderer.setStyle(document.documentElement, '--et-vw', `${dimensions.width}px`);
    renderer.setStyle(document.documentElement, '--et-vh', `${dimensions.height}px`);
  });
};
