import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { injectBreadcrumbManager } from './breadcrumb-manager';

/**
 * Renders whichever page's `<ng-template etBreadcrumbTemplate>` is currently registered. Put one in the
 * app shell, where the trail belongs on screen; the pages below decide what it says.
 *
 * Renders nothing when no page has registered a trail, so a shell doesn't need to know which routes
 * have breadcrumbs.
 *
 * @example
 * <et-breadcrumb-outlet />
 */
@Component({
  selector: 'et-breadcrumb-outlet',
  template: `
    @if (manager.template(); as template) {
      <ng-container [ngTemplateOutlet]="template" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-breadcrumb-outlet',
  },
  styles: `
    @layer components {
      .et-breadcrumb-outlet {
        display: block;
      }
    }
  `,
})
export class BreadcrumbOutletComponent {
  protected manager = injectBreadcrumbManager();
}
