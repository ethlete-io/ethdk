import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { OverlayBreakpointConfig, OverlayBreakpointConfigEntry } from '../types';

export const ET_OVERLAY_LEFT_SHEET_CLASS = 'et-overlay--left-sheet';
export const ET_OVERLAY_RIGHT_SHEET_CLASS = 'et-overlay--right-sheet';
export const ET_OVERLAY_TOP_SHEET_CLASS = 'et-overlay--top-sheet';
export const ET_OVERLAY_BOTTOM_SHEET_CLASS = 'et-overlay--bottom-sheet';
export const ET_OVERLAY_DIALOG_CLASS = 'et-overlay--dialog';
export const ET_OVERLAY_FULL_SCREEN_DIALOG_CLASS = 'et-overlay--full-screen-dialog';

export class OverlayPositionBuilder {
  private readonly _overlay = inject(Overlay);

  readonly DEFAULTS = {
    dialog: {
      width: undefined,
      height: undefined,
      maxHeight: '80vh',
      maxWidth: '80vw',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: ET_OVERLAY_DIALOG_CLASS,
      positionStrategy: () => this._overlay.position().global().centerHorizontally().centerVertically(),
    },
    fullScreenDialog: {
      width: '100%',
      height: '100%',
      maxHeight: undefined,
      maxWidth: undefined,
      minHeight: undefined,
      minWidth: undefined,
      containerClass: ET_OVERLAY_FULL_SCREEN_DIALOG_CLASS,
      positionStrategy: () => this._overlay.position().global().left('0').top('0').bottom('0').right('0'),
      documentClass: 'et-overlay--full-screen-dialog-document',
      applyTransformOrigin: true,
    },
    bottomSheet: {
      width: '100%',
      height: undefined,
      maxHeight: 'calc(100% - 72px)',
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: ET_OVERLAY_BOTTOM_SHEET_CLASS,
      positionStrategy: () => this._overlay.position().global().centerHorizontally().bottom('0'),
      dragToDismiss: {
        direction: 'to-bottom',
      },
    },
    topSheet: {
      width: '100%',
      height: undefined,
      maxHeight: 'calc(100% - 72px)',
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: ET_OVERLAY_TOP_SHEET_CLASS,
      positionStrategy: () => this._overlay.position().global().centerHorizontally().top('0'),
      dragToDismiss: {
        direction: 'to-top',
      },
    },
    leftSheet: {
      width: '100%',
      height: '100%',
      maxHeight: undefined,
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: ET_OVERLAY_LEFT_SHEET_CLASS,
      positionStrategy: () => this._overlay.position().global().left('0').centerVertically(),
      dragToDismiss: {
        direction: 'to-left',
      },
    },
    rightSheet: {
      width: '100%',
      height: '100%',
      maxHeight: undefined,
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: ET_OVERLAY_RIGHT_SHEET_CLASS,
      positionStrategy: () => this._overlay.position().global().right('0').centerVertically(),
      dragToDismiss: {
        direction: 'to-right',
      },
    },
  } satisfies Record<string, OverlayBreakpointConfig>;

  transformingBottomSheetToDialog(customConfig?: {
    bottomSheet?: OverlayBreakpointConfig;
    dialog?: OverlayBreakpointConfig;
  }) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.bottomSheet, customConfig?.bottomSheet ?? {}),
      },
      {
        breakpoint: 'md',
        config: this.mergeConfigs(this.DEFAULTS.dialog, customConfig?.dialog ?? {}),
      },
    ];

    return data;
  }

  transformingFullScreenDialogToRightSheet(customConfig?: {
    fullScreenDialog?: OverlayBreakpointConfig;
    rightSheet?: OverlayBreakpointConfig;
  }) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.fullScreenDialog, customConfig?.fullScreenDialog ?? {}),
      },
      {
        breakpoint: 'md',
        config: this.mergeConfigs(this.DEFAULTS.rightSheet, customConfig?.rightSheet ?? {}),
      },
    ];

    return data;
  }

  transformingFullScreenDialogToDialog(customConfig?: {
    fullScreenDialog?: OverlayBreakpointConfig;
    dialog?: OverlayBreakpointConfig;
  }) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.fullScreenDialog, customConfig?.fullScreenDialog ?? {}),
      },
      {
        breakpoint: 'md',
        config: this.mergeConfigs(this.DEFAULTS.dialog, customConfig?.dialog ?? {}),
      },
    ];

    return data;
  }

  dialog(customConfig?: OverlayBreakpointConfig) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.dialog, customConfig ?? {}),
      },
    ];

    return data;
  }

  fullScreenDialog(customConfig?: OverlayBreakpointConfig) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.fullScreenDialog, customConfig ?? {}),
      },
    ];

    return data;
  }

  bottomSheet(customConfig?: OverlayBreakpointConfig) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.bottomSheet, customConfig ?? {}),
      },
    ];

    return data;
  }

  topSheet(customConfig?: OverlayBreakpointConfig) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.topSheet, customConfig ?? {}),
      },
    ];

    return data;
  }

  leftSheet(customConfig?: OverlayBreakpointConfig) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.leftSheet, customConfig ?? {}),
      },
    ];

    return data;
  }

  rightSheet(customConfig?: OverlayBreakpointConfig) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.rightSheet, customConfig ?? {}),
      },
    ];

    return data;
  }

  mergeConfigs(...configs: OverlayBreakpointConfig[]) {
    const config = configs.reduce((acc, curr) => {
      return {
        ...acc,
        ...curr,
      };
    }, {} as OverlayBreakpointConfig);

    return config;
  }
}
