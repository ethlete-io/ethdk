import { Directive, InjectionToken } from '@angular/core';

export const FILTER_OVERLAY_SUBMIT_TOKEN = new InjectionToken<FilterOverlaySubmitDirective>(
  'FILTER_OVERLAY_SUBMIT_TOKEN',
);

@Directive({
  selector: '[etFilterOverlaySubmit]',
  standalone: true,
  providers: [
    {
      provide: FILTER_OVERLAY_SUBMIT_TOKEN,
      useExisting: FilterOverlaySubmitDirective,
    },
  ],
})
export class FilterOverlaySubmitDirective {}
