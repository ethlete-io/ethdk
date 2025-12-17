import { Overlay } from '@angular/cdk/overlay';
import { ApplicationRef, DOCUMENT, EnvironmentInjector, inject } from '@angular/core';
import { createRootProvider, createStaticRootProvider, injectRenderer } from '@ethlete/core';
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

export const [provideFullscreenDialogStrategyDefaults, injectFullscreenDialogStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
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

export const [provideFullscreenDialogStrategy, injectFullscreenDialogStrategy] = createRootProvider(
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
        id: crypto.randomUUID(),
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
