import { Component, ViewEncapsulation } from '@angular/core';
import { AccordionGroupDirective } from './headless';

/**
 * A stack of `<et-accordion>`s: separated by hairlines, optionally single-open, and navigable between
 * headers with the arrow keys (via the headless {@link AccordionGroupDirective}).
 *
 * @example
 * <et-accordion-group autoCloseOthers>
 *   <et-accordion label="Shipping">Ships in 2–4 days.</et-accordion>
 *   <et-accordion label="Returns">30 days, no questions asked.</et-accordion>
 * </et-accordion-group>
 */
@Component({
  selector: 'et-accordion-group',
  template: '<ng-content />',
  styleUrl: './accordion-group.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: AccordionGroupDirective,
      inputs: ['autoCloseOthers', 'arrowKeyNavigation'],
    },
  ],
  host: {
    class: 'et-accordion-group',
  },
})
export class AccordionGroupComponent {}
