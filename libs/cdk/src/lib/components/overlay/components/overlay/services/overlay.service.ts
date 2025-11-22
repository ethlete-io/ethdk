import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType, NoopScrollStrategy } from '@angular/cdk/overlay';
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
import { outputToObservable } from '@angular/core/rxjs-interop';
import {
  BOUNDARY_ELEMENT_TOKEN,
  ProvideThemeDirective,
  THEME_PROVIDER,
  equal,
  injectBreakpointObserver,
  nextFrame,
} from '@ethlete/core';
import { filter, take } from 'rxjs';
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

  if (isTouchEvent(origin) || isPointerEvent(origin)) {
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

interface ViewportTransformData {
  viewportWidth: number;
  viewportHeight: number;
  rect: DOMRect;
  scaleUpX: number;
  scaleUpY: number;
  viewportCenterX: number;
  viewportCenterY: number;
  buttonCenterX: number;
  buttonCenterY: number;
  cloneTranslateX: number;
  cloneTranslateY: number;
  containerTranslateX: number;
  containerTranslateY: number;
  scaleX: number;
  scaleY: number;
}

const calculateViewportTransforms = (originElement: HTMLElement): ViewportTransformData => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rect = originElement.getBoundingClientRect();

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

  return {
    viewportWidth,
    viewportHeight,
    rect,
    scaleUpX,
    scaleUpY,
    viewportCenterX,
    viewportCenterY,
    buttonCenterX,
    buttonCenterY,
    cloneTranslateX,
    cloneTranslateY,
    containerTranslateX,
    containerTranslateY,
    scaleX,
    scaleY,
  };
};

const applyCloneElementStyles = (
  cloneEl: HTMLElement,
  rect: DOMRect,
  transforms: Pick<ViewportTransformData, 'cloneTranslateX' | 'cloneTranslateY' | 'scaleUpX' | 'scaleUpY'>,
) => {
  cloneEl.style.top = `${rect.top}px`;
  cloneEl.style.left = `${rect.left}px`;
  cloneEl.style.width = `${rect.width}px`;
  cloneEl.style.height = `${rect.height}px`;

  cloneEl.style.setProperty('--enter-from-translate-x', '0px');
  cloneEl.style.setProperty('--enter-from-translate-y', '0px');
  cloneEl.style.setProperty('--enter-from-scale-x', '1');
  cloneEl.style.setProperty('--enter-from-scale-y', '1');
  cloneEl.style.setProperty('--enter-to-translate-x', `${transforms.cloneTranslateX}px`);
  cloneEl.style.setProperty('--enter-to-translate-y', `${transforms.cloneTranslateY}px`);
  cloneEl.style.setProperty('--enter-to-scale-x', `${transforms.scaleUpX}`);
  cloneEl.style.setProperty('--enter-to-scale-y', `${transforms.scaleUpY}`);

  cloneEl.style.setProperty('--leave-from-translate-x', `${transforms.cloneTranslateX}px`);
  cloneEl.style.setProperty('--leave-from-translate-y', `${transforms.cloneTranslateY}px`);
  cloneEl.style.setProperty('--leave-from-scale-x', `${transforms.scaleUpX}`);
  cloneEl.style.setProperty('--leave-from-scale-y', `${transforms.scaleUpY}`);
  cloneEl.style.setProperty('--leave-to-translate-x', '0px');
  cloneEl.style.setProperty('--leave-to-translate-y', '0px');
  cloneEl.style.setProperty('--leave-to-scale-x', '1');
  cloneEl.style.setProperty('--leave-to-scale-y', '1');
};

const applyContainerElementStyles = (
  containerEl: HTMLElement,
  rect: DOMRect,
  transforms: Pick<ViewportTransformData, 'scaleX' | 'scaleY' | 'containerTranslateX' | 'containerTranslateY'>,
) => {
  containerEl.style.setProperty('--origin-width', `${rect.width}px`);
  containerEl.style.setProperty('--origin-height', `${rect.height}px`);
  containerEl.style.setProperty('--origin-scale-x', `${transforms.scaleX}`);
  containerEl.style.setProperty('--origin-scale-y', `${transforms.scaleY}`);
  containerEl.style.setProperty('--origin-translate-x', `${transforms.containerTranslateX}px`);
  containerEl.style.setProperty('--origin-translate-y', `${transforms.containerTranslateY}px`);
};

const updateCloneLeaveAnimationStyles = (
  cloneEl: HTMLElement,
  rect: DOMRect,
  transforms: Pick<ViewportTransformData, 'cloneTranslateX' | 'cloneTranslateY' | 'scaleUpX' | 'scaleUpY'>,
) => {
  cloneEl.style.top = `${rect.top}px`;
  cloneEl.style.left = `${rect.left}px`;
  cloneEl.style.width = `${rect.width}px`;
  cloneEl.style.height = `${rect.height}px`;

  cloneEl.style.setProperty('--leave-from-translate-x', `${transforms.cloneTranslateX}px`);
  cloneEl.style.setProperty('--leave-from-translate-y', `${transforms.cloneTranslateY}px`);
  cloneEl.style.setProperty('--leave-from-scale-x', `${transforms.scaleUpX}`);
  cloneEl.style.setProperty('--leave-from-scale-y', `${transforms.scaleUpY}`);
  cloneEl.style.setProperty('--leave-to-translate-x', '0px');
  cloneEl.style.setProperty('--leave-to-translate-y', '0px');
  cloneEl.style.setProperty('--leave-to-scale-x', '1');
  cloneEl.style.setProperty('--leave-to-scale-y', '1');
};

