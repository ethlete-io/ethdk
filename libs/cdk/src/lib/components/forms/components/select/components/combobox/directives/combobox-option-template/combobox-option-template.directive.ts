import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const COMBOBOX_OPTION_TEMPLATE_TOKEN = new InjectionToken<ComboboxOptionTemplateDirective>(
  'ET_COMBOBOX_OPTION_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etComboboxOptionTemplate]',

  exportAs: 'etComboboxOptionTemplate',
  providers: [
    {
      provide: COMBOBOX_OPTION_TEMPLATE_TOKEN,
      useExisting: ComboboxOptionTemplateDirective,
    },
  ],
})
export class ComboboxOptionTemplateDirective {
  readonly template = inject(TemplateRef);
}
