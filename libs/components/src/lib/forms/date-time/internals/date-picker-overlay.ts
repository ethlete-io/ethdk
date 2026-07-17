import { DOCUMENT } from '@angular/common';
import { DestroyRef, ModelSignal, Signal, effect, inject, inputBinding, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RuntimeError } from '@ethlete/core';
import { fromEvent, take, tap } from 'rxjs';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { OverlayTemplateHostComponent } from '../../../overlay/overlay-template-host.component';
import { anchoredOverlayStrategy, injectBottomSheetStrategy } from '../../../overlay/strategies';
import { DATE_INPUT_ERROR_CODES } from '../date-input/date-input-errors';
import { DatePickerSurfaceBase, DatePickerSurfaceContext } from '../picker/date-picker-host';

export type DatePickerOverlayCloseInfo = {
  /** A deliberate pointerdown elsewhere closed the picker. */
  byOutsidePointer: boolean;
  /** The picker was showing as a bottom sheet (small viewport) when it closed. */
  fromBottomSheet: boolean;
};

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
 * The picker overlay machinery shared by the date input and the date range
 * input: mounts an anchored pane for the registered surface template while
 * `pickerOpen` is `true`, owns the outside-pointer close (so a pointerdown on
 * the anchor toggles instead of close-and-reopen) and keeps the model in sync
 * with every interactive close. Call in an injection context.
 */
export const createDatePickerOverlay = (options: CreateDatePickerOverlayOptions) => {
  const overlayManager = injectOverlayManager();
  const bottomSheetStrategy = injectBottomSheetStrategy();
  const documentRef = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);

  const overlayRef = signal<OverlayRef<OverlayTemplateHostComponent, unknown> | null>(null);
  let interactionListenersCleanup: (() => void) | null = null;
  let closedByOutsidePointer = false;
  let closedFromBottomSheet = false;

  const detachInteractionListeners = () => {
    interactionListenersCleanup?.();
    interactionListenersCleanup = null;
  };

  const attachInteractionListeners = () => {
    detachInteractionListeners();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const pane = overlayRef()?.elements?.paneElement;

      if (pane?.contains(target)) {
        return;
      }

      if (options.anchor()?.contains(target)) {
        return;
      }

      closedByOutsidePointer = true;
      options.pickerOpen.set(false);
      overlayRef()?.close();
    };

    const pointerdownSubscription = fromEvent<PointerEvent>(documentRef, 'pointerdown', { capture: true }).subscribe(
      onPointerDown,
    );

    interactionListenersCleanup = () => pointerdownSubscription.unsubscribe();
  };

  const mountOverlay = () => {
    const surface = options.surface();

    if (!surface) {
      if (ngDevMode) {
        throw new RuntimeError(
          DATE_INPUT_ERROR_CODES.MISSING_SURFACE,
          '[createDatePickerOverlay] Cannot open the picker without an <ng-template etDatePickerSurface> inside the host element.',
        );
      }

      return;
    }

    const config: OverlayConfig = {
      bindings: [inputBinding('template', () => surface.templateRef), inputBinding('context', options.context)],
      mode: 'non-modal',
      // no top-level hasBackdrop: the bottom-sheet strategy brings its own, the
      // anchored one falls back to the non-modal default (none)
      autoFocus: 'first-tabbable',
      restoreFocus: false,
      // outside-pointer closing is owned above: a pointerdown on the field/trigger
      // (both inside the anchor) must toggle instead of close-and-reopen
      closeOnEscape: true,
      closeOnOutsidePointer: false,
      origin: options.anchor() ?? undefined,
      panelClass: 'et-date-input-overlay-pane',
      strategies: () => [
        {
          // small viewports: backdropped bottom sheet with drag-to-dismiss
          strategy: bottomSheetStrategy.build({
            hasBackdrop: true,
            containerClass: 'et-date-picker-sheet',
          }),
        },
        ...anchoredOverlayStrategy({
          containerClass: ['et-overlay--anchored', 'et-overlay--date-picker'],
          placement: 'bottom-start',
          fallbackPlacements: ['top-start'],
          offset: 4,
          viewportPadding: 8,
          autoResize: true,
          shift: { crossAxis: true },
        })().map((entry) => ({ ...entry, breakpoint: 'md' as const })),
      ],
    };

    const currentRef = overlayManager.open<OverlayTemplateHostComponent>(OverlayTemplateHostComponent, config);

    overlayRef.set(currentRef);
    attachInteractionListeners();

    // sync the open model as soon as any close begins (Escape, outside pointer) so
    // aria-expanded flips before the leave animation
    currentRef
      .beforeClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap(() => {
          if (overlayRef() !== currentRef) {
            return;
          }

          detachInteractionListeners();

          // read while the pane still exists — afterClosed fires post-removal
          closedFromBottomSheet =
            currentRef.elements?.paneElement?.classList.contains('et-overlay--bottom-sheet') ?? false;

          if (options.pickerOpen()) {
            options.pickerOpen.set(false);
          }
        }),
      )
      .subscribe();

    currentRef
      .afterClosed()
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap(() => {
          if (overlayRef() !== currentRef) {
            return;
          }

          overlayRef.set(null);

          const closeInfo: DatePickerOverlayCloseInfo = {
            byOutsidePointer: closedByOutsidePointer,
            fromBottomSheet: closedFromBottomSheet,
          };

          closedByOutsidePointer = false;
          closedFromBottomSheet = false;
          options.onAfterClosed?.(closeInfo);
        }),
      )
      .subscribe();
  };

  effect(() => {
    const interactive = options.interactive();
    const shouldBeOpen = options.pickerOpen();
    const currentRef = overlayRef();

    if (!interactive) {
      if (currentRef) {
        untracked(() => currentRef.close());
      }

      if (shouldBeOpen) {
        untracked(() => options.pickerOpen.set(false));
      }

      return;
    }

    if (shouldBeOpen && !currentRef) {
      untracked(() => mountOverlay());

      return;
    }

    if (!shouldBeOpen && currentRef) {
      untracked(() => currentRef.close());
    }
  });

  destroyRef.onDestroy(() => {
    detachInteractionListeners();
    overlayRef()?.close();
  });

  return {
    close: () => overlayRef()?.close(),
  };
};
