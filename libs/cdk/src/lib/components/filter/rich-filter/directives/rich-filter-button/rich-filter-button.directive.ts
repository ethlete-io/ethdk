import { Directive, ElementRef, InjectionToken, inject } from '@angular/core';

export const RICH_FILTER_BUTTON_TOKEN = new InjectionToken<RichFilterButtonDirective>('RICH_FILTER_BUTTON_TOKEN');

@Directive({
  selector: '[etRichFilterButton]',

  providers: [
    {
      provide: RICH_FILTER_BUTTON_TOKEN,
      useExisting: RichFilterButtonDirective,
    },
  ],
  host: {
    class: 'et-rich-filter-button',
  },
})
export class RichFilterButtonDirective {
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
}
