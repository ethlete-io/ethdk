import { Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { signalHostClasses } from '@ethlete/core';
import { InputStateService } from '../../services';
import { InputTouchedFn, InputValueChangeFn } from '../../types';

export const WRITEABLE_INPUT_TOKEN = new InjectionToken<WriteableInputDirective>('ET_WRITEABLE_INPUT_DIRECTIVE_TOKEN');

export const WRITEABLE_INPUT_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => WriteableInputDirective),
  multi: true,
};

@Directive({
  exportAs: 'etWriteableInput',
  providers: [
    WRITEABLE_INPUT_VALUE_ACCESSOR,
    InputStateService,
    { provide: WRITEABLE_INPUT_TOKEN, useExisting: WriteableInputDirective },
  ],
})
export class WriteableInputDirective implements ControlValueAccessor {
  readonly _inputStateService = inject(InputStateService);

  readonly hostClassBindings = signalHostClasses({
    'et-required': this._inputStateService.required,
    'et-disabled': this._inputStateService.disabled,
    'et-value-is-truthy': this._inputStateService.valueIsTruthy,
    'et-value-is-falsy': this._inputStateService.valueIsFalsy,
    'et-empty': this._inputStateService.valueIsEmpty,
    'et-should-display-error': this._inputStateService.shouldDisplayError,
    'et-autofilled': this._inputStateService.autofilled,
    'et-native-input-is-never-empty': this._inputStateService.isNeverEmptyInput,
  });

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
