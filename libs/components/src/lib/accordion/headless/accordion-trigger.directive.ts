import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { ACCORDION_ERROR_CODES } from '../accordion-errors';
import { ACCORDION_TOKEN } from './accordion.tokens';

/**
 * The header control that expands and collapses its `[etAccordion]`. Wires up `aria-expanded`,
 * `aria-controls` and the id the panel points back at, and toggles on click.
 *
 * Put it on a native `<button>` (inside a heading element or a `role="heading"` wrapper, as the
 * default `et-accordion` does) - that is what gives you Enter/Space, focus and the right role for
 * free. A disabled accordion marks its trigger `aria-disabled` instead of natively disabling it, so
 * the header stays reachable and announces why it won't open.
 */
@Directive({
  selector: '[etAccordionTrigger]',
  exportAs: 'etAccordionTrigger',
  host: {
    // an accordion header never submits the form it happens to sit in
    type: 'button',
    '[attr.id]': 'accordion?.TRIGGER_ID',
    // no `aria-controls` while the panel isn't in the DOM - a reference to a missing id is worse than none
    '[attr.aria-controls]': 'accordion?.panel() ? accordion?.PANEL_ID : null',
    '[attr.aria-expanded]': 'accordion?.isOpen() ?? false',
    '[attr.aria-disabled]': 'accordion?.disabled() ? "true" : null',
    '(click)': 'accordion?.toggle()',
  },
})
export class AccordionTriggerDirective {
  protected accordion = inject(ACCORDION_TOKEN, { optional: true });

  /** @internal The element the group focuses when navigating between headers with the arrow keys. */
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    this.accordion?.registerTrigger(this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.accordion) {
          throw new RuntimeError(
            ACCORDION_ERROR_CODES.PART_OUTSIDE_ACCORDION,
            '[AccordionTriggerDirective] etAccordionTrigger must be placed inside an [etAccordion] element (e.g. <et-accordion>).',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }
}
