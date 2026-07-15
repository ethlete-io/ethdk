import { createRootProvider, createStaticRootProvider , randomId} from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyBreakpoint } from './overlay-strategy.types';

export const [provideDialogStrategyDefaults, injectDialogStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      maxHeight: '80vh',
      maxWidth: '80vw',
      width: 'min(512px, 80vw)',
      containerClass: 'et-overlay--dialog',
      positionStrategy: () => ({ kind: 'global' }),
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
        id: randomId(),
        config: cfg,
        onBeforeEnter: (context) => context.lifecycle.enter(),
        onBeforeLeave: (context) => context.lifecycle.leave(),
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
