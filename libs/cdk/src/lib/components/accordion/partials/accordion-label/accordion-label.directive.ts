import { Directive } from '@angular/core';

@Directive({
  selector: '[et-accordion-label]',
  standalone: true,
  host: {
    class: 'et-accordion-label',
  },
})
export class AccordionLabelDirective {}
