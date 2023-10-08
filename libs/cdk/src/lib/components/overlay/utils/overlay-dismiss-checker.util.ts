import { ESCAPE } from '@angular/cdk/keycodes';
import { assertInInjectionContext, inject, isDevMode } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { createDestroy, equal } from '@ethlete/core';
import { Observable, filter, from, map, merge, of, switchMap, take, takeUntil, tap } from 'rxjs';
import { OverlayRef } from '../components';

export type CreateOverlayDismissCheckerConfig<T extends AbstractControl> = {
  /**
   * The form to check for changes
   */
  form: T;

  /**
   * The default value to compare the current form value to
   *
   * @default form.getRawValue()
   */
  defaultValue?: unknown;

  /**
   * The events that should trigger the dismiss check
   *
   * @default { backdropClick: true, escapeKey: true, closeCall: true }
   */
  dismissEvents?: {
    /**
     * Whether the backdrop click should trigger the dismiss check
     *
     * @default true
     */
    backdropClick?: boolean;

    /**
     * Whether the escape key should trigger the dismiss check
     *
     * @default true
     */
    escapeKey?: boolean;

    /**
     * Whether the close call should trigger the dismiss check.
     * (e.g. `overlayRef.close()`)
     *
     * @default true
     */
    closeCall?: boolean;
  };

  /**
   * This function will be called when the current form value is not equal to the default value.
   * Use this to show a confirmation dialog or similar.
   *
   * @example Show a confirmation dialog:
   * ```ts
   * () => this.overlayService
   *   .show(SomeConfirmationComponent)
   *   .afterClosed()
   *   .pipe(map((result) => !!result?.confirmed))
   * ```
   *
   * @param v The current form value
   */
  dismissCheckFn: (v: ReturnType<T['getRawValue']>) => unknown | Promise<unknown> | Observable<unknown>;
};

/**
 * A utility function to enhance the ux of overlays containing forms.
 * It can prevent the user from accidentally closing the overlay when the form value is not equal to the default value.
 */
export const createOverlayDismissChecker = <T extends AbstractControl>(
  config: CreateOverlayDismissCheckerConfig<T>,
) => {
  assertInInjectionContext(createOverlayDismissChecker);

  const {
    form,
    defaultValue = form.getRawValue(),
    dismissEvents = { backdropClick: true, escapeKey: true, closeCall: true },
    dismissCheckFn,
  } = config;

  const checkBackdropClick = dismissEvents.backdropClick ?? true;
  const checkEscapeKey = dismissEvents.escapeKey ?? true;
  const checkCloseCall = dismissEvents.closeCall ?? true;

  if (!checkBackdropClick && !checkEscapeKey && !checkCloseCall) {
    throw new Error('At least one dismiss event must be enabled');
  }

  const destroy$ = createDestroy();
  const overlayRef = inject(OverlayRef);

  overlayRef._isBackdropCloseControlledExternally = checkBackdropClick;
  overlayRef._isEscCloseControlledExternally = checkEscapeKey;
  overlayRef._isCloseFnCloseControlledExternally = checkCloseCall;

  const eventStreams: Observable<unknown>[] = [];

  if (checkBackdropClick) {
    if (!overlayRef.disableClose) {
      eventStreams.push(overlayRef.backdropClick().pipe(map(() => 'mouse')));
    } else if (isDevMode() && dismissEvents.backdropClick) {
      console.warn('dismissEvents.backdropClick being set to true has no effect when overlayRef.disableClose is true.');
    }
  }

  if (checkEscapeKey) {
    if (!overlayRef.disableClose) {
      eventStreams.push(
        overlayRef.keydownEvents().pipe(
          filter((event) => event.keyCode === ESCAPE),
          map(() => 'keyboard'),
        ),
      );
    } else if (isDevMode() && dismissEvents.escapeKey) {
      console.warn('dismissEvents.escapeKey being set to true has no effect when overlayRef.disableClose is true.');
    }
  }

  if (checkCloseCall) {
    eventStreams.push(overlayRef.closeCalled());
  }

  const sub = merge(...eventStreams)
    .pipe(
      takeUntil(destroy$),
      filter(() => {
        const isNotEqual = !equal(form.getRawValue(), defaultValue);
        const hasNoOtherInternalOverlays = !overlayRef._internalDisableClose;

        const wasKeyboard = overlayRef._closeInteractionType === 'keyboard';
        const wasMouse = overlayRef._closeInteractionType === 'mouse';

        if ((wasKeyboard && !checkEscapeKey) || (wasMouse && !checkBackdropClick)) {
          return false;
        }

        return isNotEqual && hasNoOtherInternalOverlays;
      }),
      switchMap((result) => {
        const checkResponse = dismissCheckFn(form.getRawValue());

        let nextObservable: Observable<unknown>;

        if (checkResponse instanceof Observable) {
          nextObservable = checkResponse;
        } else if (checkResponse instanceof Promise) {
          nextObservable = from(checkResponse);
        } else {
          nextObservable = of(checkResponse);
        }

        return nextObservable.pipe(
          filter((response) => !!response),
          tap((response) => {
            sub.unsubscribe();

            if (response === 'keyboard' || response === 'mouse') {
              overlayRef._closeOverlayVia(response, undefined, true);
            } else {
              overlayRef.close(result, true);
            }
          }),
          take(1),
        );
      }),
      takeUntil(destroy$),
      take(1),
    )
    .subscribe();

  return sub;
};
