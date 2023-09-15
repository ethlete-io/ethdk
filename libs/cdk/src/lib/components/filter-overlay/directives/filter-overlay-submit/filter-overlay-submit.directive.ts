import { Directive, InjectionToken, Input, booleanAttribute, inject } from '@angular/core';
import { FILTER_OVERLAY_REF } from '../../constants';

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
  host: {
    class: 'et-filter-overlay-submit',
    '[class.et-filter-overlay-submit--disabled]': 'disabled',
    '(click)': 'submit()',
    type: 'submit',
  },
})
export class FilterOverlaySubmitDirective {
  protected readonly filterOverlayRef = inject(FILTER_OVERLAY_REF);

  @Input({ transform: booleanAttribute })
  disabled = false;

  submit() {
    if (this.disabled) return;

    this.filterOverlayRef.submit();
  }
}
