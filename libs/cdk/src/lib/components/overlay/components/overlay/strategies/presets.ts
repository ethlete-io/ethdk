import { Breakpoint } from '@ethlete/core';
import { OverlayBreakpointConfig } from '../types';
import { injectBottomSheetStrategy } from './bottom-sheet';
import { OverlayStrategyBreakpoint } from './core';
import { injectDialogStrategy } from './dialog';
import { injectFullscreenDialogStrategy } from './full-screen';
import { injectRightSheetStrategy } from './right-sheet';

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
