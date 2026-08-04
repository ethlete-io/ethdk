import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { injectTableFeatureHost } from './headless/table-features';
import { TableRowExpansionDirective } from './table-row-expansion.directive';

/**
 * The detail row of an expanded row: the table's `expandedRowTemplate` in a full-width row under the
 * row it belongs to. Stamped by the table through `registerRowDetail`, so it exists only while a row is
 * actually open.
 *
 * The enter/leave animation is a **host** binding rather than a binding on an element inside the
 * template, because Angular runs `animate.leave` on the element that is being removed - and what the
 * table removes is this component's host. On a child it would never be awaited, and the row would
 * disappear instantly instead of closing.
 *
 * @internal
 */
@Component({
  selector: 'et-table-row-detail',
  template: `
    <!-- The clip window the animating track squeezes to nothing, and the body that carries the padding.
         Two elements on purpose - see table-detail-styles.component.css. -->
    <div class="et-table-detail-cell" role="gridcell">
      <div class="et-table-detail-body">
        <ng-container *ngTemplateOutlet="table.detailTemplate(); context: { $implicit: row() }" />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  host: {
    class: 'et-table-detail-row',
    role: 'row',
    // Animated only for the row the user just toggled - a re-mount from paging/sorting must not replay
    // the reveal (see TableRowExpansionDirective.animates).
    '[animate.enter]': "animated() ? 'et-table-detail--enter' : ''",
    '[animate.leave]': "animated() ? 'et-table-detail--leave' : ''",
  },
})
export class TableRowDetailComponent {
  private expansion = inject(TableRowExpansionDirective);
  protected table = injectTableFeatureHost('etTableRowExpansion');

  /** The row this detail row belongs to. Set by the table (see {@link TableRowDetail}). */
  public row = input.required<unknown>();

  protected animated = computed(() => this.expansion.animates(this.row()));
}
