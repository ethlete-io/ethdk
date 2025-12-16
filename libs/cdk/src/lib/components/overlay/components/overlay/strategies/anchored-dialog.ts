import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { createRootProvider, createStaticRootProvider, forceReflow, injectRenderer, nextFrame } from '@ethlete/core';
import { filter, take } from 'rxjs';
import {
  getOriginCoordinatesAndDimensions,
  mergeOverlayBreakpointConfigs,
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
} from './core';

export const [provideAnchoredDialogStrategyDefaults, injectAnchoredDialogStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      width: undefined,
      height: undefined,
      maxHeight: '80vh',
      maxWidth: '80vw',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--anchored-dialog',
      positionStrategy: (origin?: HTMLElement) => {
        if (!origin) return inject(Overlay).position().global().centerHorizontally().centerVertically();

        return inject(Overlay)
          .position()
          .flexibleConnectedTo(origin)
          .withPositions([
            {
              originX: 'end',
              originY: 'bottom',
              overlayX: 'end',
              overlayY: 'top',
            },
            {
              originX: 'end',
              originY: 'top',
              overlayX: 'end',
              overlayY: 'bottom',
            },
            {
              originX: 'start',
              originY: 'bottom',
              overlayX: 'start',
              overlayY: 'top',
            },
            {
              originX: 'start',
              originY: 'top',
              overlayX: 'start',
              overlayY: 'bottom',
            },
          ])
          .withFlexibleDimensions(true)
          .withPush(false);
      },
      applyTransformOrigin: true,
    },
    {
      name: 'Anchored Dialog Overlay Strategy Defaults',
    },
  );

export const [provideAnchoredDialogStrategy, injectAnchoredDialogStrategy] = createRootProvider(
  () => {
    const defaults = injectAnchoredDialogStrategyDefaults();
    const renderer = injectRenderer();

    const build = (config: Partial<OverlayBreakpointConfig> = {}): OverlayStrategy => {
      const cfg = mergeOverlayBreakpointConfigs(defaults, config);

      return {
        id: crypto.randomUUID(),
        config: cfg,

        onBeforeEnter: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (!context.origin || !cfg.applyTransformOrigin) {
            context.containerInstance.animatedLifecycle.enter();
            return;
          }

          const originData = getOriginCoordinatesAndDimensions(context.origin);
          if (!originData) {
            context.containerInstance.animatedLifecycle.enter();
            return;
          }

          const { containerEl, containerInstance } = context;

          const setPropsAndEnter = () => {
            const originRect = originData.element.getBoundingClientRect();
            const overlayRect = containerEl.getBoundingClientRect();

            const scaleX = originRect.width / overlayRect.width;
            const scaleY = originRect.height / overlayRect.height;

            const originCenterX = originRect.left + originRect.width / 2;
            const originCenterY = originRect.top + originRect.height / 2;

            const overlayCenterX = overlayRect.left + overlayRect.width / 2;
            const overlayCenterY = overlayRect.top + overlayRect.height / 2;

            const translateX = originCenterX - overlayCenterX;
            const translateY = originCenterY - overlayCenterY;

            renderer.setCssProperties(containerEl, {
              '--origin-scale-x': `${scaleX}`,
              '--origin-scale-y': `${scaleY}`,
              '--origin-translate-x': `${translateX}px`,
              '--origin-translate-y': `${translateY}px`,
            });

            renderer.setStyle(containerEl, { transformOrigin: 'center center' });

            forceReflow(containerEl);

            nextFrame(() => {
              containerInstance.animatedLifecycle.enter();
            });
          };

          if (containerInstance.isContentAttached$.value) {
            setPropsAndEnter();
          } else {
            const contentAttachedSub = containerInstance.isContentAttached$
              .pipe(
                filter((a) => a),
                take(1),
              )
              .subscribe(() => {
                setPropsAndEnter();
                contentAttachedSub.unsubscribe();
              });
          }
        },

        onSwitchedAwayFrom: <T, R>(context: OverlayStrategyContext<T, R>) => {
          const { containerEl } = context;

          renderer.setCssProperties(containerEl, {
            '--origin-scale-x': null,
            '--origin-scale-y': null,
            '--origin-translate-x': null,
            '--origin-translate-y': null,
          });

          renderer.setStyle(containerEl, { transformOrigin: null });
        },

        onBeforeLeave: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (!context.origin || !cfg.applyTransformOrigin) {
            context.containerInstance.animatedLifecycle.leave();
            return;
          }

          const originData = getOriginCoordinatesAndDimensions(context.origin);
          if (!originData) {
            context.containerInstance.animatedLifecycle.leave();
            return;
          }

          const { containerEl, containerInstance } = context;

          const originRect = originData.element.getBoundingClientRect();
          const overlayRect = containerEl.getBoundingClientRect();

          const scaleX = originRect.width / overlayRect.width;
          const scaleY = originRect.height / overlayRect.height;

          const originCenterX = originRect.left + originRect.width / 2;
          const originCenterY = originRect.top + originRect.height / 2;

          const overlayCenterX = overlayRect.left + overlayRect.width / 2;
          const overlayCenterY = overlayRect.top + overlayRect.height / 2;

          const translateX = originCenterX - overlayCenterX;
          const translateY = originCenterY - overlayCenterY;

          renderer.setCssProperties(containerEl, {
            '--origin-scale-x': `${scaleX}`,
            '--origin-scale-y': `${scaleY}`,
            '--origin-translate-x': `${translateX}px`,
            '--origin-translate-y': `${translateY}px`,
          });

          containerInstance.animatedLifecycle.leave();
        },
      };
    };

    return {
      build,
    };
  },
  {
    name: 'Anchored Dialog Overlay Strategy',
  },
);

export const anchoredDialogOverlayStrategy = (
  config: Partial<OverlayBreakpointConfig> = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectAnchoredDialogStrategy();

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
