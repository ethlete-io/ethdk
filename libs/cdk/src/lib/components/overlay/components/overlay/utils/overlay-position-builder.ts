import { Overlay, PositionStrategy } from '@angular/cdk/overlay';
import { inject } from '@angular/core';
import { Breakpoint, ViewportService } from '@ethlete/core';
import { Observable, map } from 'rxjs';

export interface TransformingBottomSheetToDialogConfig {
  bottomSheet?: {
    width?: {
      /**
       * Determine the width of the bottom sheet.
       * @default "100%"
       */
      default?: string | number;

      /**
       * Determine the min width of the bottom sheet.
       * @default undefined
       */
      min?: string | number;

      /**
       * Determine the max width of the bottom sheet.
       * @default "640px"
       */
      max?: string | number;
    };
    height?: {
      /**
       * Determine the height of the bottom sheet.
       * @default "100%"
       */
      default?: string | number;

      /**
       * Determine the min height of the bottom sheet.
       * @default undefined
       */
      min?: string | number;

      /**
       * Determine the max height of the bottom sheet.
       * @default "calc(100% - 72px)"
       */
      max?: string | number;
    };

    containerClass?: string | string[];

    /**
     * The position strategy for the bottom sheet.
     * @default this._overlay.position().global().centerHorizontally().bottom('0')
     */
    positionStrategy?: PositionStrategy;
  };
  dialog: {
    width?: {
      /**
       * Determine the width of the bottom sheet.
       * @default undefined
       */
      default?: string | number;

      /**
       * Determine the min width of the bottom sheet.
       * @default undefined
       */
      min?: string | number;

      /**
       * Determine the max width of the bottom sheet.
       * @default "80vw"
       */
      max?: string | number;
    };
    height?: {
      /**
       * Determine the height of the bottom sheet.
       * @default "undefined
       */
      default?: string | number;

      /**
       * Determine the min height of the bottom sheet.
       * @default undefined
       */
      min?: string | number;

      /**
       * Determine the max height of the bottom sheet.
       * @default undefined
       */
      max?: string | number;
    };

    containerClass?: string | string[];

    /**
     * The position strategy for the dialog.
     * @default this._overlay.position().global().centerHorizontally().centerVertically()
     */
    positionStrategy?: PositionStrategy;
  };

  /**
   * Determine the breakpoint when the bottom sheet should be transformed to dialog.
   * Can be either a breakpoint or an observable of boolean (e.g. using the `ViewportService`).
   * @default "md"
   */
  transformAt?: Breakpoint | Observable<boolean>;
}

export class OverlayPositionBuilder {
  private readonly _overlay = inject(Overlay);
  private readonly _viewportService = inject(ViewportService);

  transformingBottomSheetToDialog(config?: TransformingBottomSheetToDialogConfig) {
    const mergedConfig = this._mergeTransformingBottomSheetToDialogConfig(config);
    const transformAt$ =
      typeof mergedConfig.transformAt === 'string'
        ? this._viewportService.observe({ min: mergedConfig.transformAt })
        : mergedConfig.transformAt;

    return transformAt$.pipe(
      map((shouldTransform) => {
        const configToUse = shouldTransform ? mergedConfig.dialog : mergedConfig.bottomSheet;

        return {
          width: configToUse?.width?.default,
          maxWidth: configToUse?.width?.max,
          minWidth: configToUse?.width?.min,
          height: configToUse?.height?.default,
          maxHeight: configToUse?.height?.max,
          minHeight: configToUse?.height?.min,
          positionStrategy: configToUse?.positionStrategy,
          containerClass: configToUse?.containerClass,
        };
      }),
    );
  }

  private _mergeTransformingBottomSheetToDialogConfig(config?: TransformingBottomSheetToDialogConfig) {
    const merged = {
      dialog: {
        width: {
          default: config?.dialog?.width?.default ?? undefined,
          max: config?.dialog?.width?.max ?? '80vw',
          min: config?.dialog?.width?.min ?? undefined,
        },
        height: {
          default: config?.dialog?.height?.default ?? undefined,
          max: config?.dialog?.height?.max ?? undefined,
          min: config?.dialog?.height?.min ?? undefined,
        },
        positionStrategy:
          config?.dialog?.positionStrategy ?? this._overlay.position().global().centerHorizontally().centerVertically(),
        containerClass: config?.dialog?.containerClass ?? 'et-overlay--dialog',
      },
      bottomSheet: {
        width: {
          default: config?.bottomSheet?.width?.default ?? '100%',
          max: config?.bottomSheet?.width?.max ?? '640px',
          min: config?.bottomSheet?.width?.min ?? undefined,
        },
        height: {
          default: config?.bottomSheet?.height?.default ?? '100%',
          max: config?.bottomSheet?.height?.max ?? 'calc(100% - 72px)',
          min: config?.bottomSheet?.height?.min ?? undefined,
        },

        positionStrategy:
          config?.bottomSheet?.positionStrategy ?? this._overlay.position().global().centerHorizontally().bottom('0'),
        containerClass: config?.bottomSheet?.containerClass ?? 'et-overlay--bottom-sheet',
      },
      transformAt: config?.transformAt ?? 'md',
    } satisfies TransformingBottomSheetToDialogConfig;

    return merged;
  }
}
