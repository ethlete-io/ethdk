import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import {
  ComponentRef,
  Directive,
  ElementRef,
  Injector,
  Input,
  NgZone,
  StaticProvider,
  ViewContainerRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  isDevMode,
} from '@angular/core';
import {
  OffsetOptions,
  Padding,
  Placement,
  arrow,
  autoUpdate,
  computePosition,
  flip,
  hide,
  limitShift,
  offset,
  shift,
  size,
} from '@floating-ui/dom';
import { BehaviorSubject, Subject, filter, take, takeUntil, tap } from 'rxjs';
import { injectBoundaryElement } from '../../providers';
import { signalElementDimensions } from '../../signals';
import { createDestroy, nextFrame } from '../../utils';
import { AnimatedLifecycleDirective } from '../animated-lifecycle';

export interface AnimatedOverlayComponentBase {
  _elementRef?: ElementRef<HTMLElement>;
  _animatedLifecycle?: AnimatedLifecycleDirective;
  _markForCheck?: () => void;

  // Theming lives inside the cdk now. We cant import it into core.
  // FIXME: Type this properly once core is moved to cdk.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _setThemeFromProvider?: (provider: any) => void;
}

@Directive({
  standalone: true,
  host: {
    class: 'et-animated-overlay',
  },
})
export class AnimatedOverlayDirective<T extends AnimatedOverlayComponentBase> {
  private readonly _destroy$ = createDestroy();
  private readonly _overlayService = inject(Overlay);
  private readonly _injector = inject(Injector);
  private readonly _viewContainerRef = inject(ViewContainerRef);
  private readonly _zone = inject(NgZone);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _rootBoundary = injectBoundaryElement();

  private _portal: ComponentPortal<T> | null = null;
  private _overlayRef: OverlayRef | null = null;
  private _componentRef: ComponentRef<T> | null = null;
  private _floatingElCleanupFn: (() => void) | null = null;

  private _beforeOpened: Subject<void> | null = null;
  private _afterOpened: Subject<void> | null = null;
  private _beforeClosed: Subject<void> | null = null;
  private _afterClosed: Subject<void> | null = null;

  private readonly _isMounted$ = new BehaviorSubject<boolean>(false);
  private readonly _isMounting$ = new BehaviorSubject<boolean>(false);
  private readonly _isUnmounting$ = new BehaviorSubject<boolean>(false);
  private readonly _isHidden$ = new BehaviorSubject<boolean>(false);

  /**
   * The placement of the animated overlay.
   * @default undefined
   */
  @Input()
  placement?: Placement = 'bottom';

  /**
   * The allowed auto placements of the animated overlay.
   * @see https://floating-ui.com/docs/flip#fallbackplacements
   */
  @Input()
  fallbackPlacements?: Placement[];

  /**
   * The offset of the animated overlay.
   * @see https://floating-ui.com/docs/offset
   */
  @Input()
  offset: OffsetOptions | null = null;

  /**
   * The arrow padding.
   * @see https://floating-ui.com/docs/arrow#padding
   * @default 4
   */
  @Input()
  arrowPadding: Padding | null = 4;

  /**
   * The viewport padding.
   * @default 8
   */
  @Input()
  viewportPadding: Padding | null = 8;

  /**
   * Whether the animated overlay should auto resize to fit the available space.
   * Useful for things like selects where the list of options might be longer than the available space.
   * @default false
   */
  @Input({ transform: booleanAttribute })
  autoResize = false;

  /**
   * Whether the animated overlay should shift when it is near the viewport boundary.
   */
  @Input({ transform: booleanAttribute })
  shift = true;

  /**
   * Whether the animated overlay should auto hide when the reference element is hidden.
   * @default false
   */
  @Input({ transform: booleanAttribute })
  autoHide = false;

  /**
   * Whether the animated overlay should auto close if the reference element is hidden.
   * @default false
   */
  @Input({ transform: booleanAttribute })
  autoCloseIfReferenceHidden = false;

