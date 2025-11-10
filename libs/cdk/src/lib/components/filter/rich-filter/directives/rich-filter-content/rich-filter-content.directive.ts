import { Directive, InjectionToken, inject } from '@angular/core';
import { ObserveVisibilityDirective } from '@ethlete/core';

export const RICH_FILTER_CONTENT_TOKEN = new InjectionToken<RichFilterContentDirective>('RICH_FILTER_CONTENT_TOKEN');

@Directive({
  selector: '[etRichFilterContent]',

  providers: [
    {
      provide: RICH_FILTER_CONTENT_TOKEN,
      useExisting: RichFilterContentDirective,
    },
  ],
  hostDirectives: [ObserveVisibilityDirective],
})
export class RichFilterContentDirective {
  readonly visibilityObserver = inject(ObserveVisibilityDirective);
}
