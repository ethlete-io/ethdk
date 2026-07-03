import { createRootProvider, createStaticRootProvider, injectRenderer } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';

export const [provideLeftSheetStrategyDefaults, injectLeftSheetStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      width: '100%',
      height: '100%',
      maxWidth: '640px',
      containerClass: 'et-overlay--left-sheet',
      positionStrategy: () => ({ kind: 'global', horizontal: 'start' }),
      dragToDismiss: {
        direction: 'to-left',
      },
    },
    {
      name: 'Left Sheet Overlay Strategy Defaults',
    },
  );

export const [provideLeftSheetStrategy, injectLeftSheetStrategy] = createRootProvider(
  () => {
    const defaults = injectLeftSheetStrategyDefaults();
    const renderer = injectRenderer();

    const build = (config: Partial<OverlayBreakpointConfig> = {}) =>
      createSheetStrategy(mergeOverlayBreakpointConfigs(defaults, config), renderer);

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
