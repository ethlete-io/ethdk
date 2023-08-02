import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const MUST_MATCH = 'mustMatch';

export const MustMatch = (controlName: string, matchingControlName: string): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control;
    if (!formGroup) {
      return { passwordConfirm: true };
    }

    const password = formGroup.get(controlName);
    const passwordConfirm = formGroup.get(matchingControlName);

    // set error on matchingControl if validation fails
    if (formGroup.errors && !formGroup.errors[MUST_MATCH]) {
      return null;
    }

    if (passwordConfirm?.errors && !passwordConfirm.errors[MUST_MATCH]) {
      return null;
    }

    if (!password || !passwordConfirm) {
      return { passwordConfirm: true };
    }

    if (password?.value !== passwordConfirm?.value) {
      passwordConfirm?.setErrors({ [MUST_MATCH]: true });
      return { [MUST_MATCH]: true };
    } else {
      passwordConfirm?.setErrors(null);
      return null;
    }
  };
};
