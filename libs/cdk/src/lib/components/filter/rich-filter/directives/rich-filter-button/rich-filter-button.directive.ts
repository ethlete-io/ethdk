import { Directive, ElementRef, InjectionToken, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const RICH_FILTER_BUTTON_TOKEN = new InjectionToken<RichFilterButtonDirective>('RICH_FILTER_BUTTON_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etRichFilterButton]',

  providers: [
    {
      provide: RICH_FILTER_BUTTON_TOKEN,
      useExisting: RichFilterButtonDirective,
    },
  ],
  host: {
    class: 'et-rich-filter-button et-legacy',
  },
})
export class RichFilterButtonDirective {
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
}
