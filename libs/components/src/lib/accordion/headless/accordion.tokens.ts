import { InjectionToken } from '@angular/core';
import { AccordionDirective } from './accordion.directive';
import { AccordionGroupDirective } from './accordion-group.directive';

export const ACCORDION_TOKEN = new InjectionToken<AccordionDirective>('ACCORDION_TOKEN');

export const ACCORDION_GROUP_TOKEN = new InjectionToken<AccordionGroupDirective>('ACCORDION_GROUP_TOKEN');
