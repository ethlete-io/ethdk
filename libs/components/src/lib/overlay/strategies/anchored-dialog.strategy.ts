import {
  defineRootProvider,
  defineStaticRootProvider,
  forceReflow,
  injectRenderer,
  nextFrame,
  randomId,
  toInjectFn,
  toProvideFn,
} from '@ethlete/core';
import { AnchoredPositionOptions, buildAnchoredRuntimePositionStrategy } from './anchored.strategy';
import { getOriginCoordinatesAndDimensions } from './overlay-origin';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import {
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
} from './overlay-strategy.types';
import { AnchoredDialogStylesComponent } from './anchored-dialog-styles.component';

const DEFAULT_ANCHORED_DIALOG_POSITION: AnchoredPositionOptions = {
  placement: 'bottom-end',
  fallbackPlacements: ['top-end', 'bottom-start', 'top-start'],
  offset: 10,
  arrowPadding: 16,
  shift: true,
  autoResize: true,
};

export type AnchoredDialogOverlayStrategyOptions = Partial<OverlayBreakpointConfig> & AnchoredPositionOptions;

const ANCHORED_DIALOG_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    maxHeight: '80vh',
    maxWidth: '80vw',
    minWidth: '288px',
    containerClass: 'et-overlay--anchored-dialog',
    stylesComponent: AnchoredDialogStylesComponent,
    positionStrategy: /* @__PURE__ */ buildAnchoredRuntimePositionStrategy(DEFAULT_ANCHORED_DIALOG_POSITION),
    applyTransformOrigin: false,
    arrow: true,
    hasBackdrop: false,
  },
  {
    name: 'Anchored Dialog Overlay Strategy Defaults',
  },
);

export const provideAnchoredDialogStrategyDefaults = /* @__PURE__ */ toProvideFn(ANCHORED_DIALOG_STRATEGY_DEFAULTS_DEF);
export const injectAnchoredDialogStrategyDefaults = /* @__PURE__ */ toInjectFn(ANCHORED_DIALOG_STRATEGY_DEFAULTS_DEF);

const ANCHORED_DIALOG_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
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
        id: randomId(),
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

export const provideAnchoredDialogStrategy = /* @__PURE__ */ toProvideFn(ANCHORED_DIALOG_STRATEGY_DEF);
export const injectAnchoredDialogStrategy = /* @__PURE__ */ toInjectFn(ANCHORED_DIALOG_STRATEGY_DEF);

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
      minAvailableSpace,
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
          autoResize: autoResize ?? DEFAULT_ANCHORED_DIALOG_POSITION.autoResize,
          minAvailableSpace,
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
