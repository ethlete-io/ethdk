import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, effect, EnvironmentInjector, inject, PLATFORM_ID } from '@angular/core';
import { injectRenderer } from '../../providers';
import { injectScrollbarDimensions, injectViewportDimensions } from '../media-queries';

const scrollbarSizeWriters = /* @__PURE__ */ new WeakSet<EnvironmentInjector>();

/**
 * Applies scrollbar size CSS variables to the documentElement (html tag) in pixels.
 * - `--et-sw`: scrollbar width
 * - `--et-sh`: scrollbar height
 */
export const writeScrollbarSizeToCssVariables = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const environmentInjector = inject(EnvironmentInjector);
  if (scrollbarSizeWriters.has(environmentInjector)) {
    return;
  }
  scrollbarSizeWriters.add(environmentInjector);

  const document = inject(DOCUMENT);
  const renderer = injectRenderer();
  const scrollbarDimensions = injectScrollbarDimensions();

  effect(() => {
    const dimensions = scrollbarDimensions();

    if (!dimensions) return;

    renderer.setCssProperties(document.documentElement, {
      '--et-sw': `${dimensions.width}px`,
      '--et-sh': `${dimensions.height}px`,
    });
  });
};

const viewportSizeWriters = /* @__PURE__ */ new WeakSet<EnvironmentInjector>();

/**
 * Applies viewport size CSS variables to the documentElement (html tag) in pixels.
 * - `--et-vw`: viewport width excluding scrollbar width
 * - `--et-vh`: viewport height excluding scrollbar height
 */
export const writeViewportSizeToCssVariables = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const environmentInjector = inject(EnvironmentInjector);
  if (viewportSizeWriters.has(environmentInjector)) {
    return;
  }
  viewportSizeWriters.add(environmentInjector);

  const document = inject(DOCUMENT);
  const renderer = injectRenderer();
  const htmlElementDimensions = injectViewportDimensions();

  effect(() => {
    const dimensions = htmlElementDimensions().rect?.();

    if (!dimensions) return;

    renderer.setCssProperties(document.documentElement, {
      '--et-vw': `${dimensions.width}px`,
      '--et-vh': `${dimensions.height}px`,
    });
  });
};