@Injectable({ providedIn: 'root' })
export class OverlayService {
  private defaultOptions = inject(OVERLAY_DEFAULT_OPTIONS, { optional: true });
  private dialog = inject(CdkDialog);
  private breakpointObserver = injectBreakpointObserver();
  private injector = inject(EnvironmentInjector);
  private document = inject(DOCUMENT);
  private appRef = inject(ApplicationRef);

  openOverlays = signal<OverlayRef[]>([]);
  hasOpenOverlays = computed(() => this.openOverlays().length > 0);
  positions = new OverlayPositionBuilder();

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
            { containerEl, overlayPaneEl, backdropEl, overlayWrapper },
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
    const containerInstance = overlayRef._containerInstance;

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

    this.handleTransformOrigin(origin, currConfig, isFullScreenDialog, containerEl, containerInstance, overlayRef);
    this.applySizingStyles(overlayPaneEl, currConfig, useDefaultAnimation, isHorizontalSheet, isVerticalSheet);
    this.applyClasses({ containerEl, overlayPaneEl, backdropEl, overlayWrapper }, prevConfig, currConfig);
    this.updatePosition(overlayRef, cdkRef, prevConfig, currConfig, origin);
    this.handleDragToDismiss(overlayRef, currConfig);
  }

  private handleTransformOrigin<T, R>(
    origin: HTMLElement | Event | undefined,
    currConfig: OverlayBreakpointConfig,
    isFullScreenDialog: boolean,
    containerEl: HTMLElement,
    containerInstance: OverlayContainerComponent,
    overlayRef: OverlayRef<T, R>,
  ) {
    if (origin && currConfig.applyTransformOrigin) {
      const originData = getOriginCoordinatesAndDimensions(origin);
      if (!originData) return;

      if (isFullScreenDialog) {
        this.setupFullscreenDialogAnimation(originData, containerEl, containerInstance, overlayRef);
      } else {
        setStyle(containerEl, 'transform-origin', `${originData.x}px ${originData.y}px`);
        outputToObservable(containerInstance.enterAnimationStart)
          .pipe(take(1))
          .subscribe(() => {
            containerInstance._animatedLifecycle.enter();
          });
      }
    } else {
      setStyle(containerEl, 'transform-origin', null);
      outputToObservable(containerInstance.enterAnimationStart)
        .pipe(take(1))
        .subscribe(() => {
          containerInstance._animatedLifecycle.enter();
        });
    }
  }

  private setupFullscreenDialogAnimation<T, R>(
    originData: NonNullable<ReturnType<typeof getOriginCoordinatesAndDimensions>>,
    containerEl: HTMLElement,
    containerInstance: OverlayContainerComponent,
    overlayRef: OverlayRef<T, R>,
  ) {
    const transforms = calculateViewportTransforms(originData.element);

    const cloneComponentRef = createComponent(OverlayOriginCloneComponent, {
      environmentInjector: this.injector,
    });

    const clonedContent = originData.element.cloneNode(true) as HTMLElement;
    const computedStyle = window.getComputedStyle(originData.element);

    clonedContent.style.margin = '0';
    clonedContent.style.position = 'relative';
    clonedContent.style.boxSizing = computedStyle.boxSizing;
    clonedContent.style.display = computedStyle.display;

    cloneComponentRef.location.nativeElement.appendChild(clonedContent);

    const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;

    applyCloneElementStyles(cloneEl, transforms.rect, transforms);
    applyContainerElementStyles(containerEl, transforms.rect, transforms);
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
        if (overlayRef._fullscreenCloneData) {
          overlayRef._fullscreenCloneData.isEnterStarted = true;
        }

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
        if (overlayRef._fullscreenCloneData) {
          overlayRef._fullscreenCloneData.isEnterComplete = true;
        }

        contentAttachedSub.unsubscribe();
        animationStateSub.unsubscribe();
      });

    overlayRef._fullscreenCloneData = {
      originData,
      scaleX: transforms.scaleX,
      scaleY: transforms.scaleY,
      translateX: transforms.containerTranslateX,
      translateY: transforms.containerTranslateY,
      cloneComponentRef,
      contentAttachedSub,
      animationStateSub,
      isEnterStarted: false,
      isEnterComplete: false,
    };
  }

  private applySizingStyles(
    overlayPaneEl: HTMLElement,
    currConfig: OverlayBreakpointConfig,
    useDefaultAnimation: boolean,
    isHorizontalSheet: boolean,
    isVerticalSheet: boolean,
  ) {
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
  }

  private applyClasses(
    elements: {
      containerEl: HTMLElement;
      overlayPaneEl: HTMLElement;
      backdropEl: HTMLElement | null;
      overlayWrapper: HTMLElement;
    },
    prevConfig: OverlayBreakpointConfig | undefined,
    currConfig: OverlayBreakpointConfig,
  ) {
    const { containerEl, overlayPaneEl, backdropEl, overlayWrapper } = elements;

    setClass(containerEl, prevConfig?.containerClass, currConfig.containerClass);
    setClass(overlayPaneEl, prevConfig?.paneClass, currConfig.paneClass);
    setClass(overlayWrapper, prevConfig?.overlayClass, currConfig.overlayClass);
    setClass(this.document.documentElement, prevConfig?.documentClass, currConfig.documentClass);
    setClass(this.document.body, prevConfig?.bodyClass, currConfig.bodyClass);

    if (backdropEl) {
      setClass(backdropEl, prevConfig?.backdropClass, currConfig.backdropClass);
    }
  }

  private updatePosition<T, R>(
    overlayRef: OverlayRef<T, R>,
    cdkRef: DialogRef<R, T>,
    prevConfig: OverlayBreakpointConfig | undefined,
    currConfig: OverlayBreakpointConfig,
    origin: HTMLElement | Event | undefined,
  ) {
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
  }

  private handleDragToDismiss<T, R>(overlayRef: OverlayRef<T, R>, currConfig: OverlayBreakpointConfig) {
    if (currConfig.dragToDismiss) {
      overlayRef._containerInstance._enableDragToDismiss(currConfig.dragToDismiss);
    } else {
      overlayRef._containerInstance._disableDragToDismiss();
    }
  }

  private registerOverlay<T, D, R>(overlayRef: OverlayRef<T, R>, config: OverlayConfig<D>) {
    this.openOverlays.update((overlays) => [...overlays, overlayRef]);

    this.setupBeforeClosedHandler(overlayRef, config);
    this.setupAfterClosedHandler(overlayRef);
  }

  private setupBeforeClosedHandler<T, D, R>(overlayRef: OverlayRef<T, R>, config: OverlayConfig<D>) {
    overlayRef.beforeClosed().subscribe(() => {
      if (overlayRef._fullscreenCloneData) {
        const {
          cloneComponentRef,
          contentAttachedSub,
          animationStateSub,
          isEnterStarted,
          isEnterComplete,
          originData,
        } = overlayRef._fullscreenCloneData;

        contentAttachedSub.unsubscribe();
        animationStateSub.unsubscribe();

        if (isEnterStarted && isEnterComplete) {
          this.prepareLeaveAnimation(overlayRef, cloneComponentRef, originData);
        }

        cloneComponentRef.instance.animatedLifecycle.leave();
      }

      this.removeClassesFromDocumentAndBody(config);
    });
  }

  private prepareLeaveAnimation<T, R>(
    overlayRef: OverlayRef<T, R>,
    cloneComponentRef: ComponentRef<OverlayOriginCloneComponent>,
    originData: NonNullable<ReturnType<typeof getOriginCoordinatesAndDimensions>>,
  ) {
    const transforms = calculateViewportTransforms(originData.element);

    const cloneEl = cloneComponentRef.location.nativeElement as HTMLElement;
    const containerEl = overlayRef._containerInstance.elementRef.nativeElement as HTMLElement;

    updateCloneLeaveAnimationStyles(cloneEl, transforms.rect, transforms);
    applyContainerElementStyles(containerEl, transforms.rect, transforms);

    const leaveSub = cloneComponentRef.instance.animatedLifecycle.state$
      .pipe(
        filter((state) => state === 'left'),
        take(1),
      )
      .subscribe();

    overlayRef._fullscreenCloneData!.leaveAnimationSub = leaveSub;
  }

  private setupAfterClosedHandler<T, R>(overlayRef: OverlayRef<T, R>) {
    overlayRef.afterClosed().subscribe(() => {
      if (overlayRef._fullscreenCloneData) {
        const { originData, cloneComponentRef, isEnterStarted, isEnterComplete, leaveAnimationSub } =
          overlayRef._fullscreenCloneData;

        leaveAnimationSub?.unsubscribe();

        const cleanup = () => {
          this.cleanupFullscreenAnimation(overlayRef, cloneComponentRef, originData);
        };

        if (isEnterStarted && isEnterComplete) {
          const sub = cloneComponentRef.instance.animatedLifecycle.state$
            .pipe(
              filter((state) => state === 'left'),
              take(1),
            )
            .subscribe(() => cleanup());

          if (overlayRef._fullscreenCloneData) {
            overlayRef._fullscreenCloneData.leaveAnimationSub = sub;
          }
        } else {
          cleanup();
        }
      }

      const index = this.openOverlays().indexOf(overlayRef);
      if (index !== -1) {
        this.openOverlays.update((overlays) => overlays.filter((_, i) => i !== index));
      }
    });
  }

  private cleanupFullscreenAnimation<T, R>(
    overlayRef: OverlayRef<T, R>,
    cloneComponentRef: ComponentRef<OverlayOriginCloneComponent>,
    originData: NonNullable<ReturnType<typeof getOriginCoordinatesAndDimensions>>,
  ) {
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

    overlayRef._fullscreenCloneData = undefined;
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
}
