import { Directive } from '@angular/core';

@Directive({
  selector: '[etBreadcrumbItem]',
  host: {
    class: 'et-breadcrumb-item',
  },
})
export class BreadcrumbItemDirective {}
