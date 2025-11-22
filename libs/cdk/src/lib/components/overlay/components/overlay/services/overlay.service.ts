import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType, NoopScrollStrategy, ViewportRuler } from '@angular/cdk/overlay';
import {
  ApplicationRef,
  ComponentRef,
  DOCUMENT,
  EnvironmentInjector,
  Injectable,
  TemplateRef,
  computed,
  createComponent,
  createEnvironmentInjector,
  effect,
  inject,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { outputToObservable, toObservable } from '@angular/core/rxjs-interop';
import {
  BOUNDARY_ELEMENT_TOKEN,
  ProvideThemeDirective,
  THEME_PROVIDER,
  elementCanScroll,
  equal,
  injectBreakpointObserver,
  injectRoute,
  nextFrame,
} from '@ethlete/core';
import { filter, fromEvent, map, of, startWith, switchMap, take, tap } from 'rxjs';
import { OverlayContainerComponent } from '../components/overlay-container';
import { OVERLAY_CONFIG, OVERLAY_DATA, OVERLAY_DEFAULT_OPTIONS } from '../constants';
import { OverlayOriginCloneComponent } from '../origin-clone.component';
import { OverlayBreakpointConfig, OverlayConfig } from '../types';
import {
  ET_OVERLAY_BOTTOM_SHEET_CLASS,
  ET_OVERLAY_FULL_SCREEN_DIALOG_CLASS,
  ET_OVERLAY_LEFT_SHEET_CLASS,
  ET_OVERLAY_RIGHT_SHEET_CLASS,
  ET_OVERLAY_TOP_SHEET_CLASS,
  OverlayPositionBuilder,
  OverlayRef,
  createOverlayConfig,
} from '../utils';

const BLOCK_CLASS = 'cdk-global-scrollblock';
const OVERSCROLL_CLASS = 'et-global-no-overscroll';
const ID_PREFIX = 'et-overlay-';

let uniqueId = 0;

const setStyle = (el: HTMLElement, style: string, value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    el.style.removeProperty(style);
  } else {
    el.style.setProperty(style, coerceCssPixelValue(value));
  }
};

const setClass = (el: HTMLElement, prevClass?: string | string[], currClass?: string | string[]) => {
  if (equal(prevClass, currClass)) return;

  if (prevClass) {
    el.classList.remove(...(Array.isArray(prevClass) ? prevClass : [prevClass]));
  }

  if (currClass) {
    el.classList.add(...(Array.isArray(currClass) ? currClass : [currClass]));
  }
};

const isHtmlElement = (element: unknown): element is HTMLElement => element instanceof HTMLElement;

const isTouchEvent = (event: Event): event is TouchEvent => event.type[0] === 't';

const isPointerEvent = (event: Event): event is PointerEvent => event.type[0] === 'c';

const getOriginCoordinatesAndDimensions = (origin: HTMLElement | Event | undefined) => {
  if (!origin) return null;

  if (isHtmlElement(origin)) {
    const rect = origin.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      element: origin,
    };
  }

  if (isTouchEvent(origin)) {
    const touch = origin.targetTouches[0];
    if (!touch) return null;

    const target = origin.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      element: target,
    };
  }

  if (isPointerEvent(origin)) {
    const target = origin.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      element: target,
    };
  }

  return null;
};

@Injectable({ providedIn: 'root' })
export class OverlayService {
  private defaultOptions = inject(OVERLAY_DEFAULT_OPTIONS, { optional: true });
  private dialog = inject(CdkDialog);
  private breakpointObserver = injectBreakpointObserver();
  private viewportRuler = inject(ViewportRuler);
  private injector = inject(EnvironmentInjector);
  private route = injectRoute();
  private document = inject(DOCUMENT);
  private appRef = inject(ApplicationRef);

  openOverlays = signal<OverlayRef[]>([]);
  hasOpenOverlays = computed(() => this.openOverlays().length > 0);
  positions = new OverlayPositionBuilder();

  constructor() {
    this.setupScrollBlocking();
  }

