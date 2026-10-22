import { Component, signal, ViewEncapsulation } from '@angular/core';
import { PAGINATION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-pagination-links-example',
  template: `<et-pagination [(page)]="page" [totalPages]="8" [urlForPage]="urlForPage" renderAs="links" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS],
})
export class PaginationLinksExampleComponent {
  protected page = signal(1);
  protected urlForPage(page: number) {
    return `?page=${page}`;
  }
}
