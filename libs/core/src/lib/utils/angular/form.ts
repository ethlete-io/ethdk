import { AbstractControl, FormArray, FormControl, FormGroup } from '@angular/forms';

export const cloneFormGroup = <T extends FormGroup<any>>(formGroup: T) => {
  const cloneControl = (control: AbstractControl): AbstractControl => {
    let clonedControl: AbstractControl;

    if (control instanceof FormGroup) {
      const controls = Object.fromEntries(
        Object.entries(control.controls).map(([key, child]) => [key, cloneControl(child)]),
      );
      clonedControl = new FormGroup(controls, control.validator, control.asyncValidator);
    } else if (control instanceof FormArray) {
      clonedControl = new FormArray(
        control.controls.map((child) => cloneControl(child)),
        control.validator,
        control.asyncValidator,
      );
    } else {
      clonedControl = new FormControl(
        { value: control.value, disabled: control.disabled },
        control.validator,
        control.asyncValidator,
      );
    }

    if (control.disabled && clonedControl.enabled) {
      clonedControl.disable({ emitEvent: false });
    }

    return clonedControl;
  };

  const clonedForm = cloneControl(formGroup) as T;
  clonedForm.updateValueAndValidity();

  return clonedForm as T;
};

export const getFormGroupValue = <T extends FormGroup>(formGroup: T) => {
  const getControlValue = (control: AbstractControl): unknown => {
    if (control instanceof FormGroup) {
      return getFormGroupValue(control);
    }

    if (control instanceof FormArray) {
      return control.controls.map(getControlValue);
    }

    return control.value ?? null;
  };

  const value: Record<string, unknown> = {};

  Object.entries(formGroup.controls).forEach(([key, control]) => {
    value[key] = getControlValue(control);
  });

  return value;
};
