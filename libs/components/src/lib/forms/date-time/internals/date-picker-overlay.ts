import { ModelSignal, Signal, inputBinding, signal } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import {
  AnchoredPanelCloseInfo,
  AnchoredPanelOverlayRef,
  createAnchoredPanelController,
} from '../../form-field/headless';
import { anchoredOverlayStrategy, injectBottomSheetStrategy } from '../../../overlay/strategies';
import { DATE_INPUT_ERROR_CODES } from '../date-input/date-input-errors';
import { DatePickerSurfaceBase, DatePickerSurfaceContext } from '../picker/date-picker-host';

export type DatePickerOverlayCloseInfo = AnchoredPanelCloseInfo;

/**
 * The space a side must offer before the picker takes it, in px. Must stay at or above the tallest
 * state any picker panel reaches (a six-week month grid, 333px) and must stay a constant: a
 * threshold the shorter views clear lets a picker that opened above the field drop below it on a
 * drill into the month grid.
 */
const PICKER_MIN_AVAILABLE_SPACE = 340;

export type CreateDatePickerOverlayOptions = {
  interactive: Signal<boolean>;
  pickerOpen: ModelSignal<boolean>;
  surface: Signal<DatePickerSurfaceBase | null>;
  anchor: () => HTMLElement | null | undefined;
  context: () => DatePickerSurfaceContext;
  onAfterClosed?: (closeInfo: DatePickerOverlayCloseInfo) => void;
};

/**
 * The picker overlay for the date, time, and date-time inputs: a bottom sheet below `md`, an
 * anchored pane above it. Call in an injection context.
 */
export const createDatePickerOverlay = (options: CreateDatePickerOverlayOptions) => {
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
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      // outside-pointer closing is owned by the controller: a pointerdown on the field/trigger
      // must toggle instead of close-and-reopen
      closeOnEscape: true,
      closeOnOutsidePointer: false,
      origin,
      panelClass: 'et-date-input-overlay-pane',
      strategies: () => [
        {
          strategy: bottomSheetStrategy.build({ hasBackdrop: true, containerClass: 'et-date-picker-sheet' }),
        },
        ...anchoredOverlayStrategy({
          containerClass: ['et-overlay--anchored', 'et-overlay--date-picker'],
          placement: 'bottom-start',
          offset: 4,
          viewportPadding: 8,
          autoResize: true,
          minAvailableSpace: PICKER_MIN_AVAILABLE_SPACE,
        })().map((entry) => ({ ...entry, breakpoint: 'md' as const })),
      ],
    }),
    onAfterClosed: (info) => options.onAfterClosed?.(info),
    onMissingSurface: () => {
      if (ngDevMode) {
        throw new RuntimeError(
          DATE_INPUT_ERROR_CODES.MISSING_SURFACE,
          '[createDatePickerOverlay] Cannot open the picker without an <ng-template etDatePickerSurface> inside the host element.',
        );
      }
    },
  });

  return {
    close: () => panel.close(),
  };
};
