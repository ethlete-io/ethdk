import { Component, signal, ViewEncapsulation } from '@angular/core';
import { PAGINATION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-pagination-default-example',
  template: `
    <et-pagination [(page)]="page" [totalPages]="10" />
    <p>Page {{ page() }} of 10</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS],
})
export class PaginationDefaultExampleComponent {
  protected page = signal(1);
}
