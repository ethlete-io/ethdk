import { BreadcrumbOutletComponent } from './breadcrumb-outlet.component';
import { BreadcrumbComponent } from './breadcrumb.component';
import {
  BreadcrumbDirective,
  BreadcrumbItemDirective,
  BreadcrumbItemTemplateDirective,
  BreadcrumbSegmentDirective,
  BreadcrumbSeparatorDirective,
} from './headless';
import { BreadcrumbSeoDirective } from './seo';

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

/**
 * `schema.org` BreadcrumbList markup for the trail (`etBreadcrumbSeo`). Separate because it pulls in
 * core's structured-data store, which an app doing no head management shouldn't pay for.
 */
export const BREADCRUMB_SEO_IMPORTS = [BreadcrumbSeoDirective] as const;
