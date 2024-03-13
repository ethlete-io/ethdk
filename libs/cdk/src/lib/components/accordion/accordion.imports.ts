import { AccordionComponent } from './components/accordion';
import { AccordionGroupComponent } from './components/accordion-group';
import { AccordionHintDirective } from './partials/accordion-hint';
import { AccordionHintWrapperDirective } from './partials/accordion-hint-wrapper';
import { AccordionLabelDirective } from './partials/accordion-label';
import { AccordionLabelWrapperDirective } from './partials/accordion-label-wrapper';

export const AccordionImports = [
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
  AccordionComponent,
  AccordionGroupComponent,
] as const;
