import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import {
  ComponentRef,
  DestroyRef,
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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
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
import { Subject, Subscription, filter, take, tap } from 'rxjs';
import { injectBoundaryElement } from '../providers';
import { signalElementDimensions } from '../signals';
import { ProvideThemeDirective } from '../theming';
import { AnimatedLifecycleDirective } from './animated-lifecycle.directive';
import { nextFrame } from './animation-utils';

export interface AnimatedOverlayComponentBase {
  animatedLifecycle: Signal<AnimatedLifecycleDirective | undefined>;
  setThemeFromProvider: (provider: ProvideThemeDirective) => void;
}

export type AnimatedOverlayMountConfig<T> = {
  component: ComponentType<T>;
  providers?: StaticProvider[];
  data?: Partial<T>;
  themeProvider?: ProvideThemeDirective | null;
};

export type AnimatedOverlayState = 'init' | 'mounting' | 'mounted' | 'unmounting' | 'unmounted';

@Directive({
  selector: '[etAnimatedOverlay]',
  exportAs: 'etAnimatedOverlay',
  host: {
    class: 'et-animated-overlay',
  },
  standalone: true,
})
export class AnimatedOverlayDirective<T extends AnimatedOverlayComponentBase> {
  private overlayService = inject(Overlay);
  private injector = inject(Injector);
  private viewContainerRef = inject(ViewContainerRef);
  private zone = inject(NgZone);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private rootBoundary = injectBoundaryElement({ optional: true });
  private destroyRef = inject(DestroyRef);

  private floatingElCleanupFn: (() => void) | null = null;
  private unmountSubscription: Subscription | null = null;

  placement = input<Placement | undefined>('bottom');
  fallbackPlacements = input<Placement[]>();
  offset = input<OffsetOptions | null>(null);
  arrowPadding = input<Padding | null>(4);
  viewportPadding = input<Padding | null>(8);
  autoResize = input(false, { transform: booleanAttribute });
  shift = input(true, { transform: booleanAttribute });
  autoHide = input(false, { transform: booleanAttribute });
  autoCloseIfReferenceHidden = input(false, { transform: booleanAttribute });
  referenceElement = input(this.elementRef.nativeElement);
  mirrorWidth = input(false, { transform: booleanAttribute });

  portal: ComponentPortal<T> | null = null;
  overlayRef: OverlayRef | null = null;
  componentRef: ComponentRef<T> | null = null;

  beforeOpened$ = new Subject<void>();
  afterOpened$ = new Subject<void>();
  beforeClosed$ = new Subject<void>();
  afterClosed$ = new Subject<void>();

  state = signal<AnimatedOverlayState>('init');

  isMounted = computed(() => this.state() === 'mounted');
  isMounting = computed(() => this.state() === 'mounting');
  isUnmounted = computed(() => this.state() === 'unmounted');
  isUnmounting = computed(() => this.state() === 'unmounting');

  canMount = computed(() => !this.isMounted() && !this.isMounting());
  canUnmount = computed(() => (this.isMounted() || this.isMounting()) && !this.isUnmounting());

  isHidden = signal(false);

  isMounted$ = toObservable(this.isMounted);
  isMounting$ = toObservable(this.isMounting);
  isUnmounted$ = toObservable(this.isUnmounted);
  isUnmounting$ = toObservable(this.isUnmounting);

  canMount$ = toObservable(this.canMount);
  canUnmount$ = toObservable(this.canUnmount);

  isHidden$ = toObservable(this.isHidden);

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

    this.destroyRef.onDestroy(() => this.destroy());
  }

  mount(config: AnimatedOverlayMountConfig<T>): T | undefined {
    // If currently unmounting, cancel the unmount and reuse the existing instance
    if (this.isUnmounting()) {
      if (!this.componentRef) {
        if (isDevMode()) {
          console.warn('AnimatedOverlayDirective: Cannot remount. Component ref is not available.');
        }
        return;
      }

      // Cancel the unmount
      this.unmountSubscription?.unsubscribe();
      this.unmountSubscription = null;

      // Update component data if provided
      this.applyComponentData(config.data);
      this.applyThemeProvider(config.themeProvider);

      // Restart the enter animation
      const lifecycle = this.componentRef.instance.animatedLifecycle();
      if (lifecycle) {
        this.state.set('mounting');
        this.beforeOpened$.next();

        lifecycle.enter();

        lifecycle.state$
          .pipe(
            filter((s) => s === 'entered'),
            tap(() => {
              if (this.state() === 'mounting') {
                this.state.set('mounted');
                this.afterOpened$.next();
              }
            }),
            take(1),
            takeUntilDestroyed(this.destroyRef),
          )
          .subscribe();
      }

      return this.componentRef.instance;
    }

    if (!this.canMount()) {
      if (isDevMode()) {
        console.warn('AnimatedOverlayDirective: Cannot mount. Component is already mounted or currently mounting.');
      }
      return;
    }

    const { component, providers, data, themeProvider } = config;

    this.state.set('mounting');
    this.beforeOpened$.next();

    const injector = Injector.create({
      parent: this.injector,
      providers: providers ?? [],
    });

    this.overlayRef = this.overlayService.create();
    this.portal = new ComponentPortal(component, this.viewContainerRef, injector);
    this.componentRef = this.overlayRef.attach(this.portal);

    this.applyComponentData(data);
    this.applyThemeProvider(themeProvider);
    this.updateOverlaySize();
    this.setupFloatingUI();

    return this.componentRef.instance;
  }

  unmount() {
    if (!this.isMounted() && !this.isMounting() && !this.isUnmounting()) {
      if (isDevMode()) {
        console.warn(`AnimatedOverlayDirective: Cannot unmount. Component is currently ${this.state()}`);
      }
      return;
    }

    if (this.isUnmounting()) {
      return;
    }

    if (!this.componentRef) {
      if (isDevMode()) {
        console.warn('AnimatedOverlayDirective: Cannot unmount. Component ref is not available.');
      }
      return;
    }

    this.state.set('unmounting');
    this.beforeClosed$.next();

    if (this.isHidden()) {
      this.destroy();
      return;
    }

    const lifecycle = this.componentRef.instance.animatedLifecycle();

    if (!lifecycle) {
      this.destroy();
      return;
    }

    lifecycle.leave();
    this.unmountSubscription = lifecycle.state$
      .pipe(
        filter((s) => s === 'left'),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.unmountSubscription = null;
        this.destroy();
      });
  }

  private applyComponentData(data?: Partial<T>) {
    if (!this.componentRef || !data) return;

    Object.assign(this.componentRef.instance, data);
    this.componentRef.changeDetectorRef.markForCheck();
  }

  private applyThemeProvider(themeProvider?: ProvideThemeDirective | null) {
    if (!this.componentRef || !themeProvider) return;

    this.componentRef.instance.setThemeFromProvider(themeProvider);
  }

  private updateOverlaySize() {
    if (!this.overlayRef || !this.mirrorWidth()) return;

    this.overlayRef.updateSize({
      width: this.elementRef.nativeElement.offsetWidth,
    });
  }

  private setupFloatingUI() {
    this.zone.runOutsideAngular(() => {
      if (!this.componentRef) return;

      const floatingEl = this.componentRef.location.nativeElement as HTMLElement;
      const floatingElArrow = this.getFloatingArrow();

      floatingEl.classList.add('et-floating-element');

      const refEl = this.referenceElement();
      const boundary = this.rootBoundary?.value();

      this.floatingElCleanupFn = autoUpdate(refEl, floatingEl, () => {
        this.updateFloatingPosition(floatingEl, refEl, boundary, floatingElArrow);
      });

      this.waitForRenderAndAnimate();
    });
  }

  private getFloatingArrow(): HTMLElement | null {
    if (!this.componentRef) return null;

    return this.componentRef.location.nativeElement.querySelector('[et-floating-arrow]') as HTMLElement | null;
  }

  private updateFloatingPosition(
    floatingEl: HTMLElement,
    refEl: HTMLElement,
    boundary: HTMLElement | undefined,
    floatingElArrow: HTMLElement | null,
  ) {
    if (!this.componentRef) return;

    const middleware = this.buildFloatingMiddleware(floatingEl, boundary, floatingElArrow);

    computePosition(refEl, floatingEl, {
      placement: this.placement(),
      middleware,
    }).then(({ x, y, placement, middlewareData }) => {
      this.applyFloatingStyles(floatingEl, x, y, placement);
      this.applyArrowStyles(floatingEl, middlewareData, floatingElArrow);
      this.handleReferenceHidden(floatingEl, middlewareData);
    });
  }

  private buildFloatingMiddleware(
    floatingEl: HTMLElement,
    boundary: HTMLElement | undefined,
    floatingElArrow: HTMLElement | null,
  ) {
    const middleware = [];

    const offsetValue = this.offset();
    if (offsetValue !== null) {
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

  private applyFloatingStyles(floatingEl: HTMLElement, x: number, y: number, placement: Placement) {
    floatingEl.style.setProperty('--et-floating-translate', `translate3d(${x}px, ${y}px, 0)`);
    floatingEl.setAttribute('et-floating-placement', placement);
  }

  private applyArrowStyles(
    floatingEl: HTMLElement,
    middlewareData: MiddlewareData,
    floatingElArrow: HTMLElement | null,
  ) {
    if (!middlewareData.arrow || !floatingElArrow) return;

    const { x: arrowX, y: arrowY } = middlewareData.arrow;

    floatingEl.style.setProperty('--et-floating-arrow-translate', `translate3d(${arrowX ?? 0}px, ${arrowY ?? 0}px, 0)`);
  }

  private handleReferenceHidden(floatingEl: HTMLElement, middlewareData: MiddlewareData) {
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

  private waitForRenderAndAnimate() {
    nextFrame(() => {
      if (!this.componentRef || this.state() !== 'mounting') {
        return;
      }

      const lifecycle = this.componentRef.instance.animatedLifecycle?.();

      if (!lifecycle) {
        console.error(
          'AnimatedOverlayDirective: The component does not have an AnimatedLifecycleDirective. Please add one to the component.',
        );
        return;
      }

      lifecycle.enter();

      lifecycle.state$
        .pipe(
          filter((s) => s === 'entered'),
          tap(() => {
            if (this.state() === 'mounting') {
              this.state.set('mounted');
              this.afterOpened$.next();
            }
          }),
          take(1),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();
    });
  }

  private destroy() {
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
    this.afterClosed$.next();
  }
}
