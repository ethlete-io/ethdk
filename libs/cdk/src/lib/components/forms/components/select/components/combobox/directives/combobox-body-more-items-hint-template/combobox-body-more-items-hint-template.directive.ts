import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const COMBOBOX_BODY_MORE_ITEMS_HINT_TEMPLATE_TOKEN =
  new InjectionToken<ComboboxBodyMoreItemsHintTemplateDirective>('ET_COMBOBOX_BODY_MORE_ITEMS_HINT_TEMPLATE_TOKEN');

@Directive({
  selector: 'ng-template[etComboboxBodyMoreItemsHintTemplate]',

  exportAs: 'etComboboxBodyMoreItemsHintTemplate',
  providers: [
    {
      provide: COMBOBOX_BODY_MORE_ITEMS_HINT_TEMPLATE_TOKEN,
      useExisting: ComboboxBodyMoreItemsHintTemplateDirective,
    },
  ],
})
export class ComboboxBodyMoreItemsHintTemplateDirective {
  readonly template = inject(TemplateRef);
}
