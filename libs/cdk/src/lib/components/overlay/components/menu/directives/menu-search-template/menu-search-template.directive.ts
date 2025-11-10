import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const MENU_SEARCH_TEMPLATE_TOKEN = new InjectionToken<MenuSearchTemplateDirective>('MENU_SEARCH_TEMPLATE_TOKEN');

@Directive({
  selector: 'ng-template[etMenuSearchTemplate]',

  providers: [
    {
      provide: MENU_SEARCH_TEMPLATE_TOKEN,
      useExisting: MenuSearchTemplateDirective,
    },
  ],
})
export class MenuSearchTemplateDirective {
  templateRef = inject(TemplateRef);
}
