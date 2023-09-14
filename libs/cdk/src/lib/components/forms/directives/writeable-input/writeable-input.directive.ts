import { Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { createReactiveBindings } from '@ethlete/core';
import { map } from 'rxjs';
import { InputStateService } from '../../services';
import { InputTouchedFn, InputValueChangeFn } from '../../types';

export const WRITEABLE_INPUT_TOKEN = new InjectionToken<WriteableInputDirective>('ET_WRITEABLE_INPUT_DIRECTIVE_TOKEN');

export const WRITEABLE_INPUT_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => WriteableInputDirective),
  multi: true,
};

@Directive({
  standalone: true,
  exportAs: 'etWriteableInput',
  providers: [
    WRITEABLE_INPUT_VALUE_ACCESSOR,

    InputStateService,
    { provide: WRITEABLE_INPUT_TOKEN, useExisting: WriteableInputDirective },
  ],
})
export class WriteableInputDirective implements ControlValueAccessor {
  readonly _inputStateService = inject(InputStateService);

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-required',
      observable: this._inputStateService.required$,
    },
    {
      attribute: 'class.et-disabled',
      observable: this._inputStateService.disabled$,
    },
    {
      attribute: 'class.et-value-is-truthy',
      observable: this._inputStateService.valueIsTruthy$,
    },
    {
      attribute: 'class.et-value-is-falsy',
      observable: this._inputStateService.valueIsFalsy$,
    },
    {
      attribute: 'class.et-empty',
      observable: this._inputStateService.valueIsEmpty$,
    },
    {
      attribute: 'class.et-has-value',
      observable: this._inputStateService.valueIsEmpty$.pipe(map((v) => !v)),
    },
    {
      attribute: 'class.et-should-display-error',
      observable: this._inputStateService.shouldDisplayError$,
    },
    {
      attribute: 'class.et-autofilled',
      observable: this._inputStateService.autofilled$,
    },
  );

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
