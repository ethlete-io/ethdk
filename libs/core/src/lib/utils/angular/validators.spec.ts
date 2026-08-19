import { FormControl, FormGroup, Validators } from '@angular/forms';
import { IsArrayNotEmpty, IsEmail, MustMatch } from './validators';

describe('Ethlete validators', () => {
  it.each(['John@example.com', 'john@Example.COM'])('accepts uppercase characters in %s', (email) => {
    expect(IsEmail(new FormControl(email))).toBeNull();
  });

  it('ignores values outside the validator domain', () => {
    expect(IsEmail(new FormControl(42))).toBeNull();
    expect(IsArrayNotEmpty(new FormControl(42))).toBeNull();
  });

  it('requires arrays to contain an item', () => {
    expect(IsArrayNotEmpty(new FormControl([]))).toEqual({ isArrayNotEmpty: true });
    expect(IsArrayNotEmpty(new FormControl(['item']))).toBeNull();
  });

  it('does not clear errors belonging to the matching control', () => {
    const form = new FormGroup(
      {
        password: new FormControl('secret'),
        confirmation: new FormControl('', Validators.required),
      },
      MustMatch('password', 'confirmation'),
    );

    expect(form.errors).toEqual({ mustMatch: true });
    expect(form.controls.confirmation.errors).toEqual({ required: true });

    form.controls.password.setValue('');

    expect(form.errors).toBeNull();
    expect(form.controls.confirmation.errors).toEqual({ required: true });
  });
});
