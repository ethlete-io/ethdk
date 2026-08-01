import { Component, computed, input, linkedSignal, signal, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { PaginationRenderAs } from '../pagination.component';
import { PAGE_SIZE_SELECT_IMPORTS, PAGINATION_IMPORTS } from '../pagination.imports';
import { GERMAN_LABELS } from './pagination-storybook.data';

@Component({
  selector: 'et-sb-pagination',
  template: `
    <div [etProvideSurface]="surface()" class="p-8 font-sans">
      @if (pageSizeSelect()) {
        <!-- The Material-style controls row: size select, then the compact pager with its own readout.
             Two components, laid out by the app - the paginator owns page, never pageSize. -->
        <div class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <et-page-size-select [(pageSize)]="chosenPageSize" [labels]="labels()" size="sm" />
          <et-pagination
            [(page)]="resettingPage"
            [totalPages]="pagedTotalPages()"
            [totalItems]="DEMO_TOTAL_ITEMS"
            [pageSize]="chosenPageSize()"
            [labels]="labels()"
            [compact]="COMPACT_PAGER"
          />
        </div>
        <p class="text-small mt-4 opacity-70">
          Page {{ resettingPage() }} of {{ pagedTotalPages() }} · {{ chosenPageSize() }} per page. Changing the size
          sends you back to page 1 - the app's decision, in one linkedSignal.
        </p>
      } @else {
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
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PAGINATION_IMPORTS, PAGE_SIZE_SELECT_IMPORTS, ProvideSurfaceDirective],
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
  public pageSizeSelect = input(false);
  public surface = input('dark');

  protected page = signal(1);

  // `compact` is `boolean | null` (no attribute transform), so it stays a property binding.
  protected readonly COMPACT_PAGER = true;
  /** What the demo pages through, so the range readout has a real total to describe. */
  protected readonly DEMO_TOTAL_ITEMS = 137;
  protected chosenPageSize = signal(25);
  protected pagedTotalPages = computed(() => Math.max(1, Math.ceil(this.DEMO_TOTAL_ITEMS / this.chosenPageSize())));
  // Back to page 1 whenever the size changes; the paginator drives it otherwise. The size select
  // deliberately does not do this itself - which page an item lands on is the app's to decide.
  protected resettingPage = linkedSignal<number, number>({ source: this.chosenPageSize, computation: () => 1 });

  protected labels = computed(() => (this.localized() ? GERMAN_LABELS : null));

  protected urlForPage(page: number) {
    return `?page=${page}`;
  }
}
