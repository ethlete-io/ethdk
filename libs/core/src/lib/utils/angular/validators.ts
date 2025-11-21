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

export const IS_ARRAY_NOT_EMPTY = 'isArrayNotEmpty';

export const IsArrayNotEmpty = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (!value) {
    return null;
  }

  return value.length > 0 ? null : { [IS_ARRAY_NOT_EMPTY]: true };
};

export const IS_EMAIL = 'isEmail';

export const IsEmail = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (!value) {
    return null;
  }

  const regex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  return regex.test(value) ? null : { [IS_EMAIL]: true };
};

export const MUST_MATCH = 'mustMatch';

export const MustMatch = (controlName: string, matchingControlName: string) => {
  return (formGroup: AbstractControl) => {
    const control = formGroup.get(controlName);
    const matchingControl = formGroup.get(matchingControlName);

    if (matchingControl?.errors && !matchingControl.errors[MUST_MATCH]) {
      return null;
    }

    if (control?.value !== matchingControl?.value) {
      matchingControl?.setErrors({ [MUST_MATCH]: true });
      return { [MUST_MATCH]: true };
    } else {
      matchingControl?.setErrors(null);
      return null;
    }
  };
};

export const Validators = {
  MustMatch,
  IsEmail,
  IsArrayNotEmpty,
  ValidateAtLeastOneRequired,
} as const;
