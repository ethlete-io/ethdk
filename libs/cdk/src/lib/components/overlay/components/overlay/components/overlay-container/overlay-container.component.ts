import { FocusMonitor, FocusTrapFactory, InteractivityChecker } from '@angular/cdk/a11y';
import { CdkDialogContainer } from '@angular/cdk/dialog';
import { OverlayRef as CdkOverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewEncapsulation, inject } from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  RootBoundaryDirective,
  elementCanScroll,
  nextFrame,
} from '@ethlete/core';
import { Subject, fromEvent, merge, takeUntil, tap } from 'rxjs';
import { SwipeHandlerService } from '../../../../../../services';
import { ProvideThemeDirective, THEME_PROVIDER } from '../../../../../../theming';
import { SwipeEndEvent, SwipeUpdateEvent } from '../../../../../../types';
import { OVERLAY_CONFIG } from '../../constants';
import { OverlayConfig, OverlayDragToDismissConfig } from '../../types';
import { OverlayRef } from '../../utils';

const isTouchEvent = (event: Event): event is TouchEvent => {
  return event.type[0] === 't';
};

@Component({
  selector: 'et-overlay-container',
  styleUrls: ['./overlay-container.component.scss'],
  template: `
    <div class="et-overlay-container-drag-handle"></div>
    <ng-template cdkPortalOutlet />
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-overlay',
    tabindex: '-1',
    '[attr.aria-modal]': '_config.ariaModal',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledByHack',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
    '[class.et-with-default-animation]': '!_config.customAnimated',
  },
  imports: [PortalModule],
  hostDirectives: [RootBoundaryDirective, AnimatedLifecycleDirective, ProvideThemeDirective],
})
export class OverlayContainerComponent extends CdkDialogContainer<OverlayConfig> {
  get _ariaLabelledByHack() {
    // @ts-expect-error private property
    return super._ariaLabelledBy;
  }

  private readonly _swipeHandlerService = inject(SwipeHandlerService);
  private readonly _dragToDismissStop$ = new Subject<void>();
  readonly _themeProvider = inject(THEME_PROVIDER);
  private readonly _parentThemeProvider = inject(THEME_PROVIDER, { optional: true, skipSelf: true });
  readonly _rootBoundary = inject(RootBoundaryDirective);

  readonly _animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN);
  readonly cdkOverlayRef = inject(CdkOverlayRef);

  overlayRef: OverlayRef | null = null;

  readonly elementRef = this._elementRef;

  constructor() {
    super(
      inject(ElementRef),
      inject(FocusTrapFactory),
      inject(DOCUMENT),
      inject(OVERLAY_CONFIG),
      inject(InteractivityChecker),
      inject(NgZone),
      inject(CdkOverlayRef),
      inject(FocusMonitor),
    );

    if (this._parentThemeProvider) {
      this._themeProvider.syncWithProvider(this._parentThemeProvider);
    }
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    this._rootBoundary.boundaryElement = this._elementRef.nativeElement;

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
  }

  protected override _captureInitialFocus(): void {
    if (!this._config.delayFocusTrap) {
      this._trapFocus();
    }
  }

  protected _openAnimationDone() {
    if (this._config.delayFocusTrap) {
      this._trapFocus();
    }
  }

  _enableDragToDismiss(config: OverlayDragToDismissConfig) {
    if (!this.overlayRef) return;

    this._dragToDismissStop$.next();

    const el = this._elementRef.nativeElement as HTMLElement;
    let swipeId: number | null = null;
    let isSelectionActive = false;

    const cancelDrag = () => {
      el.style.setProperty('transition', 'transform 100ms var(--ease-out-1)');
      el.style.transform =
        config.direction === 'to-bottom' || config.direction === 'to-top' ? 'translateY(0)' : 'translateX(0)';
      swipeId = null;

      setTimeout(() => {
        el.style.removeProperty('transition');
        el.style.removeProperty('transform');
      }, 100);
    };

    merge(fromEvent<TouchEvent>(el, 'touchstart'), fromEvent<MouseEvent>(el, 'mousedown'))
      .pipe(
        takeUntil(this._dragToDismissStop$),
        takeUntil(this.overlayRef.afterClosed()),
        tap((event) => {
          if (isSelectionActive) return;

          const target = event.target as HTMLElement;
          const tag = target.tagName.toLowerCase();

          if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a') return;

          swipeId = this._swipeHandlerService.startSwipe(event);
        }),
      )
      .subscribe();

    fromEvent<Event>(document, 'selectionchange')
      .pipe(takeUntil(this._dragToDismissStop$), takeUntil(this.overlayRef.afterClosed()))
      .subscribe(() => {
        const selection = document.getSelection();

        if (!selection || !selection.toString().length) {
          isSelectionActive = false;
          return;
        }

        isSelectionActive = true;

        cancelDrag();
      });

    merge(fromEvent<TouchEvent>(el, 'touchmove'), fromEvent<MouseEvent>(el, 'mousemove'))
      .pipe(
        takeUntil(this._dragToDismissStop$),
        takeUntil(this.overlayRef.afterClosed()),
        tap((event) => {
          if (swipeId === null || isSelectionActive) return;

          if (isTouchEvent(event)) {
            const target = event.target as HTMLElement;

            const recursiveFindScrollableParent = (el: HTMLElement): HTMLElement | null => {
              if (!el) return null;

              if (config.direction === 'to-bottom' || config.direction === 'to-top') {
                if (elementCanScroll(el, 'y')) {
                  return el;
                }
              } else {
                if (elementCanScroll(el, 'x')) {
                  return el;
                }
              }

              if (!el.parentElement || el.tagName.toLowerCase() === 'et-overlay-container') return null;

              return recursiveFindScrollableParent(el.parentElement);
            };

            const scrollableElement = recursiveFindScrollableParent(target);

            if (scrollableElement) {
              let cancel = false;
              if (config.direction === 'to-bottom') {
                if (scrollableElement.scrollTop !== 0) {
                  cancel = true;
                }
              } else if (config.direction === 'to-top') {
                if (
                  Math.round(scrollableElement.scrollTop) !==
                  scrollableElement.scrollHeight - scrollableElement.clientHeight
                ) {
                  cancel = true;
                }
              } else if (config.direction === 'to-right') {
                if (scrollableElement.scrollLeft !== 0) {
                  cancel = true;
                }
              } else {
                if (
                  Math.round(scrollableElement.scrollLeft) !==
                  scrollableElement.scrollWidth - scrollableElement.clientWidth
                ) {
                  cancel = true;
                }
              }

              if (cancel) {
                cancelDrag();

                return;
              }
            }
          }

          const swipeData = this._swipeHandlerService.updateSwipe(swipeId, event);

          if (!swipeData) return;

          const css = this._defaultSwipeMoveStyleInterpolator(swipeData, config);

          Object.entries(css).forEach(([key, value]) => {
            el.style.setProperty(key, value);
          });
        }),
      )
      .subscribe();

    merge(fromEvent<TouchEvent>(el, 'touchend'), fromEvent<MouseEvent>(el, 'mouseup'))
      .pipe(
        takeUntil(this._dragToDismissStop$),
        takeUntil(this.overlayRef.afterClosed()),
        tap(() => {
          if (swipeId === null || isSelectionActive) return;

          const swipeData = this._swipeHandlerService.endSwipe(swipeId);
          swipeId = null;

          if (!swipeData) return;

          const css = this._defaultSwipeEndStyleInterpolator(swipeData, config);

          if (!css) {
            this.overlayRef?._closeOverlayVia('touch');
            return;
          }

          Object.entries(css).forEach(([key, value]) => {
            if (key === 'cleanUp') {
              if (typeof value === 'string' || !value) return;

              setTimeout(() => {
                value.fn(el);
              }, value.delay);

              return;
            }

            el.style.setProperty(key, value as string);
          });
        }),
      )
      .subscribe();
  }

  _disableDragToDismiss() {
    this._dragToDismissStop$.next();
  }

  private _defaultSwipeMoveStyleInterpolator(event: SwipeUpdateEvent, config: OverlayDragToDismissConfig) {
    const { direction } = config;
    const { movementX, movementY } = event;

    if (direction === 'to-bottom') {
      return {
        transform: `translateY(${movementY < 0 ? 0 : movementY}px)`,
      };
    } else if (direction === 'to-top') {
      return {
        transform: `translateY(${movementY > 0 ? 0 : movementY}px)`,
      };
    } else if (direction === 'to-left') {
      return {
        transform: `translateX(${movementX > 0 ? 0 : movementX}px)`,
      };
    } else {
      return {
        transform: `translateX(${movementX < 0 ? 0 : movementX}px)`,
      };
    }
  }

  private _defaultSwipeEndStyleInterpolator(event: SwipeEndEvent, config: OverlayDragToDismissConfig) {
    const { direction, minDistanceToDismiss = 150, minVelocityToDismiss = 150 } = config;
    const { movementX, movementY, pixelPerSecondX, pixelPerSecondY } = event;

    const cleanUp = {
      delay: 100,
      fn: (el: HTMLElement) => el.style.removeProperty('transition'),
    };

    if (direction === 'to-bottom') {
      if (movementY < minDistanceToDismiss && pixelPerSecondY < minVelocityToDismiss) {
        return {
          transform: `translateY(0)`,
          transition: 'transform 100ms var(--ease-out-1)',
          cleanUp: movementY ? cleanUp : undefined,
        };
      } else {
        return null;
      }
    }
    if (direction === 'to-top') {
      if (movementY > -minDistanceToDismiss && pixelPerSecondY > -minVelocityToDismiss) {
        return {
          transform: `translateY(0)`,
          transition: 'transform 100ms var(--ease-out-1)',
          cleanUp: movementY ? cleanUp : undefined,
        };
      } else {
        return null;
      }
    } else if (direction === 'to-left') {
      if (movementX > -minDistanceToDismiss && pixelPerSecondX > -minVelocityToDismiss) {
        return {
          transform: `translateX(0)`,
          transition: 'transform 100ms var(--ease-out-1)',
          cleanUp: movementX ? cleanUp : undefined,
        };
      } else {
        return null;
      }
    } else {
      if (movementX < minDistanceToDismiss && pixelPerSecondX < minVelocityToDismiss) {
        return {
          transform: `translateX(0)`,
          transition: 'transform 100ms var(--ease-out-1)',
          cleanUp: movementX ? cleanUp : undefined,
        };
      } else {
        return null;
      }
    }
  }
}
