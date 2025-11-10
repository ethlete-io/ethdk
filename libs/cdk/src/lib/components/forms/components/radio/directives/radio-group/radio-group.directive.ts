import { Directive, inject, InjectionToken } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes } from '@ethlete/core';
import { FormGroupStateService } from '../../../../services';

export const RADIO_GROUP_TOKEN = new InjectionToken<RadioGroupDirective>('ET_RADIO_GROUP_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

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
