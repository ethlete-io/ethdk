import { Component, inject, ViewEncapsulation } from '@angular/core';
import { PaginationDirective } from './headless/pagination.directive';
import { PaginationItem } from './pagination.types';

/**
 * The default paginator. Renders themed page-number buttons with first/previous/next/last controls
 * and ellipsis gaps for large page counts, driven by the headless {@link PaginationDirective}.
 *
 * @example
 * <et-pagination [(page)]="page" [totalPages]="totalPages()" />
 */
@Component({
  selector: 'et-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: PaginationDirective,
      inputs: ['page', 'totalPages', 'siblingCount', 'boundaryCount', 'hideFirstLast', 'hidePreviousNext', 'ariaLabel'],
      outputs: ['pageChange'],
    },
  ],
  host: {
    class: 'et-pagination-host',
  },
})
export class PaginationComponent {
  protected pagination = inject(PaginationDirective);

  protected select(item: PaginationItem) {
    if (item.page !== null && !item.disabled) this.pagination.goTo(item.page);
  }
}
