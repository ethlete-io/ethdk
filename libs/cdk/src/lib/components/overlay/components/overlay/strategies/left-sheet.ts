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

export const [injectLeftSheetStrategyDefaults] = createStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    height: '100%',
    maxHeight: undefined,
    maxWidth: '640px',
    minHeight: undefined,
    minWidth: undefined,
    containerClass: 'et-overlay--left-sheet',
    positionStrategy: () => inject(Overlay).position().global().left('0').centerVertically(),
    dragToDismiss: {
      direction: 'to-left',
    },
  },
  {
    name: 'Left Sheet Overlay Strategy Defaults',
  },
);

export const [injectLeftSheetStrategy] = createRootProvider(
  () => {
    const defaults = injectLeftSheetStrategyDefaults();
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
    name: 'Left Sheet Overlay Strategy',
  },
);

export const leftSheetOverlayStrategy = (
  config: Partial<OverlayBreakpointConfig> = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectLeftSheetStrategy();

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
