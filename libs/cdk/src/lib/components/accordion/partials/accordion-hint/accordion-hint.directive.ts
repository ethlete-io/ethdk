import { Directive } from '@angular/core';

@Directive({
  selector: '[et-accordion-hint]',
  standalone: true,
  host: {
    class: 'et-accordion-hint',
  },
})
export class AccordionHintDirective {}
