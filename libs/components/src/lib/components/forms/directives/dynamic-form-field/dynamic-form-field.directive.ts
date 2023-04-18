import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, InjectionToken, Input, forwardRef } from '@angular/core';
import { HostDirective } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';
import { StaticFormFieldDirective } from '../static-form-field';
import { WriteableInputDirective } from '../writeable-input';

export const DYNAMIC_FORM_FIELD_TOKEN = new InjectionToken<DynamicFormFieldDirective>(
  'ET_DYNAMIC_FORM_FIELD_DIRECTIVE_TOKEN',
);

export const DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API: HostDirective[] = [
  StaticFormFieldDirective,
  WriteableInputDirective,
  {
    directive: forwardRef(() => DynamicFormFieldDirective),
    inputs: ['hideErrorMessage'],
  },
];

@Directive({
  standalone: true,
  exportAs: 'etDynamicFormField',
  providers: [
    {
      provide: DYNAMIC_FORM_FIELD_TOKEN,
      useExisting: DynamicFormFieldDirective,
    },
  ],
})
export class DynamicFormFieldDirective {
  @Input()
  get hideErrorMessage(): boolean {
    return this._explicitlyHideErrorMessage$.getValue();
  }
  set hideErrorMessage(value: BooleanInput) {
    this._explicitlyHideErrorMessage$.next(coerceBooleanProperty(value));
  }
  get hideErrorMessage$() {
    return this._explicitlyHideErrorMessage$.asObservable();
  }
  private readonly _explicitlyHideErrorMessage$ = new BehaviorSubject(false);
}
