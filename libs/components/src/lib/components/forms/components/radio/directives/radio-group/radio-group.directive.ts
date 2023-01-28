import { Directive, InjectionToken } from '@angular/core';

export const RADIO_GROUP_TOKEN = new InjectionToken<RadioGroupDirective>('ET_RADIO_GROUP_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

@Directive({
  standalone: true,
  providers: [{ provide: RADIO_GROUP_TOKEN, useExisting: RadioGroupDirective }],
  exportAs: 'etRadioGroup',
  host: {
    role: 'radiogroup',
  },
})
export class RadioGroupDirective {
  readonly name = `et-radio-group-${++nextUniqueId}`;
}
