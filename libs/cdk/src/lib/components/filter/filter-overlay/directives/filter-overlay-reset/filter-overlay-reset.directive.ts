import { Directive, InjectionToken, Input, booleanAttribute, inject } from '@angular/core';
import { FILTER_OVERLAY_REF } from '../../constants';

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
  host: {
    class: 'et-filter-overlay-reset',
    '[class.et-filter-overlay-reset--disabled]': 'disabled',
    '(click)': 'reset()',
    type: 'button',
  },
})
export class FilterOverlayResetDirective {
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  @Input({ transform: booleanAttribute })
  disabled = false;

  reset() {
    if (this.disabled) return;

    this.filterOverlayRef.reset();
  }
}
