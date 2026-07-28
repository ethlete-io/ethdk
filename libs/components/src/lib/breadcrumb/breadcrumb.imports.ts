import { BreadcrumbOutletComponent } from './breadcrumb-outlet.component';
import { BreadcrumbComponent } from './breadcrumb.component';
import {
  BreadcrumbDirective,
  BreadcrumbItemDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbSeparatorDirective,
  BreadcrumbTemplateDirective,
} from './headless';

/** The breadcrumb, its outlet, the crumb/separator templates, and the headless directive. */
export const BREADCRUMB_IMPORTS = [
  BreadcrumbComponent,
  BreadcrumbOutletComponent,
  BreadcrumbTemplateDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbItemDirective,
  BreadcrumbSeparatorDirective,
  BreadcrumbDirective,
] as const;
