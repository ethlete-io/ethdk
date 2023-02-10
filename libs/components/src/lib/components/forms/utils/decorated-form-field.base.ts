import { Directive, inject } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { FormFieldStateService } from '../services';

@Directive()
export class DecoratedFormFieldBase {
  private readonly _formFieldStateService = inject(FormFieldStateService);

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-form-field--has-prefix',
      observable: this._formFieldStateService.hasPrefix$,
    },
    {
      attribute: 'class.et-form-field--has-suffix',
      observable: this._formFieldStateService.hasSuffix$,
    },
  );
}
