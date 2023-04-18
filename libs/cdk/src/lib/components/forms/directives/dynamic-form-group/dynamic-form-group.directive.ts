import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, InjectionToken, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export const DYNAMIC_FORM_GROUP_TOKEN = new InjectionToken<DynamicFormGroupDirective>(
  'ET_DYNAMIC_FORM_GROUP_DIRECTIVE_TOKEN',
);

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
