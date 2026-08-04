import { Component, computed, ElementRef, inject, viewChildren, ViewEncapsulation } from '@angular/core';
import { signalElementDimensions } from '@ethlete/core';
import { injectTableFeatureHost } from './headless/table-features';
import { TableGroupHeadersDirective } from './table-group-headers.directive';

/**
 * The spanning group-header row, stamped by the table through `registerHeaderRow`. It is
 * `display: contents`, so the cells below are grid items of the table's own grid and land in its tracks.
 *
 * @internal
 */
@Component({
  selector: 'et-table-group-header-row',
  template: `
    <!-- One empty cell per leading utility column (selection, expander), so the band covers their
         tracks too. -->
    @for (lead of leads(); track $index) {
      <div class="et-table-group-cell" aria-hidden="true"></div>
    }
    @for (group of feature.headerGroups(); track group.key) {
      <div
        #groupCell
        [style.grid-column]="'span ' + group.span"
        [class.et-table-group-cell--labeled]="group.label"
        [attr.role]="group.label ? 'columnheader' : null"
        [attr.aria-hidden]="group.label ? null : 'true'"
        class="et-table-group-cell"
      >
        @if (group.label) {
          <span class="et-table-cell-text">{{ group.label }}</span>
        }
      </div>
    }
    @if (table.hasFillerTrack()) {
      <div class="et-table-group-cell et-table-filler-cell" role="presentation" aria-hidden="true"></div>
    }
  `,
  styleUrl: './table-group-header-row.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-table-group-row',
    role: 'row',
  },
})
export class TableGroupHeaderRowComponent {
  protected feature = inject(TableGroupHeadersDirective);
  protected table = injectTableFeatureHost('etTableGroupHeaders');

  // Measured so the column-header row can stick just below this one - see the feature's host binding.
  private groupCells = viewChildren<ElementRef<HTMLElement>>('groupCell');
  private groupCellDimensions = signalElementDimensions(computed(() => [...this.groupCells()]));

  /** Rendered height of the row, for the header row's sticky offset. */
  public blockSize = computed(() => this.groupCellDimensions()?.offset?.height ?? 0);

  protected leads = computed(() => this.table.leadColumnsMeta());

  constructor() {
    this.feature.rowHeight.set(this.blockSize);
  }
}
