import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { injectBreadcrumbManager } from '../../providers/breadcrumb-manager.provider';

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
