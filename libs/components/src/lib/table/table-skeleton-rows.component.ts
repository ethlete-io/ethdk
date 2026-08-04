import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, TemplateRef, ViewEncapsulation } from '@angular/core';
import { SkeletonItemComponent } from '../skeleton/skeleton-item.component';
import { injectTableFeatureHost } from './headless/table-features';
import { TableSkeletonDirective } from './table-skeleton.directive';
import { TableCellSkeletonContext } from './table.types';

/**
 * Widths (%) a placeholder bar cycles through, so a block of them reads as ragged text rather than a bar
 * chart. Cycled by row + column index, not random: a fresh width per pass would make the block twitch.
 */
const PLACEHOLDER_WIDTHS = [72, 45, 88, 60, 34, 79];

/** One placeholder row: a bone per column, at a width that doesn't change between passes. */
type SkeletonRowVm = {
  key: number;
  cells: {
    key: string;
    align: string;
    width: number;
    /** The column's own `etTableCellSkeleton`, when it has one. */
    template: TemplateRef<unknown> | null;
    context: TableCellSkeletonContext;
  }[];
};

/**
 * The placeholder body of a first load, stamped by the table through `registerBodyPlaceholder`. It is
 * `display: contents`, so its rows and cells are grid items of the table's own grid and land in the same
 * tracks as real ones - which is what keeps the columns from jumping when the data arrives.
 *
 * @internal
 */
@Component({
  selector: 'et-table-skeleton-rows',
  template: `
    @for (row of rows(); track row.key) {
      <div
        [style.--_et-table-row-h.px]="feature.measuredRowHeight()"
        class="et-table-row et-table-row--placeholder et-skeleton--animated"
        role="row"
        aria-hidden="true"
      >
        @for (lead of table.leadCellClasses(); track $index) {
          <div [class]="lead" class="et-table-cell" role="gridcell"></div>
        }
        @for (cell of row.cells; track cell.key) {
          <div [attr.data-align]="cell.align" class="et-table-cell" role="gridcell">
            @if (cell.template; as skeleton) {
              <!-- The column said what its cells look like while loading — a chip-shaped bone for a chip
                   column, an avatar for an avatar. See etTableCellSkeleton. -->
              <ng-container *ngTemplateOutlet="skeleton; context: cell.context" />
            } @else {
              <!-- A text-shaped bone is a line of text's height, which is what keeps a placeholder row
                   as tall as a row of text. -->
              <et-skeleton-item [style.inline-size.%]="cell.width" shape="text" />
            }
          </div>
        }
        @if (table.hasFillerTrack()) {
          <div class="et-table-cell et-table-filler-cell" role="presentation"></div>
        }
      </div>
    }
  `,
  styleUrl: './table-skeleton-rows.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, SkeletonItemComponent],
  host: { class: 'et-table-skeleton-rows' },
})
export class TableSkeletonRowsComponent {
  protected feature = inject(TableSkeletonDirective);
  protected table = injectTableFeatureHost('etTableSkeleton');

  protected rows = computed<SkeletonRowVm[]>(() => {
    const columns = this.table.visibleColumnsMeta();

    return Array.from({ length: Math.max(1, this.feature.config().rows ?? 5) }, (_, rowIndex) => ({
      key: rowIndex,
      cells: columns.map((column, columnIndex) => {
        const width = PLACEHOLDER_WIDTHS[(rowIndex + columnIndex) % PLACEHOLDER_WIDTHS.length] ?? 60;

        return {
          key: column.key,
          align: column.align ?? 'start',
          width,
          template: this.table.columnTemplate('cellSkeleton', column.key),
          context: { $implicit: rowIndex, width },
        };
      }),
    }));
  });
}
