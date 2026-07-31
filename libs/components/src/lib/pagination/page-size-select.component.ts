import { Component, computed, input, model, ViewEncapsulation } from '@angular/core';
import { injectPaginationLabels, PaginationLabels } from './pagination-labels';

/** The default choices, the sizes a list view is normally offered. */
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const;

/**
 * The "Items per page" control that sits beside a paginator, completing the Material-style controls
 * row (`<et-pagination compact>` + a range readout + this).
 *
 * A **native `<select>`**, deliberately: it is a handful of numbers, and pulling
 * [`et-select`](/components/select) in would drag the overlay runtime and its panel into every footer
 * that shows one. Native also gets the platform picker on mobile for free, which is the better control
 * for this at that size.
 *
 * Standalone rather than part of the paginator, because the paginator is `page`, not `pageSize` — a
 * table's footer, an infinite list and a gallery all pair them differently, and plenty of paginators
 * want no size control at all.
 *
 * **Changing the size does not reset the page.** Which page 1-based position 47 belongs to depends on
 * what you are paging, so that decision stays yours — the usual answer is to go back to page 1, which
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
    <!-- The visible label wraps the control, so it is the accessible name with no id to generate and
         nothing to keep in sync. -->
    <label class="et-page-size-select-label">
      <span class="et-page-size-select-text">{{ resolvedLabels().pageSize }}</span>
      <span class="et-page-size-select-field">
        <select [value]="pageSize()" (change)="pick($event)" class="et-page-size-select-control">
          @for (option of options(); track option.value) {
            <option [value]="option.value" [selected]="option.value === pageSize()">{{ option.label }}</option>
          }
        </select>
        <!-- The native arrow goes with \`appearance: none\`, so the control draws its own — inline, like
             the paginator's chevrons, rather than through the icon system the paginator also avoids.
             Pointer-events off so the whole field still opens the picker. -->
        <svg class="et-page-size-select-chevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </span>
    </label>
  `,
  styleUrl: './page-size-select.component.css',
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
  public size = input<'sm' | 'md'>('md');

  /** Override this instance's strings — see {@link providePaginationLabels} for the app-wide version. */
  public labels = input<Partial<PaginationLabels> | null>(null);

  /** The strings in effect here: the injected label set with this instance's `labels` applied. */
  public resolvedLabels = computed<PaginationLabels>(() => ({ ...this.injectedLabels(), ...this.labels() }));

  protected options = computed(() => {
    const label = this.resolvedLabels().pageSizeOption;

    return this.sizes().map((value) => ({ value, label: label(value) }));
  });

  protected pick(event: Event) {
    const value = Number.parseInt((event.target as HTMLSelectElement).value, 10);

    if (!Number.isNaN(value)) this.pageSize.set(value);
  }
}
