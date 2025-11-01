import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, effect, inject, PLATFORM_ID, Renderer2 } from '@angular/core';
import { signalElementDimensions } from '../element-dimensions';

/**
 * Applies size CSS variables to the documentElement in pixels.
 * - `--et-vw`: viewport width excluding scrollbar width
 * - `--et-vh`: viewport height excluding scrollbar height
 * - `--et-sw`: scrollbar width
 * - `--et-sh`: scrollbar height
 */
export const monitorViewport = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return;
  }

  const document = inject(DOCUMENT);
  const renderer = inject(Renderer2);

  const htmlElementDimensions = signalElementDimensions(document.documentElement);

  effect(() => {
    const dimensions = htmlElementDimensions().rect?.();

    if (!dimensions) return;

    document.documentElement.style.setProperty('--et-vw', `${dimensions.width}px`);
    document.documentElement.style.setProperty('--et-vh', `${dimensions.height}px`);
  });

  const scrollbarRuler = renderer.createElement('div');
  scrollbarRuler.style.width = '100px';
  scrollbarRuler.style.height = '100px';
  scrollbarRuler.style.overflow = 'scroll';
  scrollbarRuler.style.position = 'absolute';
  scrollbarRuler.style.top = '-9999px';
  renderer.appendChild(document.body, scrollbarRuler);

  const scrollContainerDimensions = signalElementDimensions(scrollbarRuler);

  effect(() => {
    const dimensions = scrollContainerDimensions().rect?.();

    if (!dimensions) return;

    document.documentElement.style.setProperty('--et-sw', `${dimensions.width}px`);
    document.documentElement.style.setProperty('--et-sh', `${dimensions.height}px`);
  });
};
