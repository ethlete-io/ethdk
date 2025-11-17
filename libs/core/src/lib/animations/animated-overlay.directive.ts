import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import {
  ComponentRef,
  Directive,
  ElementRef,
  Injector,
  NgZone,
  Signal,
  StaticProvider,
  ViewContainerRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  isDevMode,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  MiddlewareData,
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
import { Subject, filter, take, takeUntil, tap } from 'rxjs';
import { injectBoundaryElement } from '../providers';
import { signalElementDimensions } from '../signals';
import { ProvideThemeDirective } from '../theming';
import { createDestroy, nextFrame } from '../utils';
import { AnimatedLifecycleDirective } from './animated-lifecycle.directive';

export interface AnimatedOverlayComponentBase {
  _elementRef?: ElementRef<HTMLElement>;
  _animatedLifecycle?: Signal<AnimatedLifecycleDirective | undefined>;
  _markForCheck?: () => void;
  _setThemeFromProvider?: (provider: ProvideThemeDirective) => void;
}

export interface AnimatedOverlayMountConfig<T> {
  component: ComponentType<T>;
  providers?: StaticProvider[];
  data?: Partial<T>;
  themeProvider?: ProvideThemeDirective | null;
}

@Directive({
  selector: '[etAnimatedOverlay]',
  exportAs: 'etAnimatedOverlay',
  host: {
    class: 'et-animated-overlay',
  },
})
export class AnimatedOverlayDirective<T extends AnimatedOverlayComponentBase> {
  private destroy$ = createDestroy();
  private overlayService = inject(Overlay);
  private injector = inject(Injector);
  private viewContainerRef = inject(ViewContainerRef);
  private zone = inject(NgZone);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private rootBoundary = injectBoundaryElement({ optional: true });

  private floatingElCleanupFn: (() => void) | null = null;

  portal: ComponentPortal<T> | null = null;
  overlayRef: OverlayRef | null = null;
  componentRef: ComponentRef<T> | null = null;

  private _beforeOpened: Subject<void> | null = null;
  private _afterOpened: Subject<void> | null = null;
  private _beforeClosed: Subject<void> | null = null;
  private _afterClosed: Subject<void> | null = null;

  state = signal<'init' | 'mounting' | 'mounted' | 'unmounting' | 'unmounted'>('init');

  isMounted = computed(() => this.state() === 'mounted');
  isMounting = computed(() => this.state() === 'mounting');
  isUnmounted = computed(() => this.state() === 'unmounted');
  isUnmounting = computed(() => this.state() === 'unmounting');

  canMount = computed(() => !this.isMounted() && !this.isMounting());
  canUnmount = computed(() => this.isMounted() && !this.isUnmounting());

  isMounted$ = toObservable(this.isMounted);
  isMounting$ = toObservable(this.isMounting);
  isUnmounted$ = toObservable(this.isUnmounted);
  isUnmounting$ = toObservable(this.isUnmounting);

  isHidden = signal(false);
  isHidden$ = toObservable(this.isHidden);

  /**
   * The placement of the animated overlay.
   * @default 'bottom'
   */
  placement = input<Placement | undefined>('bottom');

  /**
   * The allowed auto placements of the animated overlay.
   * @see https://floating-ui.com/docs/flip#fallbackplacements
   */
  fallbackPlacements = input<Placement[]>();

  /**
   * The offset of the animated overlay.
   * @see https://floating-ui.com/docs/offset
   */
  offset = input<OffsetOptions | null>(null);

  /**
   * The arrow padding.
   * @see https://floating-ui.com/docs/arrow#padding
   * @default 4
   */
  arrowPadding = input<Padding | null>(4);

  /**
   * The viewport padding.
   * @default 8
   */
  viewportPadding = input<Padding | null>(8);

  /**
   * Whether the animated overlay should auto resize to fit the available space.
   * Useful for things like selects where the list of options might be longer than the available space.
   * @default false
   */
  autoResize = input(false, { transform: booleanAttribute });

  /**
   * Whether the animated overlay should shift when it is near the viewport boundary.
   * @default true
   */
  shift = input(true, { transform: booleanAttribute });

  /**
   * Whether the animated overlay should auto hide when the reference element is hidden.
   * @default false
   */
  autoHide = input(false, { transform: booleanAttribute });

  /**
   * Whether the animated overlay should auto close if the reference element is hidden.
   * @default false
   */
  autoCloseIfReferenceHidden = input(false, { transform: booleanAttribute });

  /**
   * The reference element for the animated overlay.
   * @default this._elementRef.nativeElement
   */
  referenceElement = input(this.elementRef.nativeElement);

  /**
   * Whether to mirror the width of the reference element.
   * @default false
   */
  mirrorWidth = input(false, { transform: booleanAttribute });

  referenceElementDimensions = signalElementDimensions(
    computed(() => (this.mirrorWidth() ? this.referenceElement() : null)),
  );

  constructor() {
    effect(() => {
      const dimensions = this.referenceElementDimensions();

      if (!dimensions || !this.mirrorWidth()) return;

      this.overlayRef?.updateSize({
        width: this.elementRef.nativeElement.offsetWidth,
      });
    });
  }

  mount(config: AnimatedOverlayMountConfig<T>) {
    if (!this.canMount) {
      if (isDevMode()) {
        console.warn('AnimatedOverlayDirective: Cannot mount. Component is already mounted or currently mounting.');
      }
      return;
    }

    this.state.set('mounting');

    const { component, providers, data, themeProvider } = config;

    this._beforeOpened?.next();

    const injector = Injector.create({
      parent: this.injector,
      providers: providers ?? [],
    });

    this.overlayRef = this.overlayService.create();
    this.portal = new ComponentPortal(component, this.viewContainerRef, injector);
    this.componentRef = this.overlayRef.attach(this.portal);

    this._applyComponentData(data);
    this._applyThemeProvider(themeProvider);
    this._updateOverlaySize();
    this._setupFloatingUI();

    return this.componentRef.instance;
  }

  unmount() {
    if (!this.canUnmount) {
      if (isDevMode()) {
        console.warn('AnimatedOverlayDirective: Cannot unmount. Component is not mounted or currently unmounting.');
      }
      return;
    }

    if (!this.componentRef || this.isHidden()) {
      return;
    }

    this.state.set('unmounting');
    this._beforeClosed?.next();

    const lifecycle = this.componentRef.instance._animatedLifecycle?.();

    if (!lifecycle) {
      this._destroy();
      return;
    }

    lifecycle.leave();
    lifecycle.state$
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

  private _applyComponentData(data?: Partial<T>) {
    if (!this.componentRef || !data) return;

    Object.assign(this.componentRef.instance, data);
    this.componentRef.instance._markForCheck?.();
  }

  private _applyThemeProvider(themeProvider?: ProvideThemeDirective | null) {
    if (!this.componentRef || !themeProvider) return;

    this.componentRef.instance._setThemeFromProvider?.(themeProvider);
  }

  private _updateOverlaySize() {
    if (!this.overlayRef || !this.mirrorWidth()) return;

    this.overlayRef.updateSize({
      width: this.elementRef.nativeElement.offsetWidth,
    });
  }

  private _setupFloatingUI() {
    if (!this.componentRef) return;

    this.zone.runOutsideAngular(() => {
      const floatingEl = this.componentRef!.location.nativeElement as HTMLElement;
      const floatingElArrow = this._getFloatingArrow();

      floatingEl.classList.add('et-floating-element');

      const refEl = this.referenceElement();
      const boundary = this.rootBoundary?.value();

      this.floatingElCleanupFn = autoUpdate(refEl, floatingEl, () => {
        this._updateFloatingPosition(floatingEl, refEl, boundary, floatingElArrow);
      });

      this._waitForRenderAndAnimate();
    });
  }

  private _getFloatingArrow(): HTMLElement | null {
    if (!this.componentRef?.instance._elementRef) return null;

    return this.componentRef.instance._elementRef.nativeElement.querySelector(
      '[et-floating-arrow]',
    ) as HTMLElement | null;
  }

  private _updateFloatingPosition(
    floatingEl: HTMLElement,
    refEl: HTMLElement,
    boundary: HTMLElement | undefined,
    floatingElArrow: HTMLElement | null,
  ) {
    if (!this.componentRef) return;

    const middleware = this._buildFloatingMiddleware(floatingEl, boundary, floatingElArrow);

    computePosition(refEl, floatingEl, {
      placement: this.placement(),
      middleware,
    }).then(({ x, y, placement, middlewareData }) => {
      this._applyFloatingStyles(floatingEl, x, y, placement);
      this._applyArrowStyles(floatingEl, middlewareData, floatingElArrow);
      this._handleReferenceHidden(floatingEl, middlewareData);
    });
  }

  private _buildFloatingMiddleware(
    floatingEl: HTMLElement,
    boundary: HTMLElement | undefined,
    floatingElArrow: HTMLElement | null,
  ) {
    const middleware = [];

    const offsetValue = this.offset();
    if (offsetValue) {
      middleware.push(offset(offsetValue));
    }

    middleware.push(
      flip({
        fallbackPlacements: this.fallbackPlacements() ?? undefined,
        fallbackAxisSideDirection: 'start',
        boundary,
      }),
    );

    if (this.autoResize()) {
      middleware.push(
        size({
          padding: this.viewportPadding() ?? undefined,
          apply({ availableHeight, availableWidth }) {
            floatingEl.style.setProperty('--et-floating-max-width', `${availableWidth}px`);
            floatingEl.style.setProperty('--et-floating-max-height', `${availableHeight}px`);
          },
        }),
      );
    }

    if (this.shift()) {
      middleware.push(
        shift({
          limiter: limitShift(),
          padding: this.viewportPadding() ?? undefined,
          boundary,
        }),
      );
    }

    if (floatingElArrow) {
      middleware.push(arrow({ element: floatingElArrow, padding: this.arrowPadding() ?? undefined }));
    }

    if (this.autoHide() || this.autoCloseIfReferenceHidden()) {
      middleware.push(hide({ strategy: 'referenceHidden', boundary }));
    }

    return middleware;
  }

  private _applyFloatingStyles(floatingEl: HTMLElement, x: number, y: number, placement: Placement) {
    floatingEl.style.setProperty('--et-floating-translate', `translate3d(${x}px, ${y}px, 0)`);
    floatingEl.setAttribute('et-floating-placement', placement);
  }

  private _applyArrowStyles(
    floatingEl: HTMLElement,
    middlewareData: MiddlewareData,
    floatingElArrow: HTMLElement | null,
  ) {
    if (!middlewareData.arrow || !floatingElArrow) return;

    const { x: arrowX, y: arrowY } = middlewareData.arrow;

    floatingEl.style.setProperty('--et-floating-arrow-translate', `translate3d(${arrowX ?? 0}px, ${arrowY ?? 0}px, 0)`);
  }

  private _handleReferenceHidden(floatingEl: HTMLElement, middlewareData: MiddlewareData) {
    if (middlewareData.hide?.referenceHidden) {
      if (this.autoCloseIfReferenceHidden()) {
        this.unmount();
      } else {
        floatingEl.classList.add('et-floating-element--hidden');
        this.isHidden.set(true);
      }
    } else if (this.autoHide()) {
      floatingEl.classList.remove('et-floating-element--hidden');
      this.isHidden.set(false);
    }
  }

  private _waitForRenderAndAnimate() {
    nextFrame(() => {
      if (!this.componentRef) return;

      const lifecycle = this.componentRef.instance._animatedLifecycle?.();

      if (!lifecycle) {
        console.error(
          'AnimatedOverlayDirective: The component does not have an AnimatedLifecycleDirective. Please add one to the component.',
        );
        return;
      }

      lifecycle.enter();

      lifecycle.state$
        .pipe(
          tap((s) => {
            if (s === 'entered') {
              this._afterOpened?.next();
            }
          }),
          take(1),
          takeUntil(this.destroy$),
        )
        .subscribe();

      this.state.set('mounted');
    });
  }

  _destroy() {
    this.zone.runOutsideAngular(() => {
      this.floatingElCleanupFn?.();
    });

    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }

    if (this.componentRef) {
      this.componentRef.destroy();
      this.componentRef = null;
    }

    this.state.set('unmounted');

    this._afterClosed?.next();
  }
}
