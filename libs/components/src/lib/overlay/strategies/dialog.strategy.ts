import { defineRootProvider, defineStaticRootProvider, randomId, toInjectFn, toProvideFn } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyBreakpoint } from './overlay-strategy.types';

const DIALOG_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
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

export const provideDialogStrategyDefaults = /* @__PURE__ */ toProvideFn(DIALOG_STRATEGY_DEFAULTS_DEF);
export const injectDialogStrategyDefaults = /* @__PURE__ */ toInjectFn(DIALOG_STRATEGY_DEFAULTS_DEF);

const DIALOG_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
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

export const provideDialogStrategy = /* @__PURE__ */ toProvideFn(DIALOG_STRATEGY_DEF);
export const injectDialogStrategy = /* @__PURE__ */ toInjectFn(DIALOG_STRATEGY_DEF);

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
