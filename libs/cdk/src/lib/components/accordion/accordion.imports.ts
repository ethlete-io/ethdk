import {
  AccordionComponent,
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
} from './accordion';
import { AccordionGroupComponent } from './accordion-group';

export const AccordionImports = [
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
  AccordionComponent,
  AccordionGroupComponent,
] as const;
