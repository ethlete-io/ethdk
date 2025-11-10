import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const COMBOBOX_SELECTED_OPTION_TEMPLATE_TOKEN = new InjectionToken<ComboboxSelectedOptionTemplateDirective>(
  'ET_COMBOBOX_SELECTED_OPTION_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etComboboxSelectedOptionTemplate]',

  exportAs: 'etComboboxSelectedOptionTemplate',
  providers: [
    {
      provide: COMBOBOX_SELECTED_OPTION_TEMPLATE_TOKEN,
      useExisting: ComboboxSelectedOptionTemplateDirective,
    },
  ],
})
export class ComboboxSelectedOptionTemplateDirective {
  readonly template = inject(TemplateRef);
}
