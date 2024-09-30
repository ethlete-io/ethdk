import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BreadcrumbService } from '../../services/breadcrumb.service';

@Component({
  selector: 'et-breadcrumb-outlet',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    @if (breadcrumbService.breadcrumbTemplate(); as breadcrumb) {
      <ng-container *ngTemplateOutlet="breadcrumb" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbOutletComponent {
  readonly breadcrumbService = inject(BreadcrumbService);
}
