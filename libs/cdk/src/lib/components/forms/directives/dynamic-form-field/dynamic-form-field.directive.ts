import { Directive, InjectionToken, Input, booleanAttribute } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const DYNAMIC_FORM_FIELD_TOKEN = new InjectionToken<DynamicFormFieldDirective>(
  'ET_DYNAMIC_FORM_FIELD_DIRECTIVE_TOKEN',
);

@Directive({
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
  set hideErrorMessage(value: unknown) {
    this._explicitlyHideErrorMessage$.next(booleanAttribute(value));
  }
  get hideErrorMessage$() {
    return this._explicitlyHideErrorMessage$.asObservable();
  }
  private readonly _explicitlyHideErrorMessage$ = new BehaviorSubject(false);
}
