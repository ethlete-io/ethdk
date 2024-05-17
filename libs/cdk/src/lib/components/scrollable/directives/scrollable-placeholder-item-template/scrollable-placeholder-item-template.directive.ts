import { Directive, InjectionToken } from '@angular/core';

export const SCROLLABLE_PLACEHOLDER_ITEM_TEMPLATE_TOKEN =
  new InjectionToken<ScrollablePlaceholderItemTemplateDirective>('SCROLLABLE_PLACEHOLDER_ITEM_TEMPLATE_TOKEN');

@Directive({
  selector: 'ng-template[etScrollablePlaceholderItemTemplate]',
  standalone: true,
  providers: [
    {
      provide: SCROLLABLE_PLACEHOLDER_ITEM_TEMPLATE_TOKEN,
      useExisting: ScrollablePlaceholderItemTemplateDirective,
    },
  ],
})
export class ScrollablePlaceholderItemTemplateDirective {}
