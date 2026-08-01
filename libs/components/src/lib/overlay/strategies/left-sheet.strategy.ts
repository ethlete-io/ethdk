import { defineRootProvider, defineStaticRootProvider, injectRenderer, toInjectFn, toProvideFn } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';

const LEFT_SHEET_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    height: '100%',
    maxWidth: '640px',
    containerClass: 'et-overlay--left-sheet',
    positionStrategy: () => ({ kind: 'global', horizontal: 'start' }),
    dragToDismiss: {
      direction: 'to-inline-start',
    },
  },
  {
    name: 'Left Sheet Overlay Strategy Defaults',
  },
);

export const provideLeftSheetStrategyDefaults = /* @__PURE__ */ toProvideFn(LEFT_SHEET_STRATEGY_DEFAULTS_DEF);
export const injectLeftSheetStrategyDefaults = /* @__PURE__ */ toInjectFn(LEFT_SHEET_STRATEGY_DEFAULTS_DEF);

const LEFT_SHEET_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
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

export const provideLeftSheetStrategy = /* @__PURE__ */ toProvideFn(LEFT_SHEET_STRATEGY_DEF);
export const injectLeftSheetStrategy = /* @__PURE__ */ toInjectFn(LEFT_SHEET_STRATEGY_DEF);

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
