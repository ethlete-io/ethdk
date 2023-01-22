import { Directive, InjectionToken } from '@angular/core';
import { FormControlHostDirective } from '../../../../directives';
import { InputStateService } from '../../../../services';

export const RADIO_GROUP_TOKEN = new InjectionToken<RadioGroupDirective>('ET_RADIO_GROUP_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_GROUP_TOKEN, useExisting: RadioGroupDirective }, InputStateService],
  exportAs: 'etRadioGroup',
  host: {
    role: 'radiogroup',
  },
  hostDirectives: [FormControlHostDirective],
})
export class RadioGroupDirective {
  readonly name = `et-radio-group-${++nextUniqueId}`;
}
