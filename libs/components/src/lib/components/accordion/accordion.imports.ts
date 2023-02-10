import { AccordionComponent, AccordionGroupComponent } from './components';
import {
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
} from './partials';

export const AccordionImports = [
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
  AccordionComponent,
  AccordionGroupComponent,
] as const;
