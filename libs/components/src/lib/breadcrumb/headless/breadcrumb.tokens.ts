import { InjectionToken } from '@angular/core';
import { BreadcrumbDirective } from './breadcrumb.directive';
import { BreadcrumbSegmentDirective } from './breadcrumb-segment.directive';

export const BREADCRUMB_TOKEN = new InjectionToken<BreadcrumbDirective>('BREADCRUMB_TOKEN');

export const BREADCRUMB_SEGMENT_TOKEN = new InjectionToken<BreadcrumbSegmentDirective>('BREADCRUMB_SEGMENT_TOKEN');
