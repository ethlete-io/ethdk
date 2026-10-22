import { Component, signal, ViewEncapsulation } from '@angular/core';
import { PAGINATION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-pagination-many-pages-example',
  template: `<et-pagination [(page)]="page" [totalPages]="200" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS],
})
export class PaginationManyPagesExampleComponent {
  protected page = signal(1);
}
