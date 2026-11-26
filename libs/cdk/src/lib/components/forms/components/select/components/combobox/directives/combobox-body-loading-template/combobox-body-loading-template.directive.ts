import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const COMBOBOX_BODY_LOADING_TEMPLATE_TOKEN = new InjectionToken<ComboboxBodyLoadingTemplateDirective>(
  'ET_COMBOBOX_BODY_LOADING_TEMPLATE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'ng-template[etComboboxBodyLoadingTemplate]',

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
