import { Directive, InjectionToken, inject } from '@angular/core';
import { ObserveVisibilityDirective } from '@ethlete/core';

export const RICH_FILTER_BUTTON_SLOT_TOKEN = new InjectionToken<RichFilterButtonSlotDirective>(
  'RICH_FILTER_BUTTON_SLOT_TOKEN',
);

@Directive({
  selector: 'et-rich-filter-button-slot',

  providers: [
    {
      provide: RICH_FILTER_BUTTON_SLOT_TOKEN,
      useExisting: RichFilterButtonSlotDirective,
    },
  ],
  hostDirectives: [ObserveVisibilityDirective],
})
export class RichFilterButtonSlotDirective {
  readonly visibilityObserver = inject(ObserveVisibilityDirective);
}
