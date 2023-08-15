import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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

export function validateAtLeastOneRequired(config: ValidateAtLeastOneRequiredConfig): ValidatorFn {
  return (formGroup: AbstractControl): ValidationErrors | null => {
    const { keys, checkFalse } = config;

    if (!formGroup) {
      return { atLeastOneRequired: true };
    }

    const controlValues = keys.map((key) => formGroup.get(key)?.value);

    console.log(controlValues);

    const areAllFalsy = controlValues.every(
      (value) =>
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0) ||
        (checkFalse && value === false),
    );

    console.log(areAllFalsy);

    if (areAllFalsy) {
      return { atLeastOneRequired: true };
    }

    return null;
  };
}
