import { Overlay } from '@angular/cdk/overlay';
import { ApplicationRef, DOCUMENT, EnvironmentInjector, inject } from '@angular/core';
import { createRootProvider, createStaticRootProvider, injectRenderer } from '@ethlete/core';
import { filter, take } from 'rxjs';
import { OverlayBreakpointConfig } from '../types';
import {
  FullscreenAnimationCleanup,
  mergeOverlayBreakpointConfigs,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
  prepareFullscreenLeaveAnimation,
  setupFullscreenEnterAnimation,
} from './core';

export const [injectFullscreenDialogStrategyDefaults] = createStaticRootProvider<OverlayBreakpointConfig>(
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
  },
  {
    name: 'Fullscreen Dialog Overlay Strategy Defaults',
  },
);

export const [injectFullscreenDialogStrategy] = createRootProvider(
  () => {
    const defaults = injectFullscreenDialogStrategyDefaults();
    const injector = inject(EnvironmentInjector);
    const document = inject(DOCUMENT);
    const appRef = inject(ApplicationRef);
    const renderer = injectRenderer();

    const build = (config: Partial<OverlayBreakpointConfig> = {}): OverlayStrategy => {
      const cfg = mergeOverlayBreakpointConfigs(defaults, config);

      let fullscreenCleanup: FullscreenAnimationCleanup | undefined;

      return {
        id: crypto.randomUUID(),
        config: cfg,

        onBeforeEnter: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (!context.origin || !cfg.applyTransformOrigin) {
            context.containerInstance.animatedLifecycle.enter();
            return;
          }

          fullscreenCleanup = setupFullscreenEnterAnimation({
            context,
            injector,
            document,
            appRef,
            renderer,
          });
        },

        onSwitchedAwayFrom: () => {
          if (!fullscreenCleanup) return;

          const { cloneComponentRef, contentAttachedSub, animationStateSub, restoreOriginElement } = fullscreenCleanup;

          contentAttachedSub?.unsubscribe();
          animationStateSub?.unsubscribe();

          appRef.detachView(cloneComponentRef.hostView);
          cloneComponentRef.destroy();

          restoreOriginElement();

          fullscreenCleanup = undefined;
        },

        onSwitchedTo: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (!context.origin || !cfg.applyTransformOrigin) {
            return;
          }

          if (fullscreenCleanup) {
            return;
          }

          fullscreenCleanup = setupFullscreenEnterAnimation({
            context,
            injector,
            document,
            appRef,
            renderer,
            skipEnterAnimation: true,
          });
        },

        onBeforeLeave: <T, R>(context: OverlayStrategyContext<T, R>) => {
          if (!fullscreenCleanup) return;

          const { cloneComponentRef, contentAttachedSub, animationStateSub, isEnterStarted, isEnterComplete } =
            fullscreenCleanup;

          contentAttachedSub?.unsubscribe();
          animationStateSub?.unsubscribe();

          if (isEnterStarted && isEnterComplete) {
            prepareFullscreenLeaveAnimation({
              cleanup: fullscreenCleanup,
              containerEl: context.containerEl,
              renderer,
            });
          }

          cloneComponentRef.instance.animatedLifecycle.leave();
        },

        onAfterLeave: () => {
          if (!fullscreenCleanup) return;

          const { cloneComponentRef, isEnterStarted, isEnterComplete, leaveAnimationSub, restoreOriginElement } =
            fullscreenCleanup;

          leaveAnimationSub?.unsubscribe();

          const cleanup = () => {
            appRef.detachView(cloneComponentRef.hostView);
            cloneComponentRef.destroy();

            restoreOriginElement();

            fullscreenCleanup = undefined;
          };

          if (isEnterStarted && isEnterComplete) {
            const currentState = cloneComponentRef.instance.animatedLifecycle.state$.value;

            if (currentState === 'left') {
              cleanup();
            } else {
              const sub = cloneComponentRef.instance.animatedLifecycle.state$
                .pipe(
                  filter((state) => state === 'left'),
                  take(1),
                )
                .subscribe(() => {
                  cleanup();
                });

              fullscreenCleanup.leaveAnimationSub = sub;
            }
          } else {
            cleanup();
          }
        },
      };
    };

    return {
      build,
    };
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
