import { Directive, InjectionToken } from '@angular/core';

export const FILTER_OVERLAY_RESET_TOKEN = new InjectionToken<FilterOverlayResetDirective>('FILTER_OVERLAY_RESET_TOKEN');

@Directive({
  selector: '[etFilterOverlayReset]',
  standalone: true,
  providers: [
    {
      provide: FILTER_OVERLAY_RESET_TOKEN,
      useExisting: FilterOverlayResetDirective,
    },
  ],
})
export class FilterOverlayResetDirective {}
