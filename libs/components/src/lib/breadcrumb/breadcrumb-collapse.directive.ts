import { Directive } from '@angular/core';
import { BreadcrumbOverflowComponent } from './breadcrumb-overflow.component';
import { BREADCRUMB_COLLAPSE_TOKEN } from './headless';

/**
 * Lets a breadcrumb move the crumbs that don't fit into an overflow control. Apply it to the breadcrumb
 * (or to `<et-breadcrumb-outlet>`, or to any ancestor - the app shell's root element covers every
 * breadcrumb below it).
 *
 * Opt-in because the control is a toggletip, which pulls in the overlay runtime: a trail that is always
 * short, or one you clip or wrap yourself, shouldn't pay for it. Without this directive the `collapse`
 * input has nothing to collapse into and the trail is clipped by the breadcrumb's own `overflow: hidden`.
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
