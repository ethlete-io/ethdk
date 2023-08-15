import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const AT_LEAST_ONE_REQUIRED = 'atLeastOneRequired';

export interface ValidateAtLeastOneRequiredConfig {
  /**
   * Keys of form controls to validate in the supplied form group
   */
  keys: string[];

  /**
   * If true, the value `false` will result in a validation error
   * @default false
   */
  checkFalse?: boolean;
}

export const ValidateAtLeastOneRequired = (config: ValidateAtLeastOneRequiredConfig): ValidatorFn => {
  return (formGroup: AbstractControl): ValidationErrors | null => {
    const { keys, checkFalse } = config;

    if (!formGroup) {
      return { [AT_LEAST_ONE_REQUIRED]: true };
    }

    const controlValues = keys.map((key) => formGroup.get(key)?.value);

    const areAllFalsy = controlValues.every(
      (value) =>
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (checkFalse && value === false),
    );

    if (areAllFalsy) {
      return { [AT_LEAST_ONE_REQUIRED]: true };
    }

    return null;
  };
};
