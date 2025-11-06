import { Directive, inject } from '@angular/core';
import { signalHostClasses } from '@ethlete/core';
import { FormFieldStateService } from '../services';

@Directive()
export class DecoratedFormFieldBase {
  private readonly _formFieldStateService = inject(FormFieldStateService);

  readonly hostClassBindings = signalHostClasses({
    'et-form-field--has-prefix': this._formFieldStateService.hasPrefix,
    'et-form-field--has-suffix': this._formFieldStateService.hasSuffix,
  });
}
