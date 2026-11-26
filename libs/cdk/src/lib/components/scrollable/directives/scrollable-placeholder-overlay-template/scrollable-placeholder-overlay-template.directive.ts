import { Directive, InjectionToken } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN =
  new InjectionToken<ScrollablePlaceholderOverlayTemplateDirective>('SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'ng-template[etScrollablePlaceholderOverlayTemplate]',

  providers: [
    {
      provide: SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN,
      useExisting: ScrollablePlaceholderOverlayTemplateDirective,
    },
  ],
})
export class ScrollablePlaceholderOverlayTemplateDirective {}
