import { Directive, inject, InjectionToken } from '@angular/core';
import { CHECKBOX_TOKEN } from '../checkbox';

export const CHECKBOX_GROUP_CONTROL_TOKEN = new InjectionToken<CheckboxGroupControlDirective>(
  'ET_CHECKBOX_GROUP_CONTROL_TOKEN',
);

@Directive({
  selector: '[etCheckboxGroupControl]',
  standalone: true,
  exportAs: 'etCheckboxGroupControl',
  providers: [{ provide: CHECKBOX_GROUP_CONTROL_TOKEN, useExisting: CheckboxGroupControlDirective }],
})
export class CheckboxGroupControlDirective {
  checkbox = inject(CHECKBOX_TOKEN);
}
