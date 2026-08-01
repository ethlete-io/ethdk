import { ApplicationRef, DOCUMENT, EnvironmentInjector, inject } from '@angular/core';
import {
  defineRootProvider,
  defineStaticRootProvider,
  injectRenderer,
  randomId,
  toInjectFn,
  toProvideFn,
} from '@ethlete/core';
import {
  FullscreenAnimationDeps,
  FullscreenAnimationState,
  abortFullscreenAnimation,
  cleanupFullscreenAnimation,
  startFullscreenEnterAnimation,
  startFullscreenLeaveAnimation,
} from './fullscreen-animation';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyBreakpoint } from './overlay-strategy.types';

const FULLSCREEN_DIALOG_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    height: '100%',
    containerClass: 'et-overlay--full-screen-dialog',
    positionStrategy: () => ({ kind: 'global', horizontal: 'stretch', vertical: 'stretch' }),
    documentClass: 'et-overlay--full-screen-dialog-document',
    applyTransformOrigin: true,
    backdropClass: 'et-overlay-backdrop--hidden',
  },
  {
    name: 'Fullscreen Dialog Overlay Strategy Defaults',
  },
);

export const provideFullscreenDialogStrategyDefaults = /* @__PURE__ */ toProvideFn(
  FULLSCREEN_DIALOG_STRATEGY_DEFAULTS_DEF,
);
export const injectFullscreenDialogStrategyDefaults = /* @__PURE__ */ toInjectFn(
  FULLSCREEN_DIALOG_STRATEGY_DEFAULTS_DEF,
);

const FULLSCREEN_DIALOG_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const defaults = injectFullscreenDialogStrategyDefaults();
    const injector = inject(EnvironmentInjector);
    const document = inject(DOCUMENT);
    const appRef = inject(ApplicationRef);
    const renderer = injectRenderer();

    const deps: FullscreenAnimationDeps = { injector, document, appRef, renderer };

    const build = (config: Partial<OverlayBreakpointConfig> = {}): OverlayStrategy => {
      const cfg = mergeOverlayBreakpointConfigs(defaults, config);

      let animationState: FullscreenAnimationState | null = null;

      return {
        id: randomId(),
        config: cfg,

        onBeforeEnter: (context) => {
          animationState = startFullscreenEnterAnimation({
            context,
            deps,
            applyTransformOrigin: cfg.applyTransformOrigin ?? true,
            skipAnimation: false,
          });
        },

        onSwitchedAwayFrom: (context) => {
          if (animationState) {
            abortFullscreenAnimation({ context, state: animationState, deps });
            animationState = null;
          }
        },

        onSwitchedTo: (context) => {
          if (!animationState) {
            animationState = startFullscreenEnterAnimation({
              context,
              deps,
              applyTransformOrigin: cfg.applyTransformOrigin ?? true,
              skipAnimation: true,
            });
          }
        },

        onBeforeLeave: (context) => {
          if (animationState) {
            animationState = startFullscreenLeaveAnimation({
              context,
              state: animationState,
              deps,
              applyTransformOrigin: cfg.applyTransformOrigin ?? true,
            });
          } else {
            context.lifecycle.leave();
          }
        },

        onAfterLeave: () => {
          if (animationState) {
            cleanupFullscreenAnimation(animationState, deps);
            animationState = null;
          }
        },
      };
    };

    return { build };
  },
  {
    name: 'Fullscreen Dialog Overlay Strategy',
  },
);

export const provideFullscreenDialogStrategy = /* @__PURE__ */ toProvideFn(FULLSCREEN_DIALOG_STRATEGY_DEF);
export const injectFullscreenDialogStrategy = /* @__PURE__ */ toInjectFn(FULLSCREEN_DIALOG_STRATEGY_DEF);

export const fullScreenDialogOverlayStrategy = (
  config: Partial<OverlayBreakpointConfig> = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectFullscreenDialogStrategy();

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
