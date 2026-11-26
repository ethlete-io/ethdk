import { Component, signal, ViewEncapsulation } from '@angular/core';
import { PAGINATION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-pagination-range-and-jump-example',
  template: `<et-pagination [(page)]="page" [totalPages]="25" [totalItems]="500" [pageSize]="20" showJumpTo />`,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS],
})
export class PaginationRangeAndJumpExampleComponent {
  protected page = signal(1);
}
