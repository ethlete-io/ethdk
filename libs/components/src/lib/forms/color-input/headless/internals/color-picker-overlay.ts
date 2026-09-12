import { ModelSignal, Signal, inputBinding, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import {
  AnchoredPanelCloseInfo,
  AnchoredPanelOverlayRef,
  AnchoredPanelSurfaceLike,
  createAnchoredPanelController,
} from '../../../form-field/headless';
import { anchoredOverlayStrategy, injectBottomSheetStrategy } from '../../../../overlay/strategies';
import { COLOR_INPUT_ERROR_CODES } from '../../color-input-errors';

export type ColorPickerOverlayCloseInfo = AnchoredPanelCloseInfo;

export type CreateColorPickerOverlayOptions = {
  interactive: Signal<boolean>;
  pickerOpen: ModelSignal<boolean>;
  surface: Signal<AnchoredPanelSurfaceLike | null>;
  anchor: () => HTMLElement | null | undefined;
  context: () => unknown;
  onAfterClosed?: (closeInfo: ColorPickerOverlayCloseInfo) => void;
};

/** Call in an injection context. */
export const createColorPickerOverlay = (options: CreateColorPickerOverlayOptions) => {
  const bottomSheetStrategy = injectBottomSheetStrategy();
  const overlayRef = signal<AnchoredPanelOverlayRef | null>(null);

  const panel = createAnchoredPanelController({
    canOpen: options.interactive,
    open: options.pickerOpen,
    overlayRef,
    surface: options.surface,
    anchor: options.anchor,
    config: ({ origin, templateRef }) => ({
      bindings: [inputBinding('template', () => templateRef), inputBinding('context', options.context)],
      mode: 'non-modal',
      // no top-level hasBackdrop: the bottom-sheet strategy brings its own, the anchored one falls
      // back to the non-modal default (none)
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      // outside-pointer closing is owned by the controller: a pointerdown on the trigger must
      // toggle instead of close-and-reopen
      closeOnEscape: true,
      closeOnOutsidePointer: false,
      origin,
      panelClass: 'et-color-input-overlay-pane',
      strategies: () => [
        {
          strategy: bottomSheetStrategy.build({ hasBackdrop: true, containerClass: 'et-color-picker-sheet' }),
        },
        ...anchoredOverlayStrategy({
          containerClass: ['et-overlay--anchored', 'et-overlay--color-picker'],
          placement: 'bottom-start',
          offset: 4,
          viewportPadding: 8,
        })().map((entry) => ({ ...entry, breakpoint: 'md' as const })),
      ],
    }),
    onAfterClosed: (info) => options.onAfterClosed?.(info),
    onMissingSurface: () => {
      if (ngDevMode) {
        throw new RuntimeError(
          COLOR_INPUT_ERROR_CODES.MISSING_SURFACE,
          '[createColorPickerOverlay] Cannot open the picker without an <ng-template etColorPickerSurface> inside the host element.',
        );
      }
    },
  });

  return {
    close: () => panel.close(),
  };
};
