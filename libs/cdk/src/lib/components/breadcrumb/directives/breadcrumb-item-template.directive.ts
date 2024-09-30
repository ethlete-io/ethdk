import { Directive } from '@angular/core';
import { injectTemplateRef } from '@ethlete/core';

@Directive({
  selector: '[etBreadcrumbItemTemplate]',
  standalone: true,
  host: {
    class: 'et-breadcrumb-item',
  },
})
export class BreadcrumbItemTemplateDirective {
  readonly templateRef = injectTemplateRef();
}
