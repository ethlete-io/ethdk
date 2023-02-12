import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, forwardRef, InjectionToken, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StaticFormGroupDirective } from '../static-form-group';
import { WriteableInputDirective } from '../writeable-input';

export const DYNAMIC_FORM_GROUP_TOKEN = new InjectionToken<DynamicFormGroupDirective>(
  'ET_DYNAMIC_FORM_GROUP_DIRECTIVE_TOKEN',
);

export const DYNAMIC_FORM_GROUP_DIRECTIVE_PUBLIC_API = [
  StaticFormGroupDirective,
  WriteableInputDirective,
  {
    directive: forwardRef(() => DynamicFormGroupDirective),
    inputs: ['hideErrorMessage'],
  },
];

@Directive({
  standalone: true,
  exportAs: 'etDynamicFormGroup',
  providers: [
    {
      provide: DYNAMIC_FORM_GROUP_TOKEN,
      useExisting: DynamicFormGroupDirective,
    },
  ],
})
export class DynamicFormGroupDirective {
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
