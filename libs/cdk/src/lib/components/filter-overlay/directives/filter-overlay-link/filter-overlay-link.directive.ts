import { Directive, InjectionToken } from '@angular/core';

export const FILTER_OVERLAY_LINK_TOKEN = new InjectionToken<FilterOverlayLinkDirective>('FILTER_OVERLAY_LINK_TOKEN');

@Directive({
  selector: '[etFilterOverlayLink]',
  standalone: true,
  providers: [
    {
      provide: FILTER_OVERLAY_LINK_TOKEN,
      useExisting: FilterOverlayLinkDirective,
    },
  ],
})
export class FilterOverlayLinkDirective {}
