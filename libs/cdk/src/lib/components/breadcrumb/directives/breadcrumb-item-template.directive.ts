import { Directive } from '@angular/core';
import { injectTemplateRef } from '@ethlete/core';

@Directive({
  selector: '[etBreadcrumbItemTemplate]',
  host: {
    class: 'et-breadcrumb-item',
  },
})
export class BreadcrumbItemTemplateDirective {
  templateRef = injectTemplateRef();
}
