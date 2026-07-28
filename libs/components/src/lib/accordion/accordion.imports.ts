import { AccordionGroupComponent } from './accordion-group.component';
import { AccordionComponent } from './accordion.component';
import {
  AccordionContentDirective,
  AccordionDirective,
  AccordionGroupDirective,
  AccordionHintDirective,
  AccordionLabelDirective,
  AccordionPanelDirective,
  AccordionTriggerDirective,
} from './headless';

/** The accordion, its group, the slot templates, and the headless directives to build your own. */
export const ACCORDION_IMPORTS = [
  AccordionComponent,
  AccordionGroupComponent,
  AccordionLabelDirective,
  AccordionHintDirective,
  AccordionContentDirective,
  AccordionDirective,
  AccordionTriggerDirective,
  AccordionPanelDirective,
  AccordionGroupDirective,
] as const;
