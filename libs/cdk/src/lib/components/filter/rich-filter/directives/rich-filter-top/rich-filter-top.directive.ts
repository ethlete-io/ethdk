import { Directive, ElementRef, InjectionToken, inject } from '@angular/core';

export const RICH_FILTER_TOP_TOKEN = new InjectionToken<RichFilterTopDirective>('RICH_FILTER_TOP_TOKEN');

@Directive({
  selector: '[etRichFilterTop]',
  standalone: true,
  providers: [
    {
      provide: RICH_FILTER_TOP_TOKEN,
      useExisting: RichFilterTopDirective,
    },
  ],
})
export class RichFilterTopDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
}
