import { Directive, InjectionToken, TemplateRef, inject } from '@angular/core';

export const SLIDER_THUMB_CONTENT_TEMPLATE_TOKEN = new InjectionToken<SliderThumbContentTemplateDirective>(
  'ET_SLIDER_THUMB_CONTENT_TEMPLATE_TOKEN',
);

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
