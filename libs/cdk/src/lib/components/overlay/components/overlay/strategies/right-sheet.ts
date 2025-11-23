import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { createRootProvider, createStaticRootProvider } from '@ethlete/core';
import { SwipeHandlerService } from '../../../../../services';
import { OverlayBreakpointConfig } from '../types';
import {
  DragToDismissRef,
  enableDragToDismiss,
  mergeOverlayBreakpointConfigs,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
} from './core';

export const [injectRightSheetStrategyDefaults] = createStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    height: '100%',
    maxHeight: undefined,
    maxWidth: '640px',
    minHeight: undefined,
    minWidth: undefined,
    containerClass: 'et-overlay--right-sheet',
    positionStrategy: () => inject(Overlay).position().global().right('0').centerVertically(),
    dragToDismiss: {
      direction: 'to-right',
    },
  },
  {
    name: 'Right Sheet Overlay Strategy Defaults',
  },
);

export const [injectRightSheetStrategy] = createRootProvider(
  () => {
    const defaults = injectRightSheetStrategyDefaults();
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
    name: 'Right Sheet Overlay Strategy',
  },
);

export const rightSheetOverlayStrategy = (
  config: Partial<OverlayBreakpointConfig> = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectRightSheetStrategy();

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
