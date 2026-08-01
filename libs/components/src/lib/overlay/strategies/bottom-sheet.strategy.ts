import { defineRootProvider, defineStaticRootProvider, injectRenderer, toInjectFn, toProvideFn } from '@ethlete/core';
import { mergeOverlayBreakpointConfigs } from './overlay-strategy-config-merger';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';
import { SheetStylesComponent } from './sheet-styles.component';

const BOTTOM_SHEET_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    maxHeight: 'calc(100% - 72px)',
    maxWidth: '640px',
    containerClass: 'et-overlay--bottom-sheet',
    stylesComponent: SheetStylesComponent,
    positionStrategy: () => ({ kind: 'global', vertical: 'end' }),
    dragToDismiss: {
      direction: 'to-bottom',
    },
  },
  {
    name: 'Bottom Sheet Overlay Strategy Defaults',
  },
);

export const provideBottomSheetStrategyDefaults = /* @__PURE__ */ toProvideFn(BOTTOM_SHEET_STRATEGY_DEFAULTS_DEF);
export const injectBottomSheetStrategyDefaults = /* @__PURE__ */ toInjectFn(BOTTOM_SHEET_STRATEGY_DEFAULTS_DEF);

const BOTTOM_SHEET_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
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

export const provideBottomSheetStrategy = /* @__PURE__ */ toProvideFn(BOTTOM_SHEET_STRATEGY_DEF);
export const injectBottomSheetStrategy = /* @__PURE__ */ toInjectFn(BOTTOM_SHEET_STRATEGY_DEF);

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
