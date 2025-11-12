import { Directive, InjectionToken } from '@angular/core';
import { signalHostElementIntersection } from '@ethlete/core';

export const RICH_FILTER_CONTENT_TOKEN = new InjectionToken<RichFilterContentDirective>('RICH_FILTER_CONTENT_TOKEN');

@Directive({
  selector: '[etRichFilterContent]',

  providers: [
    {
      provide: RICH_FILTER_CONTENT_TOKEN,
      useExisting: RichFilterContentDirective,
    },
  ],
})
export class RichFilterContentDirective {
  intersection = signalHostElementIntersection();
}
