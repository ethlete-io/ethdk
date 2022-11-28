import { InjectionToken } from '@angular/core';
import { AccordionLabelWrapperDirective } from './accordion-label-wrapper.directive';

export const ACCORDION_LABEL_WRAPPER_DIRECTIVE = new InjectionToken<AccordionLabelWrapperDirective>(
  'AccordionLabelWrapperDirective',
);
