import { Directive } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[et-accordion-label]',
  host: {
    class: 'et-accordion-label',
  },
})
export class AccordionLabelDirective {}
