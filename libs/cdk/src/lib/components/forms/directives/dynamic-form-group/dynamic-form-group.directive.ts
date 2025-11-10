import { Directive, InjectionToken, Input, booleanAttribute } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const DYNAMIC_FORM_GROUP_TOKEN = new InjectionToken<DynamicFormGroupDirective>(
  'ET_DYNAMIC_FORM_GROUP_DIRECTIVE_TOKEN',
);

@Directive({
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
  set hideErrorMessage(value: unknown) {
    this._explicitlyHideErrorMessage$.next(booleanAttribute(value));
  }
  get hideErrorMessage$() {
    return this._explicitlyHideErrorMessage$.asObservable();
  }
  private readonly _explicitlyHideErrorMessage$ = new BehaviorSubject(false);
}
