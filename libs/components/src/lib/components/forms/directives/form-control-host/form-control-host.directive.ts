import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, forwardRef, inject, InjectionToken, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { createReactiveBindings, DestroyService } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import {
  FormFieldStateService,
  FORM_GROUP_STATE_SERVICE_TOKEN,
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
  private readonly _formFieldStateService = inject(FormFieldStateService, { optional: true });
  private readonly _formGroupStateService = inject(FORM_GROUP_STATE_SERVICE_TOKEN, { optional: true });

  @Input()
  get hideErrorMessage(): boolean {
    return this._explicitlyHideErrorMessage$.getValue();
  }
  set hideErrorMessage(value: BooleanInput) {
    this._explicitlyHideErrorMessage$.next(coerceBooleanProperty(value));
  }
  private readonly _explicitlyHideErrorMessage$ = new BehaviorSubject<boolean>(false);

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
  );

  // ngOnInit(): void {
  //   console.log(this._formFieldStateService);
  //   console.log(this._formGroupStateService);
  // }

  // readonly hideErrorMessage$ = combineLatest([
  //   this._inputStateService.errorMessage$,
  //   this._explicitlyHideErrorMessage$,
  // ]).pipe(map(([errorMessage, explicitlyHideErrorMessage]) => !errorMessage || explicitlyHideErrorMessage));

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
