import { Breakpoint } from '@ethlete/core';
import { injectBottomSheetStrategy } from './bottom-sheet';
import { OverlayBreakpointConfig, OverlayStrategyBreakpoint } from './core';
import { injectDialogStrategy } from './dialog';
import { injectFullscreenDialogStrategy } from './full-screen';
import { injectRightSheetStrategy } from './right-sheet';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const transformingBottomSheetToDialogOverlayStrategy = (customConfig?: {
  bottomSheet?: OverlayBreakpointConfig;
  dialog?: OverlayBreakpointConfig;
  breakpoint?: Breakpoint | number;
}): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const dialogStrategy = injectDialogStrategy();
    const bottomSheetStrategy = injectBottomSheetStrategy();

    return [
      {
        strategy: bottomSheetStrategy.build(customConfig?.bottomSheet),
      },
      {
        breakpoint: customConfig?.breakpoint ?? 'md',
        strategy: dialogStrategy.build(customConfig?.dialog),
      },
    ];
  };
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const transformingFullScreenDialogToRightSheetOverlayStrategy = (customConfig?: {
  fullScreenDialog?: OverlayBreakpointConfig;
  rightSheet?: OverlayBreakpointConfig;
  breakpoint?: Breakpoint | number;
}): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const rightSheetStrategy = injectRightSheetStrategy();
    const fullscreenDialogStrategy = injectFullscreenDialogStrategy();

    return [
      {
        strategy: fullscreenDialogStrategy.build(customConfig?.fullScreenDialog),
      },
      {
        breakpoint: customConfig?.breakpoint ?? 'md',
        strategy: rightSheetStrategy.build(customConfig?.rightSheet),
      },
    ];
  };
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const transformingFullScreenDialogToDialogOverlayStrategy = (customConfig?: {
  fullScreenDialog?: OverlayBreakpointConfig;
  dialog?: OverlayBreakpointConfig;
  breakpoint?: Breakpoint | number;
}): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const dialogStrategy = injectDialogStrategy();
    const fullscreenDialogStrategy = injectFullscreenDialogStrategy();

    return [
      {
        strategy: fullscreenDialogStrategy.build(customConfig?.fullScreenDialog),
      },
      {
        breakpoint: customConfig?.breakpoint ?? 'md',
        strategy: dialogStrategy.build(customConfig?.dialog),
      },
    ];
  };
};
