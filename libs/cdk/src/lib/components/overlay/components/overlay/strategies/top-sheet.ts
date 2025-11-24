import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { createRootProvider, createStaticRootProvider } from '@ethlete/core';
import { SwipeHandlerService } from '../../../../../services';
import {
  DragToDismissRef,
  enableDragToDismiss,
  mergeOverlayBreakpointConfigs,
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
} from './core';

export const [provideTopSheetStrategyDefaults, injectTopSheetStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      width: '100%',
      height: undefined,
      maxHeight: 'calc(100% - 72px)',
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--top-sheet',
      positionStrategy: () => inject(Overlay).position().global().centerHorizontally().top('0'),
      dragToDismiss: {
        direction: 'to-top',
      },
    },
    {
      name: 'Top Sheet Overlay Strategy Defaults',
    },
  );

export const [provideTopSheetStrategy, injectTopSheetStrategy] = createRootProvider(
  () => {
    const defaults = injectTopSheetStrategyDefaults();
    const swipeHandlerService = inject(SwipeHandlerService);

    const build = (config: Partial<OverlayBreakpointConfig> = {}): OverlayStrategy => {
      const cfg = mergeOverlayBreakpointConfigs(defaults, config);

      let dragToDismissRef: DragToDismissRef | undefined;

      const attachDragToDismiss = <T, R>(context: OverlayStrategyContext<T, R>) => {
        if (!cfg.dragToDismiss) return;

        dragToDismissRef = enableDragToDismiss({
          config: cfg.dragToDismiss,
          element: context.containerEl,
          overlayRef: context.overlayRef,
          swipeHandlerService,
        });
      };

      const detachDragToDismiss = () => {
        if (!cfg.dragToDismiss) return;

        dragToDismissRef?.unsubscribe();
      };

      return {
        id: crypto.randomUUID(),
        config: cfg,
        onBeforeEnter: (context) => context.containerInstance.animatedLifecycle.enter(),
        onAfterEnter: (ctx) => attachDragToDismiss(ctx),
        onSwitchedTo: attachDragToDismiss,
        onSwitchedAwayFrom: detachDragToDismiss,
        onBeforeLeave: (context) => {
          detachDragToDismiss();
          context.containerInstance.animatedLifecycle.leave();
        },
      };
    };

    return {
      build,
    };
  },
  {
    name: 'Top Sheet Overlay Strategy',
  },
);

export const topSheetOverlayStrategy = (
  config: Partial<OverlayBreakpointConfig> = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectTopSheetStrategy();

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
