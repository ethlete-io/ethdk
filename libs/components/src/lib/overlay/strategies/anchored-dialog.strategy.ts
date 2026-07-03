import { createRootProvider, createStaticRootProvider, forceReflow, injectRenderer, nextFrame } from '@ethlete/core';
import { AnchoredPositionOptions, buildAnchoredRuntimePositionStrategy } from './anchored.strategy';
import { getOriginCoordinatesAndDimensions } from './overlay-origin';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import {
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
} from './overlay-strategy.types';

const DEFAULT_ANCHORED_DIALOG_POSITION: AnchoredPositionOptions = {
  placement: 'bottom-end',
  fallbackPlacements: ['top-end', 'bottom-start', 'top-start'],
  offset: 10,
  arrowPadding: 16,
  shift: true,
};

export type AnchoredDialogOverlayStrategyOptions = Partial<OverlayBreakpointConfig> & AnchoredPositionOptions;

export const [provideAnchoredDialogStrategyDefaults, injectAnchoredDialogStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      maxHeight: '80vh',
      maxWidth: '80vw',
      containerClass: 'et-overlay--anchored-dialog',
      positionStrategy: buildAnchoredRuntimePositionStrategy(DEFAULT_ANCHORED_DIALOG_POSITION),
      applyTransformOrigin: true,
      arrow: true,
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

      const applyOriginTransformProperties = (context: OverlayStrategyContext, originElement: HTMLElement) => {
        const { containerEl } = context;
        const originRect = originElement.getBoundingClientRect();
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
      };

      return {
        id: crypto.randomUUID(),
        config: cfg,

        onBeforeEnter: (context) => {
          if (!context.origin || !cfg.applyTransformOrigin) {
            context.lifecycle.enter();

            return;
          }

          const originData = getOriginCoordinatesAndDimensions(context.origin);
          if (!originData) {
            context.lifecycle.enter();

            return;
          }

          applyOriginTransformProperties(context, originData.element);
          renderer.setStyle(context.containerEl, { transformOrigin: 'center center' });

          forceReflow(context.containerEl);

          nextFrame(() => {
            context.lifecycle.enter();
          });
        },

        onSwitchedAwayFrom: (context) => {
          const { containerEl } = context;

          renderer.setCssProperties(containerEl, {
            '--origin-scale-x': null,
            '--origin-scale-y': null,
            '--origin-translate-x': null,
            '--origin-translate-y': null,
          });

          renderer.setStyle(containerEl, { transformOrigin: null });
        },

        onBeforeLeave: (context) => {
          if (!context.origin || !cfg.applyTransformOrigin) {
            context.lifecycle.leave();

            return;
          }

          const originData = getOriginCoordinatesAndDimensions(context.origin);
          if (!originData) {
            context.lifecycle.leave();

            return;
          }

          applyOriginTransformProperties(context, originData.element);
          context.lifecycle.leave();
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
  options: AnchoredDialogOverlayStrategyOptions = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectAnchoredDialogStrategy();

    const {
      placement,
      fallbackPlacements,
      offset,
      arrowPadding,
      viewportPadding,
      shift,
      autoResize,
      autoHide,
      autoCloseIfReferenceHidden,
      mirrorWidth,
      positionStrategy,
      ...breakpointConfig
    } = options;

    const config: Partial<OverlayBreakpointConfig> = {
      ...breakpointConfig,
      positionStrategy:
        positionStrategy ??
        buildAnchoredRuntimePositionStrategy({
          placement: placement ?? DEFAULT_ANCHORED_DIALOG_POSITION.placement,
          fallbackPlacements: fallbackPlacements ?? DEFAULT_ANCHORED_DIALOG_POSITION.fallbackPlacements,
          offset: offset ?? DEFAULT_ANCHORED_DIALOG_POSITION.offset,
          arrowPadding: arrowPadding ?? DEFAULT_ANCHORED_DIALOG_POSITION.arrowPadding,
          viewportPadding,
          shift: shift ?? DEFAULT_ANCHORED_DIALOG_POSITION.shift,
          autoResize,
          autoHide,
          autoCloseIfReferenceHidden,
          mirrorWidth,
        }),
    };

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
