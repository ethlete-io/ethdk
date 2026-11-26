import { Directive } from '@angular/core';
import { BreadcrumbOverflowComponent } from './breadcrumb-overflow.component';
import { BREADCRUMB_COLLAPSE_TOKEN } from './headless';

/**
 * Lets a breadcrumb move the crumbs that don't fit into an overflow control. Apply it to the breadcrumb
 * (or to `<et-breadcrumb-outlet>`, or to any ancestor - the app shell's root element covers every
 * breadcrumb below it).
 *
 * @example
 * <et-breadcrumb etBreadcrumbCollapse>…</et-breadcrumb>
 */
@Directive({
  selector: '[etBreadcrumbCollapse]',
  exportAs: 'etBreadcrumbCollapse',
  providers: [{ provide: BREADCRUMB_COLLAPSE_TOKEN, useExisting: BreadcrumbCollapseDirective }],
})
export class BreadcrumbCollapseDirective {
  /** @internal */
  public get overflowComponent() {
    return BreadcrumbOverflowComponent;
  }
}
