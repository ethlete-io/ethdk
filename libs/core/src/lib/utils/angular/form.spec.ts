import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { cloneFormGroup, getFormGroupValue } from './form';

describe('form utilities', () => {
  it('deeply clones disabled controls and nested arrays', () => {
    const form = new FormGroup({
      name: new FormControl('Ada', { validators: Validators.required }),
      settings: new FormGroup({ enabled: new FormControl({ value: false, disabled: true }) }),
      rows: new FormArray([new FormArray([new FormControl('one')])]),
    });

    const cloned = cloneFormGroup(form);

    expect(cloned).not.toBe(form);
    expect(cloned.getRawValue()).toEqual(form.getRawValue());
    expect(cloned.controls.settings.controls.enabled.disabled).toBe(true);
    expect(cloned.controls.rows.at(0)).toBeInstanceOf(FormArray);
    expect(cloned.controls.name.validator).toBe(form.controls.name.validator);
  });

  it('reads nested arrays recursively', () => {
    const form = new FormGroup({
      rows: new FormArray([new FormArray([new FormControl('one'), new FormControl(null)])]),
    });

    expect(getFormGroupValue(form)).toEqual({ rows: [['one', null]] });
  });
});
