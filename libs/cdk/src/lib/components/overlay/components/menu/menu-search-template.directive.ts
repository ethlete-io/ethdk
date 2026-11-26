import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const MENU_SEARCH_TEMPLATE_TOKEN = new InjectionToken<MenuSearchTemplateDirective>('MENU_SEARCH_TEMPLATE_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
