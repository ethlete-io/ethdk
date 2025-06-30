import { assertInInjectionContext, computed, signal, Signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { controlValueSignal, equal } from '@ethlete/core';
import { Observable, of } from 'rxjs';

export type NavigationDismissCheckerRef<T> = {
  /**
   * Set the default form value to the current form value.
   * Useful when the form value changes after the overlay is opened.
   *
   * (e.g. when a http request was needed to fill the remaining form fields to their default values)
   */
  refreshDefaultFormValue: () => void;

  /**
   * Run the check if the form has changes.
   *
   * @returns `true` if the form has no changes or the user confirmed to discard the changes.
   * `false` if the user wants to keep the changes.
   */
  runCheck: (formValue: T) => unknown | Promise<unknown> | Observable<unknown>;

  /**
   * Restore the default form value to the form.
   */
  restoreDefaultFormValue: () => void;

  hasChanges: Signal<boolean>;
  defaultFormValue: Signal<T>;
};

export type CreateNavigationDismissCheckerConfig<T extends AbstractControl> = {
  /**
   * The form to check for changes
   */
  form: T;

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
   * The default value to compare the current form value to
   *
   * @default form.getRawValue()
   */
  defaultValue?: ReturnType<T['getRawValue']>;

  /**
   * A custom compare function to compare the current form value to the default value.
   * By default, a deep comparison will be used.
   *
   * @default (currentValue, defaultValue) => equal(currentValue, defaultValue)
   */
  compareFn?: (currentValue: ReturnType<T['getRawValue']>, defaultValue: ReturnType<T['getRawValue']>) => boolean;
};

/**
 * A utility function to enhance the ux of views containing forms.
 * It helps to prevent the user from accidentally losing unsaved form changes.
 */
export const createNavigationDismissChecker = <T extends AbstractControl>(
  config: CreateNavigationDismissCheckerConfig<T>,
): NavigationDismissCheckerRef<ReturnType<T['getRawValue']>> => {
  assertInInjectionContext(createNavigationDismissChecker);

  const { form, compareFn, dismissCheckFn } = config;
  const currentFormValue = controlValueSignal(form);

  const hasChanges = computed(() => {
    const formValue = currentFormValue();

    if (!formValue) return false;

    return !(compareFn ? compareFn(formValue, defaultFormValue()) : equal(formValue, defaultFormValue()));
  });

  const defaultFormValue = signal(config.defaultValue ?? form.getRawValue());

  const runCheck = () => {
    const isDefaultFormValue = !hasChanges();

    if (isDefaultFormValue) return of(true);

    return dismissCheckFn(form.getRawValue());
  };

  const refreshDefaultFormValue = () => {
    defaultFormValue.set(form.getRawValue());
  };

  const restoreDefaultFormValue = () => {
    form.setValue(defaultFormValue());
    refreshDefaultFormValue();
  };

  return {
    runCheck,
    refreshDefaultFormValue,
    restoreDefaultFormValue,
    hasChanges,
    defaultFormValue: defaultFormValue.asReadonly(),
  };
};
