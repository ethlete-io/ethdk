import { FormGroup } from '@angular/forms';

export const MUST_MATCH = 'mustMatch';

export const MustMatch = (controlName: string, matchingControlName: string) => {
  return (formGroup: FormGroup) => {
    const control = formGroup.controls[controlName];
    const matchingControl = formGroup.controls[matchingControlName];

    // set error on matchingControl if validation fails
    if (matchingControl.errors && !matchingControl.errors[MUST_MATCH]) {
      return;
    }

    // set error on matchingControl if validation fails
    if (control.value !== matchingControl.value) {
      matchingControl.setErrors({ [MUST_MATCH]: true });
    } else {
      matchingControl.setErrors(null);
    }
  };
};
