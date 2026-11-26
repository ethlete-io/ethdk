import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { injectBreadcrumbManager } from '../../providers/breadcrumb-manager.provider';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-breadcrumb-outlet',
  imports: [NgTemplateOutlet],
  template: `
    @if (breadcrumbManager.breadcrumbTemplate(); as breadcrumb) {
      <ng-container *ngTemplateOutlet="breadcrumb" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-breadcrumb-outlet et-legacy',
  },
  styles: `
    .et-breadcrumb-outlet {
      display: block;
      width: 100%;
    }
  `,
})
export class BreadcrumbOutletComponent {
  breadcrumbManager = injectBreadcrumbManager();
}
