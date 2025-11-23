import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { ViewportRuler } from '@angular/cdk/scrolling';
import { DOCUMENT, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { createRootProvider, elementCanScroll, injectRoute } from '@ethlete/core';
import { fromEvent, map, of, startWith, switchMap, tap } from 'rxjs';
import { injectOverlayManager } from './overlay-manager';

const BLOCK_CLASS = 'cdk-global-scrollblock';
const OVERSCROLL_CLASS = 'et-global-no-overscroll';

export const [injectOverlayScrollBlocker] = createRootProvider(
  () => {
    const overlayManager = injectOverlayManager();
    const document = inject(DOCUMENT);
    const route = injectRoute();
    const viewportRuler = inject(ViewportRuler);

    const root = document.documentElement;
    const previousHTMLStyles = { top: '', left: '' };
    let previousScrollPosition = { top: 0, left: 0 };
    let isEnabled = false;
    let lastRoute: string | null = null;

    toObservable(overlayManager.hasOpenOverlays)
      .pipe(
        switchMap((hasOpenOverlays) => {
          if (!hasOpenOverlays) return of({ hasOpenOverlays, scrolled: false });

          return fromEvent(window, 'resize').pipe(
            startWith({ hasOpenOverlays, scrolled: true }),
            map(() => ({ hasOpenOverlays, scrolled: true })),
          );
        }),
        tap(({ hasOpenOverlays }) => {
          const hasBlockClass = root.classList.contains(BLOCK_CLASS);

          if (hasOpenOverlays && (hasBlockClass || elementCanScroll(root))) {
            if (isEnabled) return;

            previousScrollPosition = viewportRuler.getViewportScrollPosition();
            previousHTMLStyles.left = root.style.left || '';
            previousHTMLStyles.top = root.style.top || '';

            root.style.left = coerceCssPixelValue(-previousScrollPosition.left);
            root.style.top = coerceCssPixelValue(-previousScrollPosition.top);
            root.classList.add(BLOCK_CLASS, OVERSCROLL_CLASS);

            isEnabled = true;
            lastRoute = route();
          } else if (!hasOpenOverlays && isEnabled) {
            const htmlStyle = root.style;
            const bodyStyle = document.body.style;
            const previousHtmlScrollBehavior = htmlStyle.scrollBehavior || '';
            const previousBodyScrollBehavior = bodyStyle.scrollBehavior || '';
            const didNavigate = lastRoute !== route();

            root.classList.remove(BLOCK_CLASS, OVERSCROLL_CLASS);
            root.style.left = previousHTMLStyles.left;
            root.style.top = previousHTMLStyles.top;

            if (!didNavigate) {
              htmlStyle.scrollBehavior = bodyStyle.scrollBehavior = 'auto';
              window.scroll(previousScrollPosition.left, previousScrollPosition.top);
              htmlStyle.scrollBehavior = previousHtmlScrollBehavior;
              bodyStyle.scrollBehavior = previousBodyScrollBehavior;
            }

            isEnabled = false;
            lastRoute = null;
          }
        }),
      )
      .subscribe();
  },
  { name: 'Overlay Scroll Blocker' },
);
