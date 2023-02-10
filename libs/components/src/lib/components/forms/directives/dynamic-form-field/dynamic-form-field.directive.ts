import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, forwardRef, InjectionToken, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StaticFormFieldDirective } from '../static-form-field';
import { WriteableInputDirective } from '../writeable-input';

export const DYNAMIC_FORM_FIELD_TOKEN = new InjectionToken<DynamicFormFieldDirective>(
  'ET_DYNAMIC_FORM_FIELD_DIRECTIVE_TOKEN',
);

export const DYNAMIC_FORM_FIELD_DIRECTIVE_PUBLIC_API = [
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
  private readonly _explicitlyHideErrorMessage$ = new BehaviorSubject(false);
}
