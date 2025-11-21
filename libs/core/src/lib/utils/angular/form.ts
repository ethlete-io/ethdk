import { FormArray, FormControl, FormGroup } from '@angular/forms';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cloneFormGroup = <T extends FormGroup<any>>(formGroup: T) => {
  const cloneLevel = (group: FormGroup, cloneGroup: FormGroup) => {
    Object.keys(group.controls).forEach((key) => {
      const control = group.controls[key]!;

      if (control instanceof FormGroup) {
        const cloneControl = new FormGroup({}, control.validator, control.asyncValidator);

        cloneGroup.addControl(key, cloneControl);

        cloneLevel(control, cloneControl);
      } else if (control instanceof FormArray) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cloneArrayControl = new FormArray<any>([], control.validator, control.asyncValidator);

        control.controls.forEach((control) => {
          if (control instanceof FormGroup) {
            const cloneControl = new FormGroup({}, control.validator, control.asyncValidator);
            const innerClone = cloneLevel(control, cloneControl);
            cloneArrayControl.push(innerClone);
          } else {
            const cloneControlItem = new FormControl(
              { value: control.value, disabled: control.disabled },
              control.validator,
              control.asyncValidator,
            );
            cloneArrayControl.push(cloneControlItem);
          }
        });

        cloneGroup.addControl(key, cloneArrayControl);
      } else {
        const cloneControl = new FormControl(
          { value: control.value, disabled: control.disabled },
          control.validator,
          control.asyncValidator,
        );

        cloneGroup.addControl(key, cloneControl);
      }
    });

    return cloneGroup;
  };

  const clonedForm = cloneLevel(formGroup, new FormGroup({}));
  clonedForm.setValue(formGroup.value);
  clonedForm.updateValueAndValidity();

  return clonedForm as T;
};

export const getFormGroupValue = <T extends FormGroup>(formGroup: T) => {
  const value: Record<string, unknown> = {};

  Object.keys(formGroup.controls).forEach((key) => {
    const control = formGroup.controls[key]!;

    if (control instanceof FormGroup) {
      value[key] = getFormGroupValue(control);
    } else if (control instanceof FormArray) {
      value[key] = control.controls.map((control) => {
        if (control instanceof FormGroup) {
          return getFormGroupValue(control);
        } else {
          return control.value ?? null;
        }
      });
    } else {
      value[key] = control.value ?? null;
    }
  });

  return value;
};
