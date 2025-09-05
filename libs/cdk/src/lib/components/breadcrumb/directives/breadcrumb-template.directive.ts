import { DestroyRef, Directive, inject, TemplateRef } from '@angular/core';
import { injectBreadcrumbManager } from '../providers/breadcrumb-manager.provider';

@Directive({
  selector: 'ng-template[etBreadcrumbTemplate]',
})
export class BreadcrumbTemplateDirective {
  templateRef = inject(TemplateRef);
  breadcrumbManager = injectBreadcrumbManager();

  constructor() {
    this.breadcrumbManager.setBreadcrumbTemplate(this.templateRef);

    inject(DestroyRef).onDestroy(() => this.breadcrumbManager.setBreadcrumbTemplate(null));
  }
}