  /**
   * The reference element for the animated overlay.
   * @default this._elementRef.nativeElement
   */
  @Input()
  referenceElement = this._elementRef.nativeElement;

  mirrorWidth = input(false, { transform: booleanAttribute });

  referenceElementDimensions = signalElementDimensions(
    computed(() => (this.mirrorWidth() ? this.referenceElement : null)),
  );

  get isMounted() {
    return this._isMounted$.value;
  }

  get isMounted$() {
    return this._isMounted$.asObservable();
  }

  get isMounting() {
    return this._isMounting$.value;
  }

  get isMounting$() {
    return this._isMounting$.asObservable();
  }

  get isUnmounting() {
    return this._isUnmounting$.value;
  }

  get isHidden$() {
    return this._isHidden$.asObservable();
  }

  get isHidden() {
    return this._isHidden$.value;
  }

  get canMount() {
    return !this.isMounted && !this.isMounting;
  }

  get canUnmount() {
    return this.isMounted && !this.isUnmounting;
  }

  get portal() {
    return this._portal;
  }

  get overlayRef() {
    return this._overlayRef;
  }

  get componentRef() {
    return this._componentRef;
  }

  constructor() {
    effect(() => {
      const dimensions = this.referenceElementDimensions();

      if (!dimensions || !this.mirrorWidth()) return;

      this._overlayRef?.updateSize({
        width: this._elementRef.nativeElement.offsetWidth,
      });
    });
  }

  mount(config: {
    component: ComponentType<T>;
    providers?: StaticProvider[];
    data?: Partial<T>;

    // Theming lives inside the cdk now. We cant import it into core.
    // FIXME: Type this properly once core is moved to cdk.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    themeProvider?: any | null;
  }) {
    if (this.isMounted) {
      if (isDevMode()) {
        if (this.isMounted) {
          console.warn(
            'AnimatedOverlayDirective: The component is currently mounted. Please unmount the component before mounting again.',
          );
        }
      }

      return;
    }

    if (this.isMounting) {
      return;
    }

    this._isMounting$.next(true);

    const { component, providers, data, themeProvider } = config;

    this._beforeOpened?.next();

    const injector = Injector.create({
      parent: this._injector,
      providers: providers ?? [],
    });

    this._overlayRef = this._overlayService.create();

    this._portal = new ComponentPortal(component, this._viewContainerRef, injector);
    this._componentRef = this._overlayRef.attach(this._portal);

    if (data) {
      Object.assign(this._componentRef.instance, data);
    }

    this._componentRef.instance._markForCheck?.();

    if (themeProvider) {
      this._componentRef.instance._setThemeFromProvider?.(themeProvider);
    }

    if (this.mirrorWidth()) {
      this._overlayRef.updateSize({
        width: this._elementRef.nativeElement.offsetWidth,
      });
    }

    this._zone.runOutsideAngular(() => {
      if (!this._componentRef) {
        return;
      }

      const floatingEl = this._componentRef.location.nativeElement as HTMLElement;
      const floatingElArrow = this._componentRef.instance._elementRef?.nativeElement.querySelector(
        '[et-floating-arrow]',
      ) as HTMLElement | null;

      floatingEl.classList.add('et-floating-element');

      const refEl = this.referenceElement;
      const boundary = this._rootBoundary.value();

      this._floatingElCleanupFn = autoUpdate(refEl, floatingEl, () => {
        if (!this._componentRef) return;

        computePosition(refEl, floatingEl, {
          placement: this.placement,

          middleware: [
            ...(this.offset ? [offset(this.offset)] : []),
            flip({
              fallbackPlacements: this.fallbackPlacements ?? undefined,
              fallbackAxisSideDirection: 'start',
              boundary,
            }),
            ...(this.autoResize
              ? [
                  size({
                    padding: this.viewportPadding ?? undefined,
                    apply({ availableHeight, availableWidth }) {
                      floatingEl.style.setProperty('--et-floating-max-width', `${availableWidth}px`);
                      floatingEl.style.setProperty('--et-floating-max-height', `${availableHeight}px`);
                    },
                  }),
                ]
              : []),
            ...(this.shift
              ? [shift({ limiter: limitShift(), padding: this.viewportPadding ?? undefined, boundary })]
              : []),
            ...(floatingElArrow ? [arrow({ element: floatingElArrow, padding: this.arrowPadding ?? undefined })] : []),
            ...(this.autoHide || this.autoCloseIfReferenceHidden
              ? [hide({ strategy: 'referenceHidden', boundary })]
              : []),
          ],
        }).then(({ x, y, placement, middlewareData }) => {
          floatingEl.style.setProperty('--et-floating-translate', `translate3d(${x}px, ${y}px, 0)`);
          floatingEl.setAttribute('et-floating-placement', placement);

          if (middlewareData.arrow && floatingElArrow) {
            const { x: arrowX, y: arrowY } = middlewareData.arrow;

            floatingEl.style.setProperty(
              '--et-floating-arrow-translate',
              `translate3d(${arrowX ?? 0}px, ${arrowY ?? 0}px, 0)`,
            );
          }

          if (middlewareData.hide?.referenceHidden) {
            if (this.autoCloseIfReferenceHidden) {
              this.unmount();
            } else {
              floatingEl.classList.add('et-floating-element--hidden');
              this._isHidden$.next(true);
            }
          } else {
            if (this.autoHide) {
              floatingEl.classList.remove('et-floating-element--hidden');
              this._isHidden$.next(false);
            }
          }
        });
      });

      // We need to wait for the  content to be rendered
      nextFrame(() => {
        if (!this._componentRef) {
          return;
        }

        if (!this._componentRef.instance._animatedLifecycle) {
          console.error(
            'AnimatedOverlayDirective: The component does not have an AnimatedLifecycleDirective. Please add one to the component.',
          );
        }

        this._componentRef.instance._animatedLifecycle?.enter();

        this._componentRef.instance._animatedLifecycle?.state$
          .pipe(
            tap((s) => {
              if (s === 'entered') {
                this._afterOpened?.next();
              }
            }),
            take(1),
            takeUntil(this._destroy$),
          )
          .subscribe();

        this._isMounted$.next(true);
        this._isMounting$.next(false);
      });
    });

    return this._componentRef.instance;
  }

