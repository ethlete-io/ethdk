import { InjectionToken } from '@angular/core';
import { BreadcrumbDirective } from './breadcrumb.directive';

export const BREADCRUMB_TOKEN = new InjectionToken<BreadcrumbDirective>('BREADCRUMB_TOKEN');
