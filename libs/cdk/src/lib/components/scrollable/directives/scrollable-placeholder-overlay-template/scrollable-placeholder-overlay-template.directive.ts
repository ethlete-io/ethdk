import { Directive, InjectionToken } from '@angular/core';

export const SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN =
  new InjectionToken<ScrollablePlaceholderOverlayTemplateDirective>('SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN');

@Directive({
  selector: 'ng-template[etScrollablePlaceholderOverlayTemplate]',
  standalone: true,
  providers: [
    {
      provide: SCROLLABLE_PLACEHOLDER_OVERLAY_TEMPLATE_TOKEN,
      useExisting: ScrollablePlaceholderOverlayTemplateDirective,
    },
  ],
})
export class ScrollablePlaceholderOverlayTemplateDirective {}
