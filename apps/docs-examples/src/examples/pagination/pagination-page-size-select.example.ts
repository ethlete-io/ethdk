import { Component, computed, linkedSignal, signal, ViewEncapsulation } from '@angular/core';
import { PAGE_SIZE_SELECT_IMPORTS, PAGINATION_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-pagination-page-size-select-example',
  template: `
    <div class="controls-row">
      <et-page-size-select [(pageSize)]="pageSize" size="sm" />
      <et-pagination
        [(page)]="page"
        [totalPages]="totalPages()"
        [totalItems]="TOTAL_ITEMS"
        [pageSize]="pageSize()"
        compact
      />
    </div>
    <p>Page {{ page() }} of {{ totalPages() }}, {{ pageSize() }} per page.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS, PAGE_SIZE_SELECT_IMPORTS],
})
export class PaginationPageSizeSelectExampleComponent {
  protected readonly TOTAL_ITEMS = 137;
  protected pageSize = signal(25);
  protected totalPages = computed(() => Math.max(1, Math.ceil(this.TOTAL_ITEMS / this.pageSize())));
  protected page = linkedSignal<number, number>({ source: this.pageSize, computation: () => 1 });
}
