import { Component, computed, input, model, ViewEncapsulation } from '@angular/core';
import { FORM_FIELD_IMPORTS } from '../forms/form-field';
import { SELECT_IMPORTS } from '../forms/select';
import { injectPaginationLabels, PaginationLabels } from './pagination-labels';
import { PAGINATION_SIZES, PaginationSize } from './pagination.types';

/** The default choices, the sizes a list view is normally offered. */
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * The "Items per page" control that sits beside a paginator, completing the Material-style controls
 * row (`<et-pagination compact>` + a range readout + this).
 *
 * **Changing the size does not reset the page.** Which page 1-based position 47 belongs to depends on
 * what you are paging, so that decision stays yours - the usual answer is to go back to page 1, which
 * `linkedSignal` expresses in a line (see the example).
 *
 * @example
 * protected pageSize = signal(25);
 * // back to page one whenever the size changes; the paginator drives it otherwise
 * protected page = linkedSignal<number, number>({ source: this.pageSize, computation: () => 1 });
 *
 * <div class="controls-row">
 *   <et-page-size-select [(pageSize)]="pageSize" />
 *   <et-pagination [(page)]="page" [totalPages]="totalPages()" [totalItems]="total()" [pageSize]="pageSize()" />
 * </div>
 */
@Component({
  selector: 'et-page-size-select',
  template: `
    <et-form-field [size]="size()" labelMode="inline">
      <et-label>{{ resolvedLabels().pageSize }}</et-label>
      <et-select [(value)]="pageSize" [clearable]="false">
        @for (option of options(); track option.value) {
          <et-select-option [value]="option.value">{{ option.label }}</et-select-option>
        }
      </et-select>
    </et-form-field>
  `,
  styleUrl: './page-size-select.component.css',
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-page-size-select-host',
    '[attr.data-size]': 'size()',
  },
})
export class PageSizeSelectComponent {
  private injectedLabels = injectPaginationLabels();

  /** The choices offered. @default [10, 25, 50, 100] */
  public sizes = input<readonly number[]>(DEFAULT_PAGE_SIZES);

  /** The current page size. Two-way: picking a choice writes it back. */
  public pageSize = model.required<number>();

  /** Control density, to match the paginator it sits next to. @default 'md' */
  public size = input<PaginationSize>(PAGINATION_SIZES.MD);

  /** Override this instance's strings - see {@link providePaginationLabels} for the app-wide version. */
  public labels = input<Partial<PaginationLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<PaginationLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  protected options = computed(() => {
    const label = this.resolvedLabels().pageSizeOption;

    return this.sizes().map((value) => ({ value, label: label(value) }));
  });
}
