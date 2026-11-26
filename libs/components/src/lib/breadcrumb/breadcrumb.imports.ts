import { BreadcrumbCollapseDirective } from './breadcrumb-collapse.directive';
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
 * The collapse affordance (`etBreadcrumbCollapse`): apply it to a breadcrumb, to
 * `<et-breadcrumb-outlet>`, or to any ancestor, and the crumbs that don't fit move into an overflow
 * toggletip.
 */
export const BREADCRUMB_COLLAPSE_IMPORTS = [BreadcrumbCollapseDirective] as const;

/** `schema.org` BreadcrumbList markup for the trail (`etBreadcrumbSeo`). */
export const BREADCRUMB_SEO_IMPORTS = [BreadcrumbSeoDirective] as const;
