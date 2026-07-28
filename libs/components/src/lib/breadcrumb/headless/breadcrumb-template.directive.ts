import { DestroyRef, Directive, inject } from '@angular/core';
import { injectTemplateRef } from '@ethlete/core';
import { injectBreadcrumbManager } from '../breadcrumb-manager';

/**
 * Registers a page's trail with the {@link injectBreadcrumbManager} so the shell's
 * `<et-breadcrumb-outlet>` renders it. Put it in the routed component that knows the trail — including
 * the parts only it can know, like the name of the record it just loaded — and the crumbs unregister
 * themselves when the page is destroyed.
 *
 * @example
 * <ng-template etBreadcrumbTemplate>
 *   <et-breadcrumb>
 *     <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem routerLink="/teams">Teams</a></ng-template>
 *     <ng-template etBreadcrumbItemTemplate><span etBreadcrumbItem>{{ team().name }}</span></ng-template>
 *   </et-breadcrumb>
 * </ng-template>
 */
@Directive({
  selector: 'ng-template[etBreadcrumbTemplate]',
  exportAs: 'etBreadcrumbTemplate',
})
export class BreadcrumbTemplateDirective {
  private manager = injectBreadcrumbManager();

  public templateRef = injectTemplateRef();

  constructor() {
    this.manager.setTemplate(this.templateRef);

    inject(DestroyRef).onDestroy(() => {
      // Only clear it if this page is still the one on screen: during a route change the next page's
      // template registers before the old page is destroyed, and clearing then would blank the outlet.
      if (this.manager.template() === this.templateRef) {
        this.manager.setTemplate(null);
      }
    });
  }
}
