import { AccordionComponent } from './accordion';
import { AccordionGroupComponent } from './accordion-group';
import { AccordionHintDirective } from './accordion/partials/accordion-hint';
import { AccordionHintWrapperDirective } from './accordion/partials/accordion-hint-wrapper';
import { AccordionLabelDirective } from './accordion/partials/accordion-label';
import { AccordionLabelWrapperDirective } from './accordion/partials/accordion-label-wrapper';

export const AccordionImports = [
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
  AccordionComponent,
  AccordionGroupComponent,
] as const;
