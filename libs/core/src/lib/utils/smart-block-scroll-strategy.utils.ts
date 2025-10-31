import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { ScrollStrategy } from '@angular/cdk/overlay';
import { supportsScrollBehavior } from '@angular/cdk/platform';
import { ViewportRuler } from '@angular/cdk/scrolling';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { skip, startWith, Subscription, take, tap } from 'rxjs';
import { injectRoute } from '../signals';
import { createResizeObservable } from './resize-observable.util';
import { elementCanScroll } from './scrollable.utils';

const scrollBehaviorSupported = supportsScrollBehavior();

const BLOCK_CLASS = 'cdk-global-scrollblock';
const OVERSCROLL_CLASS = 'et-global-no-overscroll';

/**
 * @deprecated Will be removed in v5. Scroll blocking for overlays is build in by default.
 */
export class SmartBlockScrollStrategy implements ScrollStrategy {
  private _previousHTMLStyles = { top: '', left: '' };
  private _previousScrollPosition: { top: number; left: number } = { top: 0, left: 0 };
  private _isEnabled = false;
  private _urlSubscription: Subscription | null = null;
  private _resizeSubscription: Subscription | null = null;
  private _didNavigate = false;

  private viewportRuler = inject(ViewportRuler);
  private document = inject(DOCUMENT);
  private route$ = toObservable(injectRoute());

  attach() {
    // noop
  }

  enable() {
    if (!this._canBeEnabled()) return;

    const root = this.document.documentElement;
    root.classList.add(OVERSCROLL_CLASS);

    this._resizeSubscription = createResizeObservable({ elements: root })
      .pipe(
        startWith(null),
        tap(() => {
          if (this._isEnabled || !elementCanScroll(root) || !this._canBeEnabled()) return;

          this._isEnabled = true;

          this._previousScrollPosition = this.viewportRuler.getViewportScrollPosition();
          this._didNavigate = false;

          this._previousHTMLStyles.left = root.style.left || '';
          this._previousHTMLStyles.top = root.style.top || '';

          root.style.left = coerceCssPixelValue(-this._previousScrollPosition.left);
          root.style.top = coerceCssPixelValue(-this._previousScrollPosition.top);
          root.classList.add(BLOCK_CLASS);

          this._urlSubscription = this.route$
            .pipe(
              skip(1),
              take(1),
              tap(() => {
                this._didNavigate = true;
              }),
            )
            .subscribe();
        }),
      )
      .subscribe();
  }

  disable() {
    this._urlSubscription?.unsubscribe();
    this._resizeSubscription?.unsubscribe();
    const html = this.document.documentElement;

    if (this._canBeEnabled()) {
      html.classList.remove(OVERSCROLL_CLASS);
    }

    if (this._isEnabled) {
      const body = this.document.body;
      const htmlStyle = html.style;
      const bodyStyle = body.style;
      const previousHtmlScrollBehavior = htmlStyle.scrollBehavior || '';
      const previousBodyScrollBehavior = bodyStyle.scrollBehavior || '';

      this._isEnabled = false;

      htmlStyle.left = this._previousHTMLStyles.left;
      htmlStyle.top = this._previousHTMLStyles.top;
      html.classList.remove(BLOCK_CLASS);

      if (scrollBehaviorSupported) {
        htmlStyle.scrollBehavior = bodyStyle.scrollBehavior = 'auto';
      }

      if (!this._didNavigate) {
        window.scroll(this._previousScrollPosition.left, this._previousScrollPosition.top);
      }

      if (scrollBehaviorSupported) {
        htmlStyle.scrollBehavior = previousHtmlScrollBehavior;
        bodyStyle.scrollBehavior = previousBodyScrollBehavior;
      }
    }
  }

  private _canBeEnabled(): boolean {
    const html = this.document.documentElement;

    if (html.classList.contains(BLOCK_CLASS) || this._isEnabled) {
      return false;
    }

    return true;
  }
}
