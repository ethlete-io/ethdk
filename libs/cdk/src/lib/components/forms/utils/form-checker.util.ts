import { assertInInjectionContext, computed, signal, Signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { controlValueSignal, equal } from '@ethlete/core';

export interface FormCheckerRef<T> {
  /**
   * Set the default form value to the current form value.
   * Useful when the form value changes after the overlay is opened.
   *
   * (e.g. when a http request was needed to fill the remaining form fields to their default values)
   */
  refreshDefaultFormValue: () => void;

  /**
   * Restore the default form value to the form.
   */
  restoreDefaultFormValue: () => void;

  hasChanges: Signal<boolean>;
  defaultFormValue: Signal<T>;
}

export type CreateFormCheckerConfig<T extends AbstractControl> = {
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
   * A custom compare function to compare the current form value to the default value.
   * By default, a deep comparison will be used.
   *
   * @default (currentValue, defaultValue) => equal(currentValue, defaultValue)
   */
  compareFn?: (currentValue: ReturnType<T['getRawValue']>, defaultValue: ReturnType<T['getRawValue']>) => boolean;
};

/**
 * A utility function to enhance the ux of overlays containing forms.
 * It helps to prevent the user from accidentally losing unsaved form changes.
 */
export const createFormChecker = <T extends AbstractControl>(
  config: CreateFormCheckerConfig<T>,
): FormCheckerRef<ReturnType<T['getRawValue']>> => {
  assertInInjectionContext(createFormChecker);

  const { form, compareFn } = config;
  const currentFormValue = controlValueSignal(form);

  const hasChanges = computed(() => {
    const formValue = currentFormValue();

    if (!formValue) return false;

    return compareFn ? compareFn(formValue, defaultFormValue()) : equal(formValue, defaultFormValue());
  });

  const defaultFormValue = signal(config.defaultValue ?? form.getRawValue());

  const refreshDefaultFormValue = () => {
    defaultFormValue.set(form.getRawValue());
  };

  const restoreDefaultFormValue = () => {
    form.setValue(defaultFormValue());
    refreshDefaultFormValue();
  };

  return {
    refreshDefaultFormValue,
    restoreDefaultFormValue,
    hasChanges,
    defaultFormValue: defaultFormValue.asReadonly(),
  };
};
