import { Overlay } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { Breakpoint } from '@ethlete/core';
import { OverlayBreakpointConfig, OverlayBreakpointConfigEntry } from '../types';

export const ET_OVERLAY_LEFT_SHEET_CLASS = 'et-overlay--left-sheet';
export const ET_OVERLAY_RIGHT_SHEET_CLASS = 'et-overlay--right-sheet';
export const ET_OVERLAY_TOP_SHEET_CLASS = 'et-overlay--top-sheet';
export const ET_OVERLAY_BOTTOM_SHEET_CLASS = 'et-overlay--bottom-sheet';
export const ET_OVERLAY_DIALOG_CLASS = 'et-overlay--dialog';
export const ET_OVERLAY_ANCHORED_DIALOG_CLASS = 'et-overlay--anchored-dialog';
export const ET_OVERLAY_FULL_SCREEN_DIALOG_CLASS = 'et-overlay--full-screen-dialog';

export const ET_OVERLAY_CONFIG_CLASS_KEYS = new Set([
  'containerClass',
  'paneClass',
  'overlayClass',
  'backdropClass',
  'documentClass',
  'bodyClass',
]);

export const ET_OVERLAY_LAYOUT_CLASSES = new Set([
  ET_OVERLAY_LEFT_SHEET_CLASS,
  ET_OVERLAY_RIGHT_SHEET_CLASS,
  ET_OVERLAY_TOP_SHEET_CLASS,
  ET_OVERLAY_BOTTOM_SHEET_CLASS,
  ET_OVERLAY_DIALOG_CLASS,
  ET_OVERLAY_FULL_SCREEN_DIALOG_CLASS,
]);

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
    anchoredDialog: {
      width: undefined,
      height: undefined,
      maxHeight: '80vh',
      maxWidth: '80vw',
      minHeight: undefined,
      minWidth: undefined,
      containerClass: ET_OVERLAY_ANCHORED_DIALOG_CLASS,
      positionStrategy: (origin?: HTMLElement) => {
        if (!origin) throw new Error('Origin element is required for anchored dialogs');

        return this._overlay
          .position()
          .flexibleConnectedTo(origin)
          .withPositions([
            {
              originX: 'end',
              originY: 'bottom',
              overlayX: 'end',
              overlayY: 'top',
            },
          ]);
      },
    },
  } satisfies Record<string, OverlayBreakpointConfig>;

  transformingBottomSheetToDialog(customConfig?: {
    bottomSheet?: OverlayBreakpointConfig;
    dialog?: OverlayBreakpointConfig;
    breakpoint?: Breakpoint | number;
  }) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.bottomSheet, customConfig?.bottomSheet ?? {}),
      },
      {
        breakpoint: customConfig?.breakpoint ?? 'md',
        config: this.mergeConfigs(this.DEFAULTS.dialog, customConfig?.dialog ?? {}),
      },
    ];

    return data;
  }

  transformingFullScreenDialogToRightSheet(customConfig?: {
    fullScreenDialog?: OverlayBreakpointConfig;
    rightSheet?: OverlayBreakpointConfig;
    breakpoint?: Breakpoint | number;
  }) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.fullScreenDialog, customConfig?.fullScreenDialog ?? {}),
      },
      {
        breakpoint: customConfig?.breakpoint ?? 'md',
        config: this.mergeConfigs(this.DEFAULTS.rightSheet, customConfig?.rightSheet ?? {}),
      },
    ];

    return data;
  }

  transformingFullScreenDialogToDialog(customConfig?: {
    fullScreenDialog?: OverlayBreakpointConfig;
    dialog?: OverlayBreakpointConfig;
    breakpoint?: Breakpoint | number;
  }) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.fullScreenDialog, customConfig?.fullScreenDialog ?? {}),
      },
      {
        breakpoint: customConfig?.breakpoint ?? 'md',
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

  anchoredDialog(customConfig?: OverlayBreakpointConfig) {
    const data: OverlayBreakpointConfigEntry[] = [
      {
        config: this.mergeConfigs(this.DEFAULTS.anchoredDialog, customConfig ?? {}),
      },
    ];

    return data;
  }

  mergeConfigs(...configs: OverlayBreakpointConfig[]) {
    const combinedConfig: OverlayBreakpointConfig = {};

    for (const config of configs) {
      for (const configKey of Object.keys(config)) {
        const key = configKey as keyof OverlayBreakpointConfig;
        const newConfigValue = config[key];

        if (ET_OVERLAY_CONFIG_CLASS_KEYS.has(configKey)) {
          const existing = combinedConfig[key];

          if (existing && Array.isArray(existing)) {
            if (Array.isArray(newConfigValue)) {
              existing.push(...newConfigValue);
            } else if (typeof newConfigValue === 'string') {
              existing.push(newConfigValue);
            }

            const totalLayoutClassesInExisting = existing.filter((value) =>
              ET_OVERLAY_LAYOUT_CLASSES.has(value),
            ).length;

            if (totalLayoutClassesInExisting > 1) {
              throw new Error(`Multiple layout classes are not allowed in the same config key: ${key}`);
            }
          } else if (typeof newConfigValue === 'string') {
            (combinedConfig[key] as any) = [newConfigValue];
          } else if (Array.isArray(newConfigValue)) {
            (combinedConfig[key] as any) = newConfigValue;
          }
        } else {
          (combinedConfig[key] as any) = newConfigValue;
        }
      }
    }

    return combinedConfig;
  }
}
