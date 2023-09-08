import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { OverlayBreakpointConfig, OverlayBreakpointConfigEntry } from '../types';

export class OverlayPositionBuilder {
  private readonly _overlay = inject(Overlay);

  readonly DEFAULTS = {
    dialog: {
      width: undefined,
      height: undefined,
      maxHeight: undefined,
      maxWidth: '80vw',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--dialog',
      positionStrategy: this._overlay.position().global().centerHorizontally().centerVertically(),
    },
    fullScreenDialog: {
      width: '100%',
      height: '100%',
      maxHeight: undefined,
      maxWidth: undefined,
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--full-screen-dialog',
      positionStrategy: this._overlay.position().global().left('0').top('0').bottom('0').right('0'),
    },
    bottomSheet: {
      width: '100%',
      height: '100%',
      maxHeight: 'calc(100% - 72px)',
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--bottom-sheet',
      positionStrategy: this._overlay.position().global().centerHorizontally().bottom('0'),
    },
    leftSheet: {
      width: '100%',
      height: '100%',
      maxHeight: undefined,
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--left-sheet',
      positionStrategy: this._overlay.position().global().left('0').centerVertically(),
    },
    rightSheet: {
      width: '100%',
      height: '100%',
      maxHeight: undefined,
      maxWidth: '640px',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: 'et-overlay--right-sheet',
      positionStrategy: this._overlay.position().global().right('0').centerVertically(),
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
