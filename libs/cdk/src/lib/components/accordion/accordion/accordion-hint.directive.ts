import { Directive } from '@angular/core';

@Directive({
  selector: '[et-accordion-hint]',

  host: {
    class: 'et-accordion-hint',
  },
})
export class AccordionHintDirective {}
