import { BreadcrumbOutletComponent } from './breadcrumb-outlet.component';
import { BreadcrumbComponent } from './breadcrumb.component';
import {
  BreadcrumbDirective,
  BreadcrumbItemDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbSegmentDirective,
  BreadcrumbSeparatorDirective,
} from './headless';

/** The breadcrumb, its outlet, the segment/crumb/separator templates, and the headless directive. */
export const BREADCRUMB_IMPORTS = [
  BreadcrumbComponent,
  BreadcrumbOutletComponent,
  BreadcrumbSegmentDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbItemDirective,
  BreadcrumbSeparatorDirective,
  BreadcrumbDirective,
] as const;
