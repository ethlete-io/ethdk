import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { ScrollStrategy } from '@angular/cdk/overlay';
import { supportsScrollBehavior } from '@angular/cdk/platform';
import { ViewportRuler } from '@angular/cdk/scrolling';
import { skip, Subscription, take, tap } from 'rxjs';
import { RouterStateService } from '../services';

const scrollBehaviorSupported = supportsScrollBehavior();

export class SmartBlockScrollStrategy implements ScrollStrategy {
  private _previousHTMLStyles = { top: '', left: '' };
  private _previousScrollPosition: { top: number; left: number } = { top: 0, left: 0 };
  private _isEnabled = false;
  private _document: Document;
  private _urlSubscription: Subscription | null = null;
  private _didNavigate = false;

  constructor(private _viewportRuler: ViewportRuler, private _routerState: RouterStateService, document: Document) {
    this._document = document;
  }

  attach() {
    // noop
  }

  enable() {
    if (this._canBeEnabled()) {
      const root = this._document.documentElement;

      this._previousScrollPosition = this._viewportRuler.getViewportScrollPosition();
      this._didNavigate = false;

      this._previousHTMLStyles.left = root.style.left || '';
      this._previousHTMLStyles.top = root.style.top || '';

      root.style.left = coerceCssPixelValue(-this._previousScrollPosition.left);
      root.style.top = coerceCssPixelValue(-this._previousScrollPosition.top);
      root.classList.add('cdk-global-scrollblock');
      this._isEnabled = true;

      this._urlSubscription = this._routerState.route$
        .pipe(
          skip(1),
          take(1),
          tap(() => {
            this._didNavigate = true;
          }),
        )
        .subscribe();
    }
  }

  disable() {
    if (this._isEnabled) {
      this._urlSubscription?.unsubscribe();

      const html = this._document.documentElement;
      const body = this._document.body;
      const htmlStyle = html.style;
      const bodyStyle = body.style;
      const previousHtmlScrollBehavior = htmlStyle.scrollBehavior || '';
      const previousBodyScrollBehavior = bodyStyle.scrollBehavior || '';

      this._isEnabled = false;

      htmlStyle.left = this._previousHTMLStyles.left;
      htmlStyle.top = this._previousHTMLStyles.top;
      html.classList.remove('cdk-global-scrollblock');

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
    const html = this._document.documentElement;

    if (html.classList.contains('cdk-global-scrollblock') || this._isEnabled) {
      return false;
    }

    return true;
  }
}