  open<T, D = unknown, R = unknown>(component: ComponentType<T>, config: OverlayConfig<D>): OverlayRef<T, R>;
  open<T, D = unknown, R = unknown>(template: TemplateRef<T>, config: OverlayConfig<D>): OverlayRef<T, R>;
  open<T, D = unknown, R = unknown>(
    template: ComponentType<T> | TemplateRef<T>,
    config: OverlayConfig<D>,
  ): OverlayRef<T, R>;
  open<T, D = unknown, R = unknown>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config: OverlayConfig<D>,
  ): OverlayRef<T, R> {
    const composedConfig = createOverlayConfig<D>(this.defaultOptions as OverlayConfig<D>, config);
    composedConfig.id = composedConfig.id || `${ID_PREFIX}${uniqueId++}`;

    let overlayRef: OverlayRef<T, R>;

    const cdkRef = this.dialog.open<R, D, T>(componentOrTemplateRef, {
      ...composedConfig,
      scrollStrategy: new NoopScrollStrategy(),
      disableClose: true,
      closeOnDestroy: false,
      panelClass: 'et-overlay-pane',
      container: {
        type: OverlayContainerComponent,
        providers: () => [
          { provide: OVERLAY_CONFIG, useValue: composedConfig },
          { provide: CdkDialogConfig, useValue: composedConfig },
        ],
      },
      templateContext: () => ({ dialogRef: overlayRef }),
      providers: (ref, cdkConfig, overlayContainer) => {
        const container = overlayContainer as OverlayContainerComponent;
        overlayRef = new OverlayRef(ref, composedConfig, container);

        return [
          { provide: OverlayContainerComponent, useValue: container },
          { provide: THEME_PROVIDER, useValue: container._themeProvider },
          { provide: ProvideThemeDirective, useValue: container._themeProvider },
          { provide: BOUNDARY_ELEMENT_TOKEN, useValue: container._rootBoundary },
          { provide: OVERLAY_DATA, useValue: cdkConfig.data },
          { provide: OverlayRef, useValue: overlayRef },
          ...(composedConfig.providers ?? []),
        ];
      },
    });

    // @ts-expect-error OverlayRef was initialized in providers above. This will never be undefined here.
    if (!overlayRef) throw new Error('OverlayRef was not initialized properly.');
    if (!cdkRef.componentRef) throw new Error('CDK DialogRef componentRef is undefined.');

    (overlayRef as { componentRef: ComponentRef<T> }).componentRef = cdkRef.componentRef;
    overlayRef.componentInstance = cdkRef.componentInstance;
    (cdkRef.containerInstance as OverlayContainerComponent).overlayRef = overlayRef;

    const injector = createEnvironmentInjector([], this.injector);

    this.setupBreakpointEffects(overlayRef, composedConfig, cdkRef, injector);
    this.registerOverlay(overlayRef, composedConfig);

    return overlayRef;
  }

  closeAll() {
    this.closeOverlays(this.openOverlays());
  }

  getOverlayById(id: string) {
    return this.openOverlays().find((overlay) => overlay.id === id) ?? null;
  }

  private setupBreakpointEffects<T, D, R>(
    overlayRef: OverlayRef<T, R>,
    config: OverlayConfig<D>,
    cdkRef: DialogRef<R, T>,
    injector: EnvironmentInjector,
  ) {
    const containerEl = overlayRef._containerInstance.elementRef.nativeElement as HTMLElement;
    const overlayPaneEl = cdkRef.overlayRef.overlayElement;
    const backdropEl = cdkRef.overlayRef.backdropElement;
    const overlayWrapper = cdkRef.overlayRef.hostElement;

    const breakpointMatchResults = runInInjectionContext(injector, () =>
      config.positions.map((breakpoint) =>
        breakpoint.breakpoint
          ? {
              isActive: this.breakpointObserver.observeBreakpoint({ min: breakpoint.breakpoint }),
              config: breakpoint.config,
              size:
                typeof breakpoint.breakpoint === 'number'
                  ? breakpoint.breakpoint
                  : breakpoint.breakpoint === undefined
                    ? 0
                    : this.breakpointObserver.getBreakpointSize(breakpoint.breakpoint, 'min'),
            }
          : {
              isActive: signal(true),
              config: breakpoint.config,
              size: 0,
            },
      ),
    );

    const highestMatchedBreakpointConfig = linkedSignal<
      OverlayBreakpointConfig,
      { currentConfig: OverlayBreakpointConfig; previousConfig: OverlayBreakpointConfig | undefined }
    >({
      source: () => {
        const activeBreakpoints = breakpointMatchResults.filter((entry) => entry.isActive());
        return activeBreakpoints.reduce((prev, curr) => (prev.size > curr.size ? prev : curr)).config;
      },
      computation: (source, prev) => ({
        currentConfig: source,
        previousConfig: prev?.source,
      }),
    });

    effect(
      () => {
        const { currentConfig, previousConfig } = highestMatchedBreakpointConfig();

        untracked(() => {
          this.applyBreakpointConfig(
            currentConfig,
            previousConfig,
            {
              containerEl,
              overlayPaneEl,
              backdropEl,
              overlayWrapper,
            },
            config,
            cdkRef,
            overlayRef,
          );
        });
      },
      { injector },
    );
  }

  private applyBreakpointConfig<T, D, R>(
    currConfig: OverlayBreakpointConfig,
    prevConfig: OverlayBreakpointConfig | undefined,
    elements: {
      containerEl: HTMLElement;
      overlayPaneEl: HTMLElement;
      backdropEl: HTMLElement | null;
      overlayWrapper: HTMLElement;
    },
    config: OverlayConfig<D>,
    cdkRef: DialogRef<R, T>,
    overlayRef: OverlayRef<T, R>,
  ) {
    const { containerEl, overlayPaneEl, backdropEl, overlayWrapper } = elements;
    const origin = config.origin;
    const useDefaultAnimation = config.customAnimated !== true;
    const containerInstance = cdkRef.containerInstance as OverlayContainerComponent;

    const classes = Array.isArray(currConfig.containerClass)
      ? currConfig.containerClass
      : currConfig.containerClass
        ? [currConfig.containerClass]
        : [];

    const isFullScreenDialog = classes.includes(ET_OVERLAY_FULL_SCREEN_DIALOG_CLASS);
    const isHorizontalSheet = classes.some(
      (c) => c === ET_OVERLAY_LEFT_SHEET_CLASS || c === ET_OVERLAY_RIGHT_SHEET_CLASS,
    );
    const isVerticalSheet = classes.some(
      (c) => c === ET_OVERLAY_TOP_SHEET_CLASS || c === ET_OVERLAY_BOTTOM_SHEET_CLASS,
    );

    if (origin && currConfig.applyTransformOrigin) {
      const originData = getOriginCoordinatesAndDimensions(origin);
      if (originData) {
        if (isFullScreenDialog) {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const rect = originData.element.getBoundingClientRect();

          const scaleUpX = viewportWidth / rect.width;
          const scaleUpY = viewportHeight / rect.height;

          const viewportCenterX = viewportWidth / 2;
          const viewportCenterY = viewportHeight / 2;

          const buttonCenterX = rect.left + rect.width / 2;
          const buttonCenterY = rect.top + rect.height / 2;

          const cloneTranslateX = viewportCenterX - buttonCenterX;
          const cloneTranslateY = viewportCenterY - buttonCenterY;

          const containerTranslateX = buttonCenterX - viewportCenterX;
          const containerTranslateY = buttonCenterY - viewportCenterY;

          const scaleX = rect.width / viewportWidth;
          const scaleY = rect.height / viewportHeight;

          const cloneComponentRef = createComponent(OverlayOriginCloneComponent, {
            environmentInjector: this.injector,
          });

          const clonedContent = originData.element.cloneNode(true) as HTMLElement;

          const computedStyle = window.getComputedStyle(originData.element);

          clonedContent.style.margin = '0';
          clonedContent.style.position = 'relative';

          clonedContent.style.boxSizing = computedStyle.boxSizing;
          clonedContent.style.display = computedStyle.display;

          clonedContent.style.boxSizing = computedStyle.boxSizing;
          clonedContent.style.display = computedStyle.display;

          cloneComponentRef.location.nativeElement.appendChild(clonedContent);

          const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

          cloneEl.style.top = `${rect.top}px`;
          cloneEl.style.left = `${rect.left}px`;
          cloneEl.style.width = `${rect.width}px`;
          cloneEl.style.height = `${rect.height}px`;

          cloneEl.style.setProperty('--enter-from-translate-x', '0px');
          cloneEl.style.setProperty('--enter-from-translate-y', '0px');
          cloneEl.style.setProperty('--enter-from-scale-x', '1');
          cloneEl.style.setProperty('--enter-from-scale-y', '1');
          cloneEl.style.setProperty('--enter-to-translate-x', `${cloneTranslateX}px`);
          cloneEl.style.setProperty('--enter-to-translate-y', `${cloneTranslateY}px`);
          cloneEl.style.setProperty('--enter-to-scale-x', `${scaleUpX}`);
          cloneEl.style.setProperty('--enter-to-scale-y', `${scaleUpY}`);

          cloneEl.style.setProperty('--leave-from-translate-x', `${cloneTranslateX}px`);
          cloneEl.style.setProperty('--leave-from-translate-y', `${cloneTranslateY}px`);
          cloneEl.style.setProperty('--leave-from-scale-x', `${scaleUpX}`);
          cloneEl.style.setProperty('--leave-from-scale-y', `${scaleUpY}`);
          cloneEl.style.setProperty('--leave-to-translate-x', '0px');
          cloneEl.style.setProperty('--leave-to-translate-y', '0px');
          cloneEl.style.setProperty('--leave-to-scale-x', '1');
          cloneEl.style.setProperty('--leave-to-scale-y', '1');

          containerEl.style.setProperty('--origin-width', `${rect.width}px`);
          containerEl.style.setProperty('--origin-height', `${rect.height}px`);
          containerEl.style.setProperty('--origin-scale-x', `${scaleX}`);
          containerEl.style.setProperty('--origin-scale-y', `${scaleY}`);
          containerEl.style.setProperty('--origin-translate-x', `${containerTranslateX}px`);
          containerEl.style.setProperty('--origin-translate-y', `${containerTranslateY}px`);

          setStyle(containerEl, 'transform-origin', 'center center');

          this.appRef.attachView(cloneComponentRef.hostView);
          this.document.body.appendChild(cloneEl);

          nextFrame(() => {
            const originalOpacity = originData.element.style.opacity;
            const originalTransition = originData.element.style.transition;

            if (!overlayRef._originElementStyles) {
              overlayRef._originElementStyles = { originalOpacity, originalTransition };
            }
          });

          const contentAttachedSub = outputToObservable(containerInstance.enterAnimationStart)
            .pipe(take(1))
            .subscribe(() => {
              cloneComponentRef.instance.animatedLifecycle.enter();
              containerInstance._animatedLifecycle.enter();

              nextFrame(() => {
                originData.element.style.transition = 'none';
                originData.element.style.opacity = '0';
              });
            });

          const animationStateSub = cloneComponentRef.instance.animatedLifecycle.state$
            .pipe(
              filter((state) => state === 'entered'),
              take(1),
            )
            .subscribe(() => {
              contentAttachedSub.unsubscribe();
              animationStateSub.unsubscribe();
            });

          overlayRef._fullscreenCloneData = {
            originData,
            scaleX,
            scaleY,
            translateX: containerTranslateX,
            translateY: containerTranslateY,
            cloneComponentRef,
            subscriptions: [contentAttachedSub, animationStateSub],
          };
        } else {
          setStyle(containerEl, 'transform-origin', `${originData.x}px ${originData.y}px`);

          outputToObservable(containerInstance.enterAnimationStart)
            .pipe(take(1))
            .subscribe(() => {
              containerInstance._animatedLifecycle.enter();
            });
        }
      }
    } else {
      setStyle(containerEl, 'transform-origin', null);

      outputToObservable(containerInstance.enterAnimationStart)
        .pipe(take(1))
        .subscribe(() => {
          containerInstance._animatedLifecycle.enter();
        });
    }

    if (useDefaultAnimation && currConfig.containerClass) {
      if (isHorizontalSheet) {
        setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
        setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);
      } else if (isVerticalSheet) {
        setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);
        setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
      } else {
        setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
        setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);
      }
    } else {
      setStyle(overlayPaneEl, 'max-width', currConfig.maxWidth);
      setStyle(overlayPaneEl, 'max-height', currConfig.maxHeight);
    }

    setStyle(overlayPaneEl, 'min-width', currConfig.minWidth);
    setStyle(overlayPaneEl, 'min-height', currConfig.minHeight);
    setStyle(overlayPaneEl, 'width', currConfig.width);
    setStyle(overlayPaneEl, 'height', currConfig.height);

    setClass(containerEl, prevConfig?.containerClass, currConfig.containerClass);
    setClass(overlayPaneEl, prevConfig?.paneClass, currConfig.paneClass);
    setClass(overlayWrapper, prevConfig?.overlayClass, currConfig.overlayClass);
    setClass(this.document.documentElement, prevConfig?.documentClass, currConfig.documentClass);
    setClass(this.document.body, prevConfig?.bodyClass, currConfig.bodyClass);

    if (backdropEl) {
      setClass(backdropEl, prevConfig?.backdropClass, currConfig.backdropClass);
    }

    if (!equal(prevConfig?.position, currConfig.position)) {
      overlayRef.updatePosition(currConfig.position);
    }

    if (currConfig.positionStrategy) {
      cdkRef.overlayRef.updatePositionStrategy(
        currConfig.positionStrategy(isHtmlElement(origin) ? origin : (origin?.target as HTMLElement | undefined)),
      );
    } else {
      cdkRef.overlayRef.updatePosition();
    }

    if (currConfig.dragToDismiss) {
      overlayRef._containerInstance._enableDragToDismiss(currConfig.dragToDismiss);
    } else {
      overlayRef._containerInstance._disableDragToDismiss();
    }
  }

  private registerOverlay<T, D, R>(overlayRef: OverlayRef<T, R>, config: OverlayConfig<D>) {
    this.openOverlays.update((overlays) => [...overlays, overlayRef]);

    overlayRef.beforeClosed().subscribe(() => {
      if (overlayRef._fullscreenCloneData) {
        const { cloneComponentRef, subscriptions } = overlayRef._fullscreenCloneData;

        subscriptions.forEach((sub) => sub.unsubscribe());
        cloneComponentRef.instance.animatedLifecycle.leave();
      }

      this.removeClassesFromDocumentAndBody(config);
    });

    overlayRef.afterClosed().subscribe(() => {
      if (overlayRef._fullscreenCloneData) {
        const { originData, cloneComponentRef } = overlayRef._fullscreenCloneData;

        const leaveSub = cloneComponentRef.instance.animatedLifecycle.state$
          .pipe(
            filter((state) => state === 'left'),
            take(1),
          )
          .subscribe(() => {
            this.appRef.detachView(cloneComponentRef.hostView);
            cloneComponentRef.destroy();

            if (overlayRef._originElementStyles) {
              originData.element.style.transition = 'none';
              originData.element.style.opacity = overlayRef._originElementStyles.originalOpacity;

              // eslint-disable-next-line @typescript-eslint/no-unused-expressions
              originData.element.offsetHeight;

              nextFrame(() => {
                if (overlayRef._originElementStyles) {
                  originData.element.style.transition = overlayRef._originElementStyles.originalTransition;
                }
              });
            }

            leaveSub.unsubscribe();
          });
      }

      const index = this.openOverlays().indexOf(overlayRef);
      if (index !== -1) {
        this.openOverlays.update((overlays) => overlays.filter((_, i) => i !== index));
      }
    });
  }

  private removeClassesFromDocumentAndBody<D>(config: OverlayConfig<D>) {
    const documentClasses = config.positions.flatMap((p) => p.config.documentClass).filter(Boolean);
    const bodyClasses = config.positions.flatMap((p) => p.config.bodyClass).filter(Boolean);

    for (const klass of documentClasses) {
      if (Array.isArray(klass)) {
        this.document.documentElement.classList.remove(...klass);
      } else {
        this.document.documentElement.classList.remove(klass as string);
      }
    }

    for (const klass of bodyClasses) {
      if (Array.isArray(klass)) {
        this.document.body.classList.remove(...klass);
      } else {
        this.document.body.classList.remove(klass as string);
      }
    }
  }

  private closeOverlays(overlays: OverlayRef[]) {
    let i = overlays.length;
    while (i--) {
      overlays[i]?.close();
    }
  }

  private setupScrollBlocking() {
    const root = this.document.documentElement;
    const previousHTMLStyles = { top: '', left: '' };
    let previousScrollPosition = { top: 0, left: 0 };
    let isEnabled = false;
    let lastRoute: string | null = null;

    toObservable(this.hasOpenOverlays)
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

            previousScrollPosition = this.viewportRuler.getViewportScrollPosition();
            previousHTMLStyles.left = root.style.left || '';
            previousHTMLStyles.top = root.style.top || '';

            root.style.left = coerceCssPixelValue(-previousScrollPosition.left);
            root.style.top = coerceCssPixelValue(-previousScrollPosition.top);
            root.classList.add(BLOCK_CLASS, OVERSCROLL_CLASS);

            isEnabled = true;
            lastRoute = this.route();
          } else if (!hasOpenOverlays && isEnabled) {
            const htmlStyle = root.style;
            const bodyStyle = this.document.body.style;
            const previousHtmlScrollBehavior = htmlStyle.scrollBehavior || '';
            const previousBodyScrollBehavior = bodyStyle.scrollBehavior || '';
            const didNavigate = lastRoute !== this.route();

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
  }
}
