import { Directive, InjectionToken } from '@angular/core';
import { signalHostElementIntersection } from '@ethlete/core';

export const RICH_FILTER_BUTTON_SLOT_TOKEN = new InjectionToken<RichFilterButtonSlotDirective>(
  'RICH_FILTER_BUTTON_SLOT_TOKEN',
);

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'et-rich-filter-button-slot',
  providers: [
    {
      provide: RICH_FILTER_BUTTON_SLOT_TOKEN,
      useExisting: RichFilterButtonSlotDirective,
    },
  ],
})
export class RichFilterButtonSlotDirective {
  intersection = signalHostElementIntersection();
}
