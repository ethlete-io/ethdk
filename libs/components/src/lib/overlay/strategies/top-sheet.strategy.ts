import { defineRootProvider, defineStaticRootProvider, injectRenderer, toInjectFn, toProvideFn } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';
import { SheetStylesComponent } from './sheet-styles.component';

const TOP_SHEET_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    maxHeight: 'calc(100% - 72px)',
    maxWidth: '640px',
    containerClass: 'et-overlay--top-sheet',
    stylesComponent: SheetStylesComponent,
    positionStrategy: () => ({ kind: 'global', vertical: 'start' }),
    dragToDismiss: {
      direction: 'to-top',
    },
  },
  {
    name: 'Top Sheet Overlay Strategy Defaults',
  },
);

export const provideTopSheetStrategyDefaults = /* @__PURE__ */ toProvideFn(TOP_SHEET_STRATEGY_DEFAULTS_DEF);
export const injectTopSheetStrategyDefaults = /* @__PURE__ */ toInjectFn(TOP_SHEET_STRATEGY_DEFAULTS_DEF);

const TOP_SHEET_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
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

export const provideTopSheetStrategy = /* @__PURE__ */ toProvideFn(TOP_SHEET_STRATEGY_DEF);
export const injectTopSheetStrategy = /* @__PURE__ */ toInjectFn(TOP_SHEET_STRATEGY_DEF);

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
