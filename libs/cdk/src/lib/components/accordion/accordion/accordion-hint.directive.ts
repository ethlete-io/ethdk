import { Directive } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[et-accordion-hint]',
  host: {
    class: 'et-accordion-hint',
  },
})
export class AccordionHintDirective {}
