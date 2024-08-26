import { assertInInjectionContext, computed, signal, Signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { controlValueSignal, equal } from '@ethlete/core';

export interface FormChangesTrackerRef<T> {
  /**
   * Set the default form value to the current form value.
   * Useful when the form value changes.
   *
   * (e.g. when a http request was needed to fill the remaining form fields to their default values)
   */
  refreshDefaultFormValue: () => void;

  /**
   * Restore the default form value to the form.
   */
  restoreDefaultFormValue: () => void;

  /**
   * Checks if the form has changes compared to the default form value.
   * @returns `true` if the form has changes.
   */
  hasChanges: Signal<boolean>;

  /**
   * The default form value to compare the current form value to
   */
  defaultFormValue: Signal<T>;
}

export type CreateFormChangesTrackerConfig<T extends AbstractControl> = {
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
 * A utility function to enhance form usage by providing methods to manage form state and detect changes.
 */
export const createFormChangesTracker = <T extends AbstractControl>(
  config: CreateFormChangesTrackerConfig<T>,
): FormChangesTrackerRef<ReturnType<T['getRawValue']>> => {
  assertInInjectionContext(createFormChangesTracker);

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
