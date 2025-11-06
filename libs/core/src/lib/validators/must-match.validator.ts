import { AbstractControl } from '@angular/forms';

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
