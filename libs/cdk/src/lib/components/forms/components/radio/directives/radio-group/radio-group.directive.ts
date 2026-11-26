import { Directive, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes } from '@ethlete/core';
import { FormGroupStateService } from '../../../../services';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const RADIO_GROUP_TOKEN = new InjectionToken<RadioGroupDirective>('ET_RADIO_GROUP_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  providers: [{ provide: RADIO_GROUP_TOKEN, useExisting: RadioGroupDirective }],
  exportAs: 'etRadioGroup',
  host: {
    role: 'radiogroup',
  },
})
export class RadioGroupDirective {
  private readonly _formGroupStateService = inject(FormGroupStateService);

  readonly name = `et-radio-group-${++nextUniqueId}`;

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-labelledby': toSignal(this._formGroupStateService.describedBy$),
  });
}
