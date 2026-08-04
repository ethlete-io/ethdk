import { Overlay } from '@angular/cdk/overlay';
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
  abortFullscreenAnimation,
  cleanupFullscreenAnimation,
  FullscreenAnimationDeps,
  FullscreenAnimationState,
  mergeOverlayBreakpointConfigs,
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
  startFullscreenEnterAnimation,
  startFullscreenLeaveAnimation,
} from './core';

const FULLSCREEN_DIALOG_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    height: '100%',
    maxHeight: undefined,
    maxWidth: undefined,
    minHeight: undefined,
    minWidth: undefined,
    containerClass: 'et-overlay--full-screen-dialog',
    positionStrategy: () => inject(Overlay).position().global().left('0').top('0').bottom('0').right('0'),
    documentClass: 'et-overlay--full-screen-dialog-document',
    applyTransformOrigin: true,
    backdropClass: 'et-overlay-backdrop--hidden',
  },
  {
    name: 'Fullscreen Dialog Overlay Strategy Defaults',
  },
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideFullscreenDialogStrategyDefaults = /* @__PURE__ */ toProvideFn(
  FULLSCREEN_DIALOG_STRATEGY_DEFAULTS_DEF,
);
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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

        onBeforeEnter: <T, R>(context: OverlayStrategyContext<T, R>) => {
          animationState = startFullscreenEnterAnimation(context, deps, cfg.applyTransformOrigin ?? true, false);
        },

        onSwitchedAwayFrom: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (animationState) {
            abortFullscreenAnimation(context, animationState, deps);
            animationState = null;
          }
        },

        onSwitchedTo: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (!animationState) {
            animationState = startFullscreenEnterAnimation(context, deps, cfg.applyTransformOrigin ?? true, true);
          }
        },

        onBeforeLeave: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (animationState) {
            animationState = startFullscreenLeaveAnimation(
              context,
              animationState,
              deps,
              cfg.applyTransformOrigin ?? true,
            );
          } else {
            context.containerInstance.animatedLifecycle.leave();
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

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideFullscreenDialogStrategy = /* @__PURE__ */ toProvideFn(FULLSCREEN_DIALOG_STRATEGY_DEF);
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const injectFullscreenDialogStrategy = /* @__PURE__ */ toInjectFn(FULLSCREEN_DIALOG_STRATEGY_DEF);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
