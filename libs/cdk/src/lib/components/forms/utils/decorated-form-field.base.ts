import { Directive, inject } from '@angular/core';
import { signalHostClasses } from '@ethlete/core';
import { FormFieldStateService } from '../services';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive()
export class DecoratedFormFieldBase {
  private readonly _formFieldStateService = inject(FormFieldStateService);

  readonly hostClassBindings = signalHostClasses({
    'et-form-field--has-prefix': this._formFieldStateService.hasPrefix,
    'et-form-field--has-suffix': this._formFieldStateService.hasSuffix,
  });
}
