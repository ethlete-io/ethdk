import { Directive, InjectionToken, inject } from '@angular/core';
import { FILTER_OVERLAY_REF } from '../../constants';

export const FILTER_OVERLAY_BACK_OR_CLOSE_TOKEN = new InjectionToken<FilterOverlayBackOrCloseDirective>(
  'FILTER_OVERLAY_BACK_OR_CLOSE_TOKEN',
);

@Directive({
  selector: '[etFilterOverlayBackOrClose]',
  standalone: true,
  providers: [
    {
      provide: FILTER_OVERLAY_BACK_OR_CLOSE_TOKEN,
      useExisting: FilterOverlayBackOrCloseDirective,
    },
  ],
  host: {
    class: 'et-filter-overlay-back-or-close',
    '[class.et-filter-overlay-back-or-close--is-back]': 'filterOverlayRef.canGoBack()',
    '[class.et-filter-overlay-back-or-close--is-close]': '!filterOverlayRef.canGoBack()',
    '(click)': 'navigate()',
    type: 'button',
  },
})
export class FilterOverlayBackOrCloseDirective {
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  protected navigate() {
    if (this.filterOverlayRef.canGoBack()) {
      this.filterOverlayRef.goBack();
    } else {
      this.filterOverlayRef.close();
    }
  }
}
