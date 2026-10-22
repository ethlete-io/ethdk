import { Component, signal, ViewEncapsulation } from '@angular/core';
import { PAGINATION_IMPORTS } from '@ethlete/components';
import { GERMAN_LABELS } from './pagination-localized.data';

@Component({
  selector: 'app-pagination-localized-example',
  template: `
    <et-pagination [(page)]="page" [totalPages]="25" [totalItems]="500" [pageSize]="20" [labels]="LABELS" showJumpTo />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS],
})
export class PaginationLocalizedExampleComponent {
  protected page = signal(1);
  protected readonly LABELS = GERMAN_LABELS;
}
