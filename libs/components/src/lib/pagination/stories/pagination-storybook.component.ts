import { Component, computed, input, signal, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { PaginationRenderAs } from '../pagination.component';
import { PAGINATION_IMPORTS } from '../pagination.imports';
import { GERMAN_LABELS } from './pagination-storybook.data';

@Component({
  selector: 'et-sb-pagination',
  template: `
    <div [etProvideSurface]="surface()" class="p-8 font-sans">
      <et-pagination
        [(page)]="page"
        [totalPages]="totalPages()"
        [siblingCount]="siblingCount()"
        [boundaryCount]="boundaryCount()"
        [hideFirstLast]="hideFirstLast()"
        [hidePreviousNext]="hidePreviousNext()"
        [renderAs]="renderAs()"
        [urlForPage]="urlForPage"
        [totalItems]="totalItems() || null"
        [pageSize]="pageSize()"
        [showJumpTo]="showJumpTo()"
        [labels]="labels()"
      />
      <p class="text-small mt-4 opacity-70">Page {{ page() }} of {{ totalPages() }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS, ProvideSurfaceDirective],
})
export class PaginationStorybookComponent {
  public totalPages = input(10);
  public siblingCount = input(1);
  public boundaryCount = input(1);
  public hideFirstLast = input(false);
  public hidePreviousNext = input(false);
  public renderAs = input<PaginationRenderAs>('buttons');
  public totalItems = input(0);
  public pageSize = input(20);
  public showJumpTo = input(false);
  public localized = input(false);
  public surface = input('dark');

  protected page = signal(1);

  protected labels = computed(() => (this.localized() ? GERMAN_LABELS : null));

  protected urlForPage(page: number) {
    return `?page=${page}`;
  }
}
