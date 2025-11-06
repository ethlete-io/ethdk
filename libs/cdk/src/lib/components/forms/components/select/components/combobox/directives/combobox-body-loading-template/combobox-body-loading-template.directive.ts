import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const COMBOBOX_BODY_LOADING_TEMPLATE_TOKEN = new InjectionToken<ComboboxBodyLoadingTemplateDirective>(
  'ET_COMBOBOX_BODY_LOADING_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etComboboxBodyLoadingTemplate]',
  standalone: true,
  exportAs: 'etComboboxBodyLoadingTemplate',
  providers: [
    {
      provide: COMBOBOX_BODY_LOADING_TEMPLATE_TOKEN,
      useExisting: ComboboxBodyLoadingTemplateDirective,
    },
  ],
})
export class ComboboxBodyLoadingTemplateDirective {
  readonly template = inject(TemplateRef);
}
