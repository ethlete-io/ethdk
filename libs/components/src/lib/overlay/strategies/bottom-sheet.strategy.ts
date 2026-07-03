import { createRootProvider, createStaticRootProvider, injectRenderer } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';

export const [provideBottomSheetStrategyDefaults, injectBottomSheetStrategyDefaults] =
  createStaticRootProvider<OverlayBreakpointConfig>(
    {
      width: '100%',
      maxHeight: 'calc(100% - 72px)',
      maxWidth: '640px',
      containerClass: 'et-overlay--bottom-sheet',
      positionStrategy: () => ({ kind: 'global', vertical: 'end' }),
      dragToDismiss: {
        direction: 'to-bottom',
      },
    },
    {
      name: 'Bottom Sheet Overlay Strategy Defaults',
    },
  );

export const [provideBottomSheetStrategy, injectBottomSheetStrategy] = createRootProvider(
  () => {
    const defaults = injectBottomSheetStrategyDefaults();
    const renderer = injectRenderer();

    const build = (config: Partial<OverlayBreakpointConfig> = {}) =>
      createSheetStrategy(mergeOverlayBreakpointConfigs(defaults, config), renderer);

    return {
      build,
    };
  },
  {
    name: 'Bottom Sheet Overlay Strategy',
  },
);

export const bottomSheetOverlayStrategy = (
  config: Partial<OverlayBreakpointConfig> = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategyProvider = injectBottomSheetStrategy();

    return [
      {
        strategy: strategyProvider.build(config),
      },
    ];
  };
};
