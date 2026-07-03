import { createRootProvider, createStaticRootProvider, injectRenderer } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';

export const [provideTopSheetStrategyDefaults, injectTopSheetStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      width: '100%',
      maxHeight: 'calc(100% - 72px)',
      maxWidth: '640px',
      containerClass: 'et-overlay--top-sheet',
      positionStrategy: () => ({ kind: 'global', vertical: 'start' }),
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
    const renderer = injectRenderer();

    const build = (config: Partial<OverlayBreakpointConfig> = {}) =>
      createSheetStrategy(mergeOverlayBreakpointConfigs(defaults, config), renderer);

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
