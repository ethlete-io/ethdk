import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON } from '../icon/headless/chevron-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import { TableComponent } from './table.component';

/**
 * The row expander, stamped into the table's own lead column when a detail template is set. Registered
 * through the same seam as a feature's lead column, so the table's row loops have no special case.
 *
 * It is created inside the table's view, so it reaches the table by plain DI — no injector plumbing,
 * unlike a feature's cells (see `TableLeadColumn.injector`). Its styles travel with it rather than in
 * `table.component.css`, so Angular injects them the first time a table actually renders an expander.
 *
 * @internal
 */
@Component({
  selector: 'et-table-expander-cell',
  template: `
    @if (canExpand()) {
      <button
        [attr.aria-expanded]="expanded()"
        [attr.aria-label]="expanded() ? table.resolvedLabels().collapseRow : table.resolvedLabels().expandRow"
        (click)="table.toggleExpanded(row())"
        class="et-table-expander"
        type="button"
      >
        <i [attr.data-expanded]="expanded()" class="et-table-expander-icon" etIcon="et-chevron" aria-hidden="true"></i>
      </button>
    }
  `,
  styleUrl: './table-expander-cell.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(CHEVRON_ICON)],
})
export class TableExpanderCellComponent {
  protected table = inject<TableComponent<unknown>>(TableComponent);

  /** The row this cell belongs to. Set by the table (see {@link TableLeadCellComponent}). */
  public row = input.required<unknown>();

  protected canExpand = computed(() => this.table.canExpand(this.row()));
  protected expanded = computed(() => this.table.isExpanded(this.row()));
}
