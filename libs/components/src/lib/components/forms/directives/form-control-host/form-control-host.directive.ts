import { Directive, forwardRef, inject, InjectionToken } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { createReactiveBindings, DestroyService } from '@ethlete/core';
import { combineLatest, map } from 'rxjs';
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

export const FORM_CONTROL_HOST_TOKEN = new InjectionToken<FormControlHostDirective>(
  'ET_FORM_CONTROL_HOST_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  providers: [
    provideInputStateServiceIfNotProvided(),
    FORM_CONTROL_HOST_VALUE_ACCESSOR,
    DestroyService,
    {
      provide: FORM_CONTROL_HOST_TOKEN,
      useExisting: FormControlHostDirective,
    },
  ],
})
export class FormControlHostDirective implements ControlValueAccessor {
  private readonly _inputStateService = inject(InputStateService);

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
      observable: this._inputStateService.value$.pipe(map((value) => !!value)),
    },
    {
      attribute: 'class.et-empty',
      observable: combineLatest([this._inputStateService.value$, this._inputStateService.autofilled$]).pipe(
        map(([value, autofilled]) => (value === null || value === undefined || value === '') && !autofilled),
      ),
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
