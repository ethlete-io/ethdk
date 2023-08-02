import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const MUST_MATCH = 'mustMatch';

export const MustMatch = (controlName: string, matchingControlName: string): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control;
    if (!formGroup) {
      return { passwordConfirm: true };
    }

    // set error on matchingControl if validation fails
    if (formGroup.errors && !formGroup.errors[MUST_MATCH]) {
      return null;
    }

    const password = formGroup.get(controlName);
    const passwordConfirm = formGroup.get(matchingControlName);

    if (!password || !passwordConfirm) {
      return { passwordConfirm: true };
    }

    // set error on matchingControl if validation fails
    if (password.value !== passwordConfirm.value) {
      passwordConfirm.setErrors({ passwordConfirm: true });
      return { passwordConfirm: true };
    }

    return null;
  };
};
