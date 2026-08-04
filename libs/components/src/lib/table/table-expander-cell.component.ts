import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON } from '../icon/headless/chevron-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import { injectTableFeatureHost } from './headless/table-features';
import { TableRowExpansionDirective } from './table-row-expansion.directive';

/**
 * The row expander, stamped into the lead column `etTableRowExpansion` registers. Its styles travel
 * with it rather than in `table.component.css`, so Angular injects them the first time a table actually
 * renders an expander.
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
        (click)="expansion.toggle(row())"
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
  protected expansion = inject<TableRowExpansionDirective<unknown>>(TableRowExpansionDirective);
  protected table = injectTableFeatureHost('etTableRowExpansion');

  /** The row this cell belongs to. Set by the table (see {@link TableLeadCellComponent}). */
  public row = input.required<unknown>();

  protected canExpand = computed(() => this.expansion.canExpand(this.row()));
  protected expanded = computed(() => this.expansion.isExpanded(this.row()));
}
