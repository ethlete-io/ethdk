import { DOCUMENT } from '@angular/common';
import { DestroyRef, ModelSignal, Signal, inject, inputBinding, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RuntimeError, getFocusableElements } from '@ethlete/core';
import { delay, filter, fromEvent, takeUntil, tap } from 'rxjs';
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
  /** Runs once the pane is gone. */
  onAfterClosed?: (closeInfo: ColorPickerOverlayCloseInfo) => void;
};

/**
 * The picker overlay for the color input - a thin binding of the shared
 * `createAnchoredPanelController` to the color picker config: a bottom sheet below `md`, an anchored
 * pane above it, the same way the date and cascader pickers present. Call in an injection context.
 */
export const createColorPickerOverlay = (options: CreateColorPickerOverlayOptions) => {
  const bottomSheetStrategy = injectBottomSheetStrategy();
  const documentRef = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);
  const overlayRef = signal<AnchoredPanelOverlayRef | null>(null);

  let closedByTabOut = false;

  const isTabOutOfPane = (event: KeyboardEvent, pane: HTMLElement) => {
    if (event.key !== 'Tab' || event.defaultPrevented) {
      return false;
    }

    const focusable = getFocusableElements(pane, documentRef);
    const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];

    return !!edge && event.target === edge;
  };

  const watchForTabOut = (mountedRef: AnchoredPanelOverlayRef) => {
    const pane = mountedRef.elements?.paneElement;

    if (!pane) {
      return;
    }

    fromEvent<KeyboardEvent>(pane, 'keydown')
      .pipe(
        filter((event) => isTabOutOfPane(event, pane)),
        // one task later: closing inside the keydown would tear the pane down before the browser
        // performs the Tab, and focus would fall to the document instead of the next tab stop
        delay(0),
        tap(() => {
          closedByTabOut = true;
          panel.close();
        }),
        takeUntil(mountedRef.afterClosed()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

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
          // small viewports: backdropped bottom sheet with drag-to-dismiss
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
    onMounted: watchForTabOut,
    onAfterClosed: (info) => {
      // a tab out is a focus leave even when the browser focused nothing, so the field must not
      // pull focus back out from under the user
      const byFocusLeave = info.byFocusLeave || closedByTabOut;

      closedByTabOut = false;
      options.onAfterClosed?.({ ...info, byFocusLeave });
    },
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
