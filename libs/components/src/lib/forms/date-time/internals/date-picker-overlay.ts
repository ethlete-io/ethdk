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
 * The space a side must offer before the picker takes it, in px - the tallest state any picker panel
 * reaches (a six-week month grid, 333px). It has to stay at or above that, and it has to stay a
 * constant: any threshold the shorter views clear - and `flip`, which compares the panel's own
 * height - lets a picker that opened above the field drop below it the moment a drill into the month
 * grid makes it shorter.
 */
const PICKER_MIN_AVAILABLE_SPACE = 340;

export type CreateDatePickerOverlayOptions = {
  interactive: Signal<boolean>;
  pickerOpen: ModelSignal<boolean>;
  surface: Signal<DatePickerSurfaceBase | null>;
  anchor: () => HTMLElement | null | undefined;
  context: () => DatePickerSurfaceContext;
  /** Runs once the pane is gone. */
  onAfterClosed?: (closeInfo: DatePickerOverlayCloseInfo) => void;
};

/**
 * The picker overlay for the date, time, and date-time inputs - a thin binding of the shared
 * `createAnchoredPanelController` to the date-picker config (bottom sheet below `md`, an anchored
 * pane above it, the calendar auto-focused). The controller owns the mount, the outside-pointer
 * close, and the model sync; this only supplies the config and forwards the close info (which now
 * carries `fromBottomSheet` so the caller can skip refocusing and popping the soft keyboard).
 * Call in an injection context.
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
      // no top-level hasBackdrop: the bottom-sheet strategy brings its own, the
      // anchored one falls back to the non-modal default (none)
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      // outside-pointer closing is owned by the controller: a pointerdown on the field/trigger
      // (both inside the anchor) must toggle instead of close-and-reopen
      closeOnEscape: true,
      closeOnOutsidePointer: false,
      origin,
      panelClass: 'et-date-input-overlay-pane',
      strategies: () => [
        {
          // small viewports: backdropped bottom sheet with drag-to-dismiss
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
