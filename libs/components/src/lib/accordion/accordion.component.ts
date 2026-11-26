import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject, input } from '@angular/core';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { AccordionDirective, AccordionPanelDirective, AccordionTriggerDirective } from './headless';

/** The heading level the accordion's header reports to assistive tech. */
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The default disclosure: a header that expands a panel, themed and animated, driven by the headless
 * {@link AccordionDirective}.
 *
 * Works standalone; put several inside an `<et-accordion-group>` for single-open behavior and
 * arrow-key navigation between the headers. Panel content is projected as children - reach for
 * `<ng-template etAccordionContent>` instead when it is expensive enough that it shouldn't exist
 * before the first expand.
 *
 * @example
 * <et-accordion label="Shipping" [(isOpen)]="showsShipping">
 *   Ships in 2–4 days.
 * </et-accordion>
 */
@Component({
  selector: 'et-accordion',
  templateUrl: './accordion.component.html',
  styleUrl: './accordion.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [AccordionPanelDirective, AccordionTriggerDirective, IconDirective, NgTemplateOutlet],
  providers: [provideIcons(CHEVRON_ICON)],
  hostDirectives: [
    {
      directive: AccordionDirective,
      inputs: ['isOpen', 'isOpenByDefault', 'disabled'],
      outputs: ['isOpenChange'],
    },
  ],
  host: {
    class: 'et-accordion',
  },
})
export class AccordionComponent {
  protected accordion = inject(AccordionDirective);

  /** The header text. Use `<ng-template etAccordionLabel>` when the header needs markup instead. */
  public label = input('');

  /**
   * What the header reports as its heading level, so the accordion slots into the page's outline
   * instead of flattening it. The header is a `role="heading"` element rather than an `<h1>`–`<h6>`
   * (one element, any level), which assistive tech treats identically. @default 3
   */
  public headingLevel = input<AccordionHeadingLevel>(3);
}
