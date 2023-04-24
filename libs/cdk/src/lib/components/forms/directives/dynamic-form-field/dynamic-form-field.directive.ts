import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, InjectionToken, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const DYNAMIC_FORM_FIELD_TOKEN = new InjectionToken<DynamicFormFieldDirective>(
  'ET_DYNAMIC_FORM_FIELD_DIRECTIVE_TOKEN',
);

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
