import { DestroyRef, Directive, inject, TemplateRef } from '@angular/core';
import { BreadcrumbService } from '../services/breadcrumb.service';

@Directive({
  selector: 'ng-template[etBreadcrumbTemplate]',
})
export class BreadcrumbTemplateDirective {
  templateRef = inject(TemplateRef);
  breadcrumbService = inject(BreadcrumbService);

  constructor() {
    this.breadcrumbService.setBreadcrumbTemplate(this.templateRef);

    inject(DestroyRef).onDestroy(() => this.breadcrumbService.setBreadcrumbTemplate(null));
  }
}
