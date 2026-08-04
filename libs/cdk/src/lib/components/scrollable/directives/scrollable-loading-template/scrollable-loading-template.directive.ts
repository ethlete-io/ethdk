import { Directive, InjectionToken, TemplateRef, computed, inject, input, numberAttribute } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SCROLLABLE_LOADING_TEMPLATE_TOKEN = new InjectionToken<ScrollableLoadingTemplateDirective>(
  'SCROLLABLE_LOADING_TEMPLATE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'ng-template[etScrollableLoadingTemplate]',

  providers: [
    {
      provide: SCROLLABLE_LOADING_TEMPLATE_TOKEN,
      useExisting: ScrollableLoadingTemplateDirective,
    },
  ],
})
export class ScrollableLoadingTemplateDirective {
  templateRef = inject(TemplateRef);

  repeatContentCount = input(1, { transform: numberAttribute });

  repeat = computed(() => Array.from({ length: this.repeatContentCount() }));
}
