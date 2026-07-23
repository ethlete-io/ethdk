import { Component, input, signal, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { PAGINATION_IMPORTS } from '../pagination.imports';

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
      />
      <p class="mt-4 text-sm opacity-70">Page {{ page() }} of {{ totalPages() }}</p>
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
  public surface = input('dark');

  protected page = signal(1);
}
