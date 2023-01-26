import { Directive, InjectionToken } from '@angular/core';
import { FormControlHostDirective } from '../../../../directives';
import { FormFieldStateService, FORM_GROUP_STATE_SERVICE_TOKEN, InputStateService } from '../../../../services';

export const RADIO_GROUP_TOKEN = new InjectionToken<RadioGroupDirective>('ET_RADIO_GROUP_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

@Directive({
  standalone: true,
  providers: [
    { provide: RADIO_GROUP_TOKEN, useExisting: RadioGroupDirective },
    InputStateService,
    { provide: FORM_GROUP_STATE_SERVICE_TOKEN, useClass: FormFieldStateService },
  ],
  exportAs: 'etRadioGroup',
  host: {
    role: 'radiogroup',
  },
  hostDirectives: [FormControlHostDirective],
})
export class RadioGroupDirective {
  readonly name = `et-radio-group-${++nextUniqueId}`;
}
