import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SLIDER_THUMB_CONTENT_TEMPLATE_TOKEN = new InjectionToken<SliderThumbContentTemplateDirective>(
  'ET_SLIDER_THUMB_CONTENT_TEMPLATE_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'ng-template[etSliderThumbContentTemplate]',
  exportAs: 'etSliderThumbContentTemplate',
  providers: [
    {
      provide: SLIDER_THUMB_CONTENT_TEMPLATE_TOKEN,
      useExisting: SliderThumbContentTemplateDirective,
    },
  ],
})
export class SliderThumbContentTemplateDirective {
  readonly template = inject(TemplateRef);
}
