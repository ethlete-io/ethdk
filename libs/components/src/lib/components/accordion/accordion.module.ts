import { NgModule } from '@angular/core';
import { AccordionComponent, AccordionGroupComponent } from './components';
import {
  AccordionHintDirective,
  AccordionHintWrapperDirective,
  AccordionLabelDirective,
  AccordionLabelWrapperDirective,
} from './partials';

@NgModule({
  imports: [
    AccordionHintDirective,
    AccordionHintWrapperDirective,
    AccordionLabelDirective,
    AccordionLabelWrapperDirective,
    AccordionComponent,
    AccordionGroupComponent,
  ],
  exports: [
    AccordionHintDirective,
    AccordionHintWrapperDirective,
    AccordionLabelDirective,
    AccordionLabelWrapperDirective,
    AccordionComponent,
    AccordionGroupComponent,
  ],
})
export class AccordionModule {}
