import { Directive } from '@angular/core';

@Directive({
  selector: '[etBreadcrumbItem]',
  standalone: true,
  host: {
    class: 'et-breadcrumb-item',
  },
})
export class BreadcrumbItemDirective {}