  unmount() {
    if (!this.isMounted) {
      if (isDevMode()) {
        if (!this.isMounted) {
          console.warn(
            `AnimatedOverlayDirective: The component is currently not mounted. Please call "mount" before calling "unmount" again.`,
          );
        }
      }

      return;
    }

    if (this.isUnmounting) {
      return;
    }

    if (!this._componentRef) {
      return;
    }

    if (this.isHidden) {
      return;
    }

    this._isUnmounting$.next(true);

    this._beforeClosed?.next();

    this._componentRef.instance._animatedLifecycle?.leave();

    this._componentRef.instance._animatedLifecycle?.state$
      .pipe(
        filter((s) => s === 'left'),
        take(1),
      )
      .subscribe(() => this._destroy());
  }

  beforeOpened() {
    if (!this._beforeOpened) {
      this._beforeOpened = new Subject();
    }

    return this._beforeOpened;
  }

  afterOpened() {
    if (!this._afterOpened) {
      this._afterOpened = new Subject();
    }

    return this._afterOpened;
  }

  beforeClosed() {
    if (!this._beforeClosed) {
      this._beforeClosed = new Subject();
    }

    return this._beforeClosed;
  }

  afterClosed() {
    if (!this._afterClosed) {
      this._afterClosed = new Subject();
    }

    return this._afterClosed;
  }

  _destroy() {
    this._zone.runOutsideAngular(() => {
      this._floatingElCleanupFn?.();
    });

    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
    }

    if (this._componentRef) {
      this._componentRef.destroy();
      this._componentRef = null;
    }

    this._isMounted$.next(false);
    this._isUnmounting$.next(false);

    this._afterClosed?.next();
  }
}
