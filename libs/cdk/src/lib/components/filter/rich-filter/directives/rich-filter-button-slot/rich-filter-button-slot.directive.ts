import { Directive, InjectionToken } from '@angular/core';
import { signalHostElementIntersection } from '@ethlete/core';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const RICH_FILTER_BUTTON_SLOT_TOKEN = new InjectionToken<RichFilterButtonSlotDirective>(
  'RICH_FILTER_BUTTON_SLOT_TOKEN',
);

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
