import { booleanAttribute, Directive, input } from '@angular/core';
import { injectTemplateRef } from '@ethlete/core';

@Directive({
  selector: '[etBreadcrumbItemTemplate]',
  host: {
    class: 'et-breadcrumb-item',
  },
})
export class BreadcrumbItemTemplateDirective {
  templateRef = injectTemplateRef();
  loading = input(false, { transform: booleanAttribute });
}
