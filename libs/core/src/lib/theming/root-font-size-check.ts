import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  DestroyRef,
  EnvironmentInjector,
  inject,
  isDevMode,
  PLATFORM_ID,
  provideEnvironmentInitializer,
} from '@angular/core';

const TOLERANCE_PX = 0.5;

const readFontSizePx = (view: Window, element: Element) => {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(view.getComputedStyle(element).fontSize ?? '');

  return match ? Number(match[1]) : null;
};

const measureProbe = (document: Document, view: Window, fontSize: string) => {
  const probe = document.createElement('div');

  probe.style.setProperty('display', 'none', 'important');
  probe.style.setProperty('font-size', fontSize, 'important');
  document.documentElement.appendChild(probe);

  try {
    return readFontSizePx(view, probe);
  } finally {
    probe.remove();
  }
};

const measureUnsetRootFontSize = (document: Document) => {
  const view = document.defaultView;

  if (!view) return null;

  const root = readFontSizePx(view, document.documentElement);
  const browserDefault = measureProbe(document, view, 'medium');
  const smallest = measureProbe(document, view, '1px');

  if (root === null || browserDefault === null || smallest === null) return null;

  // A browser minimum font size at or above the default clamps any root to the default.
  if (smallest >= browserDefault - TOLERANCE_PX) return null;

  return Math.abs(root - browserDefault) <= TOLERANCE_PX ? root : null;
};

const warnIfRootFontSizeUnset = (document: Document) => {
  const root = measureUnsetRootFontSize(document);

  if (root === null) return;

  console.warn(
    `[provideSurfaceThemesWithTailwind4] The root font size is ${root}px, the browser default, so every SDK control renders 1.6x too large. The SDK sizes everything in rem against a 10px root (${root * 0.625}px here). Add \`html { font-size: 62.5%; }\` to your global styles. See https://ethlete-sdk-docs-next.web.app/components/setup`,
  );
};

export const provideRootFontSizeCheck = () =>
  provideEnvironmentInitializer(() => {
    if (!isDevMode() || !isPlatformBrowser(inject(PLATFORM_ID))) return;

    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    const injector = inject(EnvironmentInjector);

    afterNextRender(
      () => {
        const view = document.defaultView;

        if (!view) return;

        if (document.readyState === 'complete') {
          warnIfRootFontSizeUnset(document);

          return;
        }

        const removeListener = () => view.removeEventListener('load', onLoad);
        const unregisterOnDestroy = destroyRef.onDestroy(removeListener);
        const onLoad = () => {
          removeListener();
          unregisterOnDestroy();
          warnIfRootFontSizeUnset(document);
        };

        view.addEventListener('load', onLoad);
      },
      { injector },
    );
  });
