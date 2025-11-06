import { ESCAPE } from '@angular/cdk/keycodes';
import { assertInInjectionContext, inject, isDevMode } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { createDestroy, equal } from '@ethlete/core';
import { Observable, filter, finalize, from, map, merge, of, switchMap, takeUntil, tap } from 'rxjs';
import { OverlayRef } from '../components/overlay/utils';

export interface OverlayDismissCheckerRef {
  /**
   * Destroys the dismiss checker. No further checks will be performed.
   */
  destroy: () => void;

  /**
   * Set the default form value to the current form value.
   * Useful when the form value changes after the overlay is opened.
   *
   * (e.g. when a http request was needed to fill the remaining form fields to their default values)
   */
  refreshDefaultFormValue: () => void;
}

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
  defaultValue?: ReturnType<T['getRawValue']>;

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

  /**
   * A custom compare function to compare the current form value to the default value.
   * By default, a deep comparison will be used.
   *
   * @default (currentValue, defaultValue) => equal(currentValue, defaultValue)
   */
  compareFn?: (currentValue: ReturnType<T['getRawValue']>, defaultValue: ReturnType<T['getRawValue']>) => boolean;
};

/**
 * A utility function to enhance the ux of overlays containing forms.
 * It can prevent the user from accidentally closing the overlay when the form value is not equal to the default value.
 */
export const createOverlayDismissChecker = <T extends AbstractControl>(
  config: CreateOverlayDismissCheckerConfig<T>,
): OverlayDismissCheckerRef => {
  assertInInjectionContext(createOverlayDismissChecker);

  const {
    form,
    dismissEvents = { backdropClick: true, escapeKey: true, closeCall: true },
    dismissCheckFn,
    compareFn,
  } = config;
  let { defaultValue = form.getRawValue() } = config;

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

  const eventStreams: Observable<'mouse' | 'keyboard' | unknown>[] = [];

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
    eventStreams.push(
      overlayRef.closeCalled().pipe(
        filter((e) => !e.forced),
        map((e) => e.result),
      ),
    );
  }

  const sub = merge(...eventStreams)
    .pipe(
      switchMap((eventOrResult) => {
        const isDefaultFormValue = compareFn
          ? compareFn(form.getRawValue(), defaultValue)
          : equal(form.getRawValue(), defaultValue);

        if (isDefaultFormValue) {
          return of(eventOrResult).pipe(
            tap(() => {
              sub.unsubscribe();

              if (eventOrResult === 'keyboard' || eventOrResult === 'mouse') {
                overlayRef._closeOverlayVia(eventOrResult, undefined, true);
              } else {
                overlayRef.close(eventOrResult, true);
              }
            }),
          );
        } else {
          return of(eventOrResult).pipe(
            filter(() => {
              const wasKeyboard = overlayRef._closeInteractionType === 'keyboard';
              const wasMouse = overlayRef._closeInteractionType === 'mouse';

              if ((wasKeyboard && !checkEscapeKey) || (wasMouse && !checkBackdropClick)) {
                return false;
              }

              return !overlayRef._internalDisableClose;
            }),
            switchMap(() => {
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
                filter((checkFnResult) => !!checkFnResult),
                tap(() => {
                  sub.unsubscribe();

                  if (eventOrResult === 'keyboard' || eventOrResult === 'mouse') {
                    overlayRef._closeOverlayVia(eventOrResult, undefined, true);
                  } else {
                    overlayRef.close(eventOrResult, true);
                  }
                }),
              );
            }),
          );
        }
      }),
      takeUntil(destroy$),
      finalize(() => {
        overlayRef._isBackdropCloseControlledExternally = false;
        overlayRef._isEscCloseControlledExternally = false;
        overlayRef._isCloseFnCloseControlledExternally = false;
      }),
    )
    .subscribe();

  return {
    destroy: () => sub.unsubscribe(),
    refreshDefaultFormValue: () => {
      defaultValue = form.getRawValue();
    },
  };
};
