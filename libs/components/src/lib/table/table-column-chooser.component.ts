import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { EYE_ICON } from '../icon/headless/eye-icons';
import { GRID_2X2_ICON } from '../icon/headless/grid-2x2-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import {
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuDirective,
  MenuItemComponent,
  MenuSeparatorComponent,
  MenuSurfaceDirective,
} from '../menu';
import { MenuTriggerDirective } from '../menu/headless';
import { TableFeatureHost } from './headless/table-features';

/** The slice of the table a column chooser drives - any `et-table` satisfies it. */
export type TableColumnVisibilityHost = Pick<
  TableFeatureHost,
  'allColumns' | 'visibleColumnsMeta' | 'isColumnVisible' | 'setColumnVisible' | 'showAllColumns' | 'resolvedLabels'
>;

/**
 * A "columns" button and menu for toggling column visibility, placed wherever you like - a toolbar
 * above the table, the `[etTableFooter]` slot, a page header.
 *
 * Deliberately *not* part of the per-column `⋮` menu. A list that hides columns cannot hang off a
 * control inside the header it is editing: hiding a column relays the header out and drags the menu
 * with it, and hiding the column the menu was opened from destroys its own anchor. Anchored to a
 * button of yours, which nothing in the table can move, neither happens.
 *
 * @example
 * <et-table #table [data]="rows()" [columns]="COLUMNS">
 *   <div etTableFooter>
 *     <et-table-column-chooser [table]="table" />
 *   </div>
 * </et-table>
 */
@Component({
  selector: 'et-table-column-chooser',
  templateUrl: './table-column-chooser.component.html',
  styleUrl: './table-column-chooser.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuItemComponent,
    MenuSeparatorComponent,
    MenuCheckboxItemComponent,
    ButtonComponent,
    IconDirective,
  ],
  providers: [provideIcons(GRID_2X2_ICON, EYE_ICON)],
})
export class TableColumnChooserComponent {
  /** The table whose columns this toggles - bind a template ref to the `<et-table>`. */
  public table = input.required<TableColumnVisibilityHost>();

  /**
   * The bound table's wording, so the chooser needs no strings of its own - localize it with
   * `provideTableLabels` or the table's `labels` input like everything else.
   */
  protected labels = computed(() => this.table().resolvedLabels());

  /**
   * Toggling a column leaves the menu open - hiding several in one visit is the point of the list. A
   * field rather than a literal in the template because `closeOnActivate` is tri-state
   * (`boolean | undefined`) and so takes a binding, not a static attribute.
   */
  protected readonly KEEP_MENU_OPEN = false;

  protected hasHidden = computed(() => this.table().visibleColumnsMeta().length < this.table().allColumns().length);

  /**
   * The last column standing can't be hidden - a table with no columns has nothing to show. Its
   * checkbox is disabled rather than absent, so the list still reads as the whole set.
   */
  protected isLastVisible(key: string) {
    const table = this.table();

    return table.isColumnVisible(key) && table.visibleColumnsMeta().length <= 1;
  }

  protected toggle(key: string) {
    const table = this.table();

    table.setColumnVisible(key, !table.isColumnVisible(key));
  }
}
