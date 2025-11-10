import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const COMBOBOX_BODY_ERROR_TEMPLATE_TOKEN = new InjectionToken<ComboboxBodyErrorTemplateDirective>(
  'ET_COMBOBOX_BODY_ERROR_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etComboboxBodyErrorTemplate]',

  exportAs: 'etComboboxBodyErrorTemplate',
  providers: [
    {
      provide: COMBOBOX_BODY_ERROR_TEMPLATE_TOKEN,
      useExisting: ComboboxBodyErrorTemplateDirective,
    },
  ],
})
export class ComboboxBodyErrorTemplateDirective {
  readonly template = inject(TemplateRef);
}
