import { createRootProvider, createStaticRootProvider, injectRenderer } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';

export const [provideRightSheetStrategyDefaults, injectRightSheetStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      width: '100%',
      height: '100%',
      maxWidth: '640px',
      containerClass: 'et-overlay--right-sheet',
      positionStrategy: () => ({ kind: 'global', horizontal: 'end' }),
      dragToDismiss: {
        direction: 'to-inline-end',
      },
    },
    {
      name: 'Right Sheet Overlay Strategy Defaults',
    },
  );

export const [provideRightSheetStrategy, injectRightSheetStrategy] = createRootProvider(
  () => {
    const defaults = injectRightSheetStrategyDefaults();
    const renderer = injectRenderer();

    const build = (config: Partial<OverlayBreakpointConfig> = {}) =>
      createSheetStrategy(mergeOverlayBreakpointConfigs(defaults, config), renderer);

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
