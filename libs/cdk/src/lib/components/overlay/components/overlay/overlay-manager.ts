import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { Dialog as CdkDialog, DialogConfig as CdkDialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType, NoopScrollStrategy } from '@angular/cdk/overlay';
import {
  ComponentRef,
  DOCUMENT,
  EnvironmentInjector,
  InjectionToken,
  TemplateRef,
  computed,
  createEnvironmentInjector,
  effect,
  inject,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import {
  BOUNDARY_ELEMENT_TOKEN,
  ProvideThemeDirective,
  THEME_PROVIDER,
  createRootProvider,
  equal,
  injectBreakpointObserver,
  injectRenderer,
} from '@ethlete/core';
import { filter } from 'rxjs';
import { OverlayContainerComponent } from './common';
import { OverlayConfig } from './overlay-config';
import { OverlayRef } from './overlay-ref';
import { OverlayStrategy, OverlayStrategyContext, isHtmlElement } from './strategies/core';

const ID_PREFIX = 'et-overlay-';

let uniqueId = 0;

export const OVERLAY_DATA = new InjectionToken('OverlayData');
export const OVERLAY_CONFIG = new InjectionToken<OverlayConfig>('OverlayConfig');

const isValidOriginElement = (element: Element | null): element is HTMLElement => {
  if (!element) return false;
  if (!(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();
  return tagName !== 'html' && tagName !== 'body';
};

const resolveOrigin = (
  origin: HTMLElement | MouseEvent | TouchEvent | KeyboardEvent | PointerEvent | undefined,
  document: Document,
): HTMLElement | MouseEvent | TouchEvent | KeyboardEvent | PointerEvent | undefined => {
  if (origin) return origin;

  const activeElement = document.activeElement;
  return isValidOriginElement(activeElement) ? activeElement : undefined;
};

export const [provideOverlayManager, injectOverlayManager] = createRootProvider(
  () => {
    const dialog = inject(CdkDialog);
    const breakpointObserver = injectBreakpointObserver();
    const injector = inject(EnvironmentInjector);
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();

    const openOverlays = signal<OverlayRef[]>([]);
    const hasOpenOverlays = computed(() => openOverlays().length > 0);

    const overlayStrategies = new WeakMap<OverlayRef, OverlayStrategy>();
    const overlayInjectors = new WeakMap<OverlayRef, EnvironmentInjector>();

    const open = <T, D = unknown, R = unknown>(
      componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
      config: OverlayConfig<D>,
    ): OverlayRef<T, R> => {
      // Resolve origin before creating the overlay (capture focused element now)
      const resolvedOrigin = resolveOrigin(config.origin, document);

      const shallowConfigCopy: Partial<OverlayConfig<D>> = {
        role: 'dialog',
        hasBackdrop: true,
        disableClose: false,
        data: null,
        ariaDescribedBy: null,
        ariaLabelledBy: null,
        ariaLabel: null,
        ariaModal: true,
        customAnimated: false,
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        delayFocusTrap: false,
        closeOnNavigation: true,
        ...config,
        origin: resolvedOrigin,
      };
      shallowConfigCopy.id = shallowConfigCopy.id || `${ID_PREFIX}${uniqueId++}`;

      let overlayRef: OverlayRef<T, R>;

      const cdkRef = dialog.open<R, D, T>(componentOrTemplateRef, {
        ...shallowConfigCopy,
        scrollStrategy: new NoopScrollStrategy(),
        panelClass: 'et-overlay-pane',
        disableClose: true,
        closeOnDestroy: false,
        container: {
          type: OverlayContainerComponent,
          providers: () => [
            { provide: OVERLAY_CONFIG, useValue: shallowConfigCopy },
            { provide: CdkDialogConfig, useValue: shallowConfigCopy },
          ],
        },
        templateContext: () => ({ dialogRef: overlayRef }),
        providers: (ref, cdkConfig, overlayContainer) => {
          const container = overlayContainer as OverlayContainerComponent;
          overlayRef = new OverlayRef(ref, shallowConfigCopy as OverlayConfig<D>, container);

          return [
            { provide: OverlayContainerComponent, useValue: container },
            { provide: THEME_PROVIDER, useValue: container.themeProvider },
            { provide: ProvideThemeDirective, useValue: container.themeProvider },
            { provide: BOUNDARY_ELEMENT_TOKEN, useValue: container.rootBoundary },
            { provide: OVERLAY_DATA, useValue: cdkConfig.data },
            { provide: OverlayRef, useValue: overlayRef },
            ...(shallowConfigCopy.providers ?? []),
          ];
        },
      });

      // @ts-expect-error OverlayRef was initialized in providers above
      if (!overlayRef) throw new Error('OverlayRef was not initialized properly.');
      if (!cdkRef.componentRef) throw new Error('CDK DialogRef componentRef is undefined.');

      (overlayRef as { componentRef: ComponentRef<T> }).componentRef = cdkRef.componentRef;
      overlayRef.componentInstance = cdkRef.componentInstance;
      (cdkRef.containerInstance as OverlayContainerComponent).overlayRef = overlayRef;

      const childInjector = createEnvironmentInjector([], injector);
      overlayInjectors.set(overlayRef, childInjector);

      setupBreakpointEffects(overlayRef, shallowConfigCopy as OverlayConfig<D>, cdkRef, childInjector);
      setupEnterAnimationHandler(overlayRef, cdkRef.containerInstance as OverlayContainerComponent);
      registerOverlay(overlayRef);

      return overlayRef;
    };

    const setupEnterAnimationHandler = <T, R>(
      overlayRef: OverlayRef<T, R>,
      containerInstance: OverlayContainerComponent,
    ) => {
      const beforeEnterSub = containerInstance.isContentAttached$.pipe(filter((a) => a)).subscribe(() => {
        const strategy = overlayStrategies.get(overlayRef);

        if (strategy?.onBeforeEnter) {
          const context: OverlayStrategyContext<T, R> = {
            overlayRef,
            containerEl: containerInstance.elementRef.nativeElement as HTMLElement,
            containerInstance,
            config: strategy.config,
            origin: overlayRef.config.origin,
          };

          strategy.onBeforeEnter(context);
        }

        beforeEnterSub.unsubscribe();
      });

      const afterEnterSub = containerInstance.overlayRef?.afterOpened().subscribe(() => {
        const strategy = overlayStrategies.get(overlayRef);

        if (strategy?.onAfterEnter) {
          const context: OverlayStrategyContext<T, R> = {
            overlayRef,
            containerEl: containerInstance.elementRef.nativeElement as HTMLElement,
            containerInstance,
            config: strategy.config,
            origin: overlayRef.config.origin,
          };

          strategy.onAfterEnter(context);
        }

        afterEnterSub?.unsubscribe();
      });
    };

    const setupBreakpointEffects = <T, D, R>(
      overlayRef: OverlayRef<T, R>,
      config: OverlayConfig<D>,
      cdkRef: DialogRef<R, T>,
      childInjector: EnvironmentInjector,
    ) => {
      const containerEl = overlayRef._containerInstance.elementRef.nativeElement as HTMLElement;
      const overlayPaneEl = cdkRef.overlayRef.overlayElement;
      const backdropEl = cdkRef.overlayRef.backdropElement;
      const overlayWrapper = cdkRef.overlayRef.hostElement;

      const strategyBreakpoints = untracked(() =>
        runInInjectionContext(childInjector, () => config.strategies?.() ?? []),
      );

      const breakpointMatchResults = untracked(() =>
        runInInjectionContext(childInjector, () =>
          strategyBreakpoints.map((breakpointEntry) =>
            breakpointEntry.breakpoint
              ? {
                  isActive: breakpointObserver.observeBreakpoint({ min: breakpointEntry.breakpoint }),
                  strategy: breakpointEntry.strategy,
                  size:
                    typeof breakpointEntry.breakpoint === 'number'
                      ? breakpointEntry.breakpoint
                      : breakpointEntry.breakpoint === undefined
                        ? 0
                        : breakpointObserver.getBreakpointSize(breakpointEntry.breakpoint, 'min'),
                }
              : {
                  isActive: signal(true),
                  strategy: breakpointEntry.strategy,
                  size: 0,
                },
          ),
        ),
      );

      const getHighestMatchedStrategy = () => {
        const activeBreakpoints = breakpointMatchResults.filter((entry) => entry.isActive());
        return activeBreakpoints.reduce((prev, curr) => (prev.size > curr.size ? prev : curr)).strategy;
      };

      const initialStrategy = getHighestMatchedStrategy();
      overlayStrategies.set(overlayRef, initialStrategy);

      applyStrategy(
        initialStrategy,
        undefined,
        { containerEl, overlayPaneEl, backdropEl, overlayWrapper },
        config,
        cdkRef,
        overlayRef,
      );

      const highestMatchedStrategy = linkedSignal<
        OverlayStrategy,
        {
          currentStrategy: OverlayStrategy;
          previousStrategy: OverlayStrategy | undefined;
        }
      >({
        source: getHighestMatchedStrategy,
        computation: (source, prev) => ({
          currentStrategy: source,
          previousStrategy: prev?.source,
        }),
      });

      let isFirstRun = true;
      untracked(() =>
        effect(
          () => {
            const { currentStrategy, previousStrategy } = highestMatchedStrategy();

            if (isFirstRun) {
              isFirstRun = false;
              return;
            }

            untracked(() => {
              applyStrategy(
                currentStrategy,
                previousStrategy,
                { containerEl, overlayPaneEl, backdropEl, overlayWrapper },
                config,
                cdkRef,
                overlayRef,
              );
            });
          },
          { injector: childInjector },
        ),
      );
    };

    const applyStrategy = <T, D, R>(
      currStrategy: OverlayStrategy,
      prevStrategy: OverlayStrategy | undefined,
      elements: {
        containerEl: HTMLElement;
        overlayPaneEl: HTMLElement;
        backdropEl: HTMLElement | null;
        overlayWrapper: HTMLElement;
      },
      config: OverlayConfig<D>,
      cdkRef: DialogRef<R, T>,
      overlayRef: OverlayRef<T, R>,
    ) => {
      const { containerEl, overlayPaneEl, backdropEl, overlayWrapper } = elements;
      const containerInstance = overlayRef._containerInstance;
      const currConfig = currStrategy.config;
      const prevConfig = prevStrategy?.config;

      handleStrategyTransition(
        overlayRef,
        currStrategy,
        prevStrategy,
        containerEl,
        containerInstance,
        config.origin,
        prevConfig,
      );

      applySizingStyles(overlayPaneEl, currConfig);
      applyClasses({ containerEl, overlayPaneEl, backdropEl, overlayWrapper }, prevConfig, currConfig);
      updatePosition(overlayRef, cdkRef, prevConfig, currConfig, config.origin);
    };

    const handleStrategyTransition = <T, R>(
      overlayRef: OverlayRef<T, R>,
      currStrategy: OverlayStrategy,
      prevStrategy: OverlayStrategy | undefined,
      containerEl: HTMLElement,
      containerInstance: OverlayContainerComponent,
      origin?: HTMLElement | Event,
      prevConfig?: OverlayStrategy['config'],
    ) => {
      const currentTrackedStrategy = overlayStrategies.get(overlayRef);

      const strategyChanged = currentTrackedStrategy?.id !== currStrategy.id;

      const context: OverlayStrategyContext<T, R> = {
        overlayRef,
        containerEl,
        containerInstance,
        config: currStrategy.config,
        previousConfig: prevConfig,
        origin,
      };

      if (strategyChanged) {
        if (currentTrackedStrategy && prevStrategy) {
          prevStrategy.onSwitchedAwayFrom?.(context);
        }

        if (currentTrackedStrategy) {
          currStrategy.onSwitchedTo?.(context);
        }

        overlayStrategies.set(overlayRef, currStrategy);
      } else if (!currentTrackedStrategy) {
        overlayStrategies.set(overlayRef, currStrategy);
      }
    };

    const applySizingStyles = (overlayPaneEl: HTMLElement, config: OverlayStrategy['config']) => {
      renderer.setStyle(overlayPaneEl, {
        maxWidth: config.maxWidth ? coerceCssPixelValue(config.maxWidth) : null,
        maxHeight: config.maxHeight ? coerceCssPixelValue(config.maxHeight) : null,
        minWidth: config.minWidth ? coerceCssPixelValue(config.minWidth) : null,
        minHeight: config.minHeight ? coerceCssPixelValue(config.minHeight) : null,
        width: config.width ? coerceCssPixelValue(config.width) : null,
        height: config.height ? coerceCssPixelValue(config.height) : null,
      });
    };

    const applyClasses = (
      elements: {
        containerEl: HTMLElement;
        overlayPaneEl: HTMLElement;
        backdropEl: HTMLElement | null;
        overlayWrapper: HTMLElement;
      },
      prevConfig: OverlayStrategy['config'] | undefined,
      currConfig: OverlayStrategy['config'],
    ) => {
      const { containerEl, overlayPaneEl, backdropEl, overlayWrapper } = elements;

      const applyClassChange = (el: HTMLElement, prev?: string | string[], curr?: string | string[]) => {
        if (equal(prev, curr)) return;

        if (prev) {
          renderer.removeClass(el, ...(Array.isArray(prev) ? prev : [prev]));
        }

        if (curr) {
          renderer.addClass(el, ...(Array.isArray(curr) ? curr : [curr]));
        }
      };

      applyClassChange(containerEl, prevConfig?.containerClass, currConfig.containerClass);
      applyClassChange(overlayPaneEl, prevConfig?.paneClass, currConfig.paneClass);
      applyClassChange(overlayWrapper, prevConfig?.overlayClass, currConfig.overlayClass);
      applyClassChange(document.documentElement, prevConfig?.documentClass, currConfig.documentClass);
      applyClassChange(document.body, prevConfig?.bodyClass, currConfig.bodyClass);

      if (backdropEl) {
        applyClassChange(backdropEl, prevConfig?.backdropClass, currConfig.backdropClass);
      }
    };

    const updatePosition = <T, R>(
      overlayRef: OverlayRef<T, R>,
      cdkRef: DialogRef<R, T>,
      prevConfig: OverlayStrategy['config'] | undefined,
      currConfig: OverlayStrategy['config'],
      origin: HTMLElement | Event | undefined,
    ) => {
      if (!equal(prevConfig?.position, currConfig.position)) {
        overlayRef.updatePosition(currConfig.position);
      }

      const positionStrategy = currConfig.positionStrategy;

      if (positionStrategy) {
        const childInjector = overlayInjectors.get(overlayRef);
        if (!childInjector) {
          throw new Error('Child injector not found for overlay');
        }

        const strategy = runInInjectionContext(childInjector, () =>
          positionStrategy(isHtmlElement(origin) ? origin : (origin?.target as HTMLElement | undefined)),
        );

        cdkRef.overlayRef.updatePositionStrategy(strategy);
      } else {
        cdkRef.overlayRef.updatePosition();
      }
    };

    const registerOverlay = <T, R>(overlayRef: OverlayRef<T, R>) => {
      openOverlays.update((overlays) => [...overlays, overlayRef]);

      setupBeforeClosedHandler(overlayRef);
      setupAfterClosedHandler(overlayRef);
    };

    const setupBeforeClosedHandler = <T, R>(overlayRef: OverlayRef<T, R>) => {
      overlayRef.beforeClosed().subscribe(() => {
        const strategy = overlayStrategies.get(overlayRef);

        if (strategy?.onBeforeLeave) {
          const context: OverlayStrategyContext<T, R> = {
            overlayRef,
            containerEl: overlayRef._containerInstance.elementRef.nativeElement as HTMLElement,
            containerInstance: overlayRef._containerInstance,
            config: strategy.config,
            origin: overlayRef.config.origin,
          };

          strategy.onBeforeLeave(context);
        }
      });
    };

    const setupAfterClosedHandler = <T, R>(overlayRef: OverlayRef<T, R>) => {
      overlayRef.afterClosed().subscribe(() => {
        const strategy = overlayStrategies.get(overlayRef);

        if (strategy?.onAfterLeave) {
          const context: OverlayStrategyContext<T, R> = {
            overlayRef,
            containerEl: overlayRef._containerInstance.elementRef.nativeElement as HTMLElement,
            containerInstance: overlayRef._containerInstance,
            config: strategy.config,
            origin: overlayRef.config.origin,
          };

          strategy.onAfterLeave(context);
        }

        if (strategy) {
          removeClassesFromDocumentAndBody(strategy.config);
        }

        overlayStrategies.delete(overlayRef);

        const childInjector = overlayInjectors.get(overlayRef);
        if (childInjector) {
          childInjector.destroy();
          overlayInjectors.delete(overlayRef);
        }

        const index = openOverlays().indexOf(overlayRef);
        if (index !== -1) {
          openOverlays.update((overlays) => overlays.filter((_, i) => i !== index));
        }
      });
    };

    const removeClassesFromDocumentAndBody = (strategyConfig: OverlayStrategy['config']) => {
      const documentClasses = strategyConfig.documentClass;
      const bodyClasses = strategyConfig.bodyClass;

      if (documentClasses) {
        if (Array.isArray(documentClasses)) {
          renderer.removeClass(document.documentElement, ...documentClasses);
        } else {
          renderer.removeClass(document.documentElement, documentClasses);
        }
      }

      if (bodyClasses) {
        if (Array.isArray(bodyClasses)) {
          renderer.removeClass(document.body, ...bodyClasses);
        } else {
          renderer.removeClass(document.body, bodyClasses);
        }
      }
    };

    const closeAll = () => {
      closeOverlays(openOverlays());
    };

    const getOverlayById = (id: string) => {
      return openOverlays().find((overlay) => overlay.id === id) ?? null;
    };

    const closeOverlays = (overlays: OverlayRef[]) => {
      let i = overlays.length;
      while (i--) {
        overlays[i]?.close();
      }
    };

    return {
      open,
      closeAll,
      getOverlayById,
      openOverlays: openOverlays.asReadonly(),
      hasOpenOverlays,
    };
  },
  {
    name: 'Overlay Manager',
  },
);
