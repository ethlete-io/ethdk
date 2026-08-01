import { defineRootProvider, defineStaticRootProvider, injectRenderer, toInjectFn, toProvideFn } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';
import { SheetStylesComponent } from './sheet-styles.component';

const RIGHT_SHEET_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    height: '100%',
    maxWidth: '640px',
    containerClass: 'et-overlay--right-sheet',
    stylesComponent: SheetStylesComponent,
    positionStrategy: () => ({ kind: 'global', horizontal: 'end' }),
    dragToDismiss: {
      direction: 'to-inline-end',
    },
  },
  {
    name: 'Right Sheet Overlay Strategy Defaults',
  },
);

export const provideRightSheetStrategyDefaults = /* @__PURE__ */ toProvideFn(RIGHT_SHEET_STRATEGY_DEFAULTS_DEF);
export const injectRightSheetStrategyDefaults = /* @__PURE__ */ toInjectFn(RIGHT_SHEET_STRATEGY_DEFAULTS_DEF);

const RIGHT_SHEET_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
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

export const provideRightSheetStrategy = /* @__PURE__ */ toProvideFn(RIGHT_SHEET_STRATEGY_DEF);
export const injectRightSheetStrategy = /* @__PURE__ */ toInjectFn(RIGHT_SHEET_STRATEGY_DEF);

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
