import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BreadcrumbService } from '../../services/breadcrumb.service';

@Component({
  selector: 'et-breadcrumb-outlet',
  imports: [NgTemplateOutlet],
  template: `
    @if (breadcrumbService.breadcrumbTemplate(); as breadcrumb) {
      <ng-container *ngTemplateOutlet="breadcrumb" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-breadcrumb-outlet',
  },
  styles: `
    .et-breadcrumb-outlet {
      display: block;
      width: 100%;
    }
  `,
})
export class BreadcrumbOutletComponent {
  breadcrumbService = inject(BreadcrumbService);
}
