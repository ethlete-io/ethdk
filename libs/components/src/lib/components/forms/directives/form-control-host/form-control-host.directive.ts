import { Directive, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  InputStateService,
  InputTouchedFn,
  InputValueChangeFn,
  provideInputStateServiceIfNotProvided,
} from '../../services';

export const FORM_CONTROL_HOST_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => FormControlHostDirective),
  multi: true,
};

@Directive({
  standalone: true,
  providers: [provideInputStateServiceIfNotProvided(), FORM_CONTROL_HOST_VALUE_ACCESSOR],
})
export class FormControlHostDirective implements ControlValueAccessor {
  private readonly _inputStateService = inject(InputStateService);

  writeValue(value: unknown) {
    this._inputStateService.value$.next(value);
  }

  registerOnChange(fn: InputValueChangeFn) {
    this._inputStateService._valueChange = fn;
  }

  registerOnTouched(fn: InputTouchedFn) {
    this._inputStateService._touched = fn;
  }

  setDisabledState?(isDisabled: boolean) {
    this._inputStateService.disabled$.next(isDisabled);
  }
}
