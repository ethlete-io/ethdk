import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const COMBOBOX_BODY_EMPTY_TEMPLATE_TOKEN = new InjectionToken<ComboboxBodyEmptyTemplateDirective>(
  'ET_COMBOBOX_BODY_EMPTY_TEMPLATE_TOKEN',
);

@Directive({
  selector: 'ng-template[etComboboxBodyEmptyTemplate]',
  standalone: true,
  exportAs: 'etComboboxBodyEmptyTemplate',
  providers: [
    {
      provide: COMBOBOX_BODY_EMPTY_TEMPLATE_TOKEN,
      useExisting: ComboboxBodyEmptyTemplateDirective,
    },
  ],
})
export class ComboboxBodyEmptyTemplateDirective {
  readonly template = inject(TemplateRef);
}
