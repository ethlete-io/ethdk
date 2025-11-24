import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { createRootProvider, createStaticRootProvider } from '@ethlete/core';
import {
  mergeOverlayBreakpointConfigs,
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
} from './core';

export const [provideDialogStrategyDefaults, injectDialogStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      width: undefined,
      height: undefined,
      maxHeight: '80vh',
      maxWidth: '80vw',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--dialog',
      positionStrategy: () => inject(Overlay).position().global().centerHorizontally().centerVertically(),
    },
    {
      name: 'Dialog Overlay Strategy Defaults',
    },
  );

export const [provideDialogStrategy, injectDialogStrategy] = createRootProvider(
  () => {
    const defaults = injectDialogStrategyDefaults();

    const build = (config: Partial<OverlayBreakpointConfig> = {}): OverlayStrategy => {
      const cfg = mergeOverlayBreakpointConfigs(defaults, config);

      return {
        id: crypto.randomUUID(),
        config: cfg,
        onBeforeEnter: (context) => context.containerInstance.animatedLifecycle.enter(),
        onBeforeLeave: (context) => context.containerInstance.animatedLifecycle.leave(),
      };
    };

    return {
      build,
    };
  },
  {
    name: 'Dialog Overlay Strategy',
  },
);

export const dialogOverlayStrategy = (
  config: Partial<OverlayBreakpointConfig> = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectDialogStrategy();

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
