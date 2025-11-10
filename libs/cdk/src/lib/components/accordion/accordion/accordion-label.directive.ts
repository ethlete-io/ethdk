import { Directive } from '@angular/core';

@Directive({
  selector: '[et-accordion-label]',

  host: {
    class: 'et-accordion-label',
  },
})
export class AccordionLabelDirective {}
