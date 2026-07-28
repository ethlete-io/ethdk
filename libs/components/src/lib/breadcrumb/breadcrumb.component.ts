import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { BUTTON_IMPORTS } from '../button';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { SKELETON_IMPORTS } from '../skeleton';
import { TOGGLETIP_IMPORTS } from '../toggletip';
import { BreadcrumbDirective } from './headless';

/**
 * The default breadcrumb: an ordered trail of crumbs separated by chevrons, which moves its middle
 * crumbs into a menu when it runs out of room (first and last always stay). Driven by the headless
 * {@link BreadcrumbDirective}.
 *
 * The crumbs are `<ng-template etBreadcrumbItemTemplate>`s you declare — see the headless directive for
 * why. Pair it with `<ng-template etBreadcrumbTemplate>` + `<et-breadcrumb-outlet>` to render a routed
 * page's trail up in the app shell.
 *
 * @example
 * <et-breadcrumb>
 *   <ng-template etBreadcrumbItemTemplate><a etBreadcrumbItem routerLink="/">Home</a></ng-template>
 *   <ng-template etBreadcrumbItemTemplate><span etBreadcrumbItem>Invoice 4711</span></ng-template>
 * </et-breadcrumb>
 */
@Component({
  selector: 'et-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, IconDirective, NgTemplateOutlet, SKELETON_IMPORTS, TOGGLETIP_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON)],
  hostDirectives: [
    {
      directive: BreadcrumbDirective,
      inputs: ['collapse', 'labels'],
    },
  ],
  host: {
    class: 'et-breadcrumb',
  },
})
export class BreadcrumbComponent {
  protected breadcrumb = inject(BreadcrumbDirective);
}
