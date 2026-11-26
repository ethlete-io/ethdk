import { Directive, InjectionToken, Input, booleanAttribute } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const DYNAMIC_FORM_FIELD_TOKEN = new InjectionToken<DynamicFormFieldDirective>(
  'ET_DYNAMIC_FORM_FIELD_DIRECTIVE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
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
