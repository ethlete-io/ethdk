import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { defineRootProvider, defineStaticRootProvider, randomId, toInjectFn, toProvideFn } from '@ethlete/core';
import {
  mergeOverlayBreakpointConfigs,
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
} from './core';

const DIALOG_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
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
