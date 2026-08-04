import { DestroyRef, Directive, inject, TemplateRef } from '@angular/core';
import { injectBreadcrumbManager } from '../providers/breadcrumb-manager.provider';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
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
