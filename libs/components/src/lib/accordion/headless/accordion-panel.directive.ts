import { Directive, afterNextRender, inject } from '@angular/core';
import { injectHostElement, RuntimeError } from '@ethlete/core';
import { ACCORDION_ERROR_CODES } from '../accordion-errors';
import { ACCORDION_TOKEN } from './accordion.tokens';

/**
 * The collapsible region of an `[etAccordion]`. Labelled by the trigger, and `inert` while collapsed
 * so nothing inside it can be focused, clicked or read out.
 *
 * It carries no styles: `data-open` is the hook to hang the collapse on (the default `et-accordion`
 * animates a `grid-template-rows` track off it, and hides the collapsed panel from find-in-page with
 * `visibility`). Keeping the content mounted while collapsed is deliberate - see
 * `etAccordionContent` for the deferred alternative.
 */
@Directive({
  selector: '[etAccordionPanel]',
  exportAs: 'etAccordionPanel',
  host: {
    role: 'region',
    '[attr.id]': 'accordion?.PANEL_ID',
    '[attr.aria-labelledby]': 'accordion?.TRIGGER_ID',
    '[attr.data-open]': 'accordion?.isOpen() ? "" : null',
    '[attr.inert]': 'accordion?.isOpen() ? null : ""',
  },
})
export class AccordionPanelDirective {
  protected accordion = inject(ACCORDION_TOKEN, { optional: true });
  private hostElement = injectHostElement();

  constructor() {
    this.accordion?.registerPanel(this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.accordion) {
          throw new RuntimeError(
            ACCORDION_ERROR_CODES.PART_OUTSIDE_ACCORDION,
            '[AccordionPanelDirective] etAccordionPanel must be placed inside an [etAccordion] element (e.g. <et-accordion>).',
            { element: this.hostElement },
          );
        }
      });
    }
  }
}
