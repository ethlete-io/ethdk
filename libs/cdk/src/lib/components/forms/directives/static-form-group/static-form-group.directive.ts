import { Directive, InjectionToken } from '@angular/core';
import { FormGroupStateService } from '../../services';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const STATIC_FORM_GROUP_TOKEN = new InjectionToken<StaticFormGroupDirective>(
  'ET_STATIC_FORM_GROUP_DIRECTIVE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  exportAs: 'etStaticFormGroup',
  providers: [
    FormGroupStateService,
    {
      provide: STATIC_FORM_GROUP_TOKEN,
      useExisting: StaticFormGroupDirective,
    },
  ],
})
export class StaticFormGroupDirective {}
