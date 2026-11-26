import { Directive, ElementRef, InjectionToken, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const RICH_FILTER_TOP_TOKEN = new InjectionToken<RichFilterTopDirective>('RICH_FILTER_TOP_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: '[etRichFilterTop]',

  providers: [
    {
      provide: RICH_FILTER_TOP_TOKEN,
      useExisting: RichFilterTopDirective,
    },
  ],
})
export class RichFilterTopDirective {
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
}
