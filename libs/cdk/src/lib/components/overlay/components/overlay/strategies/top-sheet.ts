import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { defineRootProvider, defineStaticRootProvider, randomId, toInjectFn, toProvideFn } from '@ethlete/core';
import {
  DragToDismissRef,
  enableDragToDismiss,
  mergeOverlayBreakpointConfigs,
  OverlayBreakpointConfig,
  OverlayStrategy,
  OverlayStrategyBreakpoint,
  OverlayStrategyContext,
} from './core';

const TOP_SHEET_STRATEGY_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<OverlayBreakpointConfig>(
  {
    width: '100%',
    height: undefined,
    maxHeight: 'calc(100% - 72px)',
    maxWidth: '640px',
    minHeight: undefined,
    minWidth: undefined,
    containerClass: 'et-overlay--top-sheet',
    positionStrategy: () => inject(Overlay).position().global().centerHorizontally().top('0'),
    dragToDismiss: {
      direction: 'to-top',
    },
  },
  {
    name: 'Top Sheet Overlay Strategy Defaults',
  },
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideTopSheetStrategyDefaults = /* @__PURE__ */ toProvideFn(TOP_SHEET_STRATEGY_DEFAULTS_DEF);
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const injectTopSheetStrategyDefaults = /* @__PURE__ */ toInjectFn(TOP_SHEET_STRATEGY_DEFAULTS_DEF);

const TOP_SHEET_STRATEGY_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const defaults = injectTopSheetStrategyDefaults();

    const build = (config: Partial<OverlayBreakpointConfig> = {}): OverlayStrategy => {
      const cfg = mergeOverlayBreakpointConfigs(defaults, config);

      let dragToDismissRef: DragToDismissRef | undefined;

      const attachDragToDismiss = <T, R>(context: OverlayStrategyContext<T, R>) => {
        if (!cfg.dragToDismiss) return;

        dragToDismissRef = enableDragToDismiss({
          config: cfg.dragToDismiss,
          element: context.containerEl,
          overlayRef: context.overlayRef,
        });
      };

      const detachDragToDismiss = () => {
        if (!cfg.dragToDismiss) return;

        dragToDismissRef?.unsubscribe();
      };

      return {
        id: randomId(),
        config: cfg,
        onBeforeEnter: (context) => context.containerInstance.animatedLifecycle.enter(),
        onAfterEnter: (ctx) => attachDragToDismiss(ctx),
        onSwitchedTo: attachDragToDismiss,
        onSwitchedAwayFrom: detachDragToDismiss,
        onBeforeLeave: (context) => {
          detachDragToDismiss();
          context.containerInstance.animatedLifecycle.leave();
        },
      };
    };

    return {
      build,
    };
  },
  {
    name: 'Top Sheet Overlay Strategy',
  },
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideTopSheetStrategy = /* @__PURE__ */ toProvideFn(TOP_SHEET_STRATEGY_DEF);
/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const injectTopSheetStrategy = /* @__PURE__ */ toInjectFn(TOP_SHEET_STRATEGY_DEF);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
