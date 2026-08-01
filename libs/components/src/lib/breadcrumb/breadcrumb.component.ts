import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { SKELETON_IMPORTS } from '../skeleton';
import { BreadcrumbDirective } from './headless';

/**
 * The default breadcrumb: an ordered trail of crumbs separated by chevrons. Driven by the headless
 * {@link BreadcrumbDirective}.
 *
 * Add `etBreadcrumbCollapse` from `BREADCRUMB_COLLAPSE_IMPORTS` and the middle crumbs move into an
 * overflow control when the trail runs out of room (first and last always stay); without it the trail is
 * clipped, and the overlay runtime that control needs stays out of your bundle.
 *
 * The crumbs are `<ng-template etBreadcrumbItemTemplate>`s you declare - see the headless directive for
 * why. For a routed app, don't place this yourself: let each view contribute an
 * `<ng-template etBreadcrumbSegment>` and put one `<et-breadcrumb-outlet>` in the shell, which renders
 * the composed trail through this component.
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
  imports: [IconDirective, NgComponentOutlet, NgTemplateOutlet, SKELETON_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON)],
  hostDirectives: [
    {
      directive: BreadcrumbDirective,
      inputs: ['collapse', 'labels', 'crumbs'],
    },
  ],
  host: {
    class: 'et-breadcrumb',
  },
})
export class BreadcrumbComponent {
  protected breadcrumb = inject(BreadcrumbDirective);
}
