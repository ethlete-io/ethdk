import { Directive } from '@angular/core';

@Directive({
  selector: '[etBreadcrumbItem]',
  host: {
    class: 'et-breadcrumb-item et-legacy',
  },
})
export class BreadcrumbItemDirective {}
