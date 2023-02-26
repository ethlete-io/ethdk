import { AbstractControl, ValidationErrors } from '@angular/forms';

export const IS_ARRAY_NOT_EMPTY = 'isArrayNotEmpty';

export const IsArrayNotEmpty = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (!value) {
    return null;
  }

  return value.length > 0 ? null : { [IS_ARRAY_NOT_EMPTY]: true };
};
