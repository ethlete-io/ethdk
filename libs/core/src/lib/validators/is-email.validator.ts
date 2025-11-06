import { AbstractControl, ValidationErrors } from '@angular/forms';

export const IS_EMAIL = 'isEmail';

export const IsEmail = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (!value) {
    return null;
  }

  const regex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  return regex.test(value) ? null : { [IS_EMAIL]: true };
};
