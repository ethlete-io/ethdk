import { Component, computed, ViewEncapsulation, booleanAttribute, input } from '@angular/core';
import { injectAccordionConfig } from './accordion-config';
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
      inputs: ['autoCloseOthers', 'preventCloseLast', 'arrowKeyNavigation'],
    },
  ],
  host: {
    class: 'et-accordion-group',
    '[attr.data-last-divider]': 'lastDividerResolved() || null',
  },
})
export class AccordionGroupComponent {
  private config = injectAccordionConfig();

  /** Keep the hairline under the last accordion, which the group drops by default. */
  public lastDivider = input<boolean | undefined, unknown>(undefined, {
    transform: (v: unknown) => (v === undefined ? undefined : booleanAttribute(v)),
  });

  protected lastDividerResolved = computed(() => this.lastDivider() ?? this.config?.lastDivider ?? false);
}
