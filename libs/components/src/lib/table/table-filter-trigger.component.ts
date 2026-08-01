import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { IconButtonComponent } from '../button/icon-button.component';
import { FILTER_ICON } from '../icon/headless/filter-icon';
import { provideIcons } from '../icon/headless/icon-provider';
import { IconDirective } from '../icon/headless/icon.directive';
import {
  MenuCheckboxGroupComponent,
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuRadioGroupComponent,
  MenuRadioItemComponent,
  MenuDirective,
  MenuSearchDirective,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from '../menu';
import { TableColumnMeta } from './headless/table-features';
import { TableFilterOptionContext, TableFilterSelection } from './table.types';
import { TableFiltersDirective } from './table-filters.directive';

/**
 * The filter menu for one column's header cell, stamped there by `etTableFilters` (see
 * `registerHeaderAdornment`). A non-filterable column renders nothing.
 *
 * This is where the menu system is actually referenced, and it is created with the filters feature's
 * own injector, so it reaches the feature - and the feature's state - by plain DI.
 *
 * @internal
 */
@Component({
  selector: 'et-table-filter-trigger',
  templateUrl: './table-filter-trigger.component.html',
  styleUrl: './table-filter-trigger.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuSearchDirective,
    MenuCheckboxGroupComponent,
    MenuCheckboxItemComponent,
    MenuRadioGroupComponent,
    MenuRadioItemComponent,
    IconButtonComponent,
    IconDirective,
    NgTemplateOutlet,
  ],
  providers: [provideIcons(FILTER_ICON)],
})
export class TableFilterTriggerComponent {
  protected filters = inject(TableFiltersDirective);

  /** The column this trigger belongs to. Set by the table (see {@link TableHeaderAdornment}). */
  public column = input.required<TableColumnMeta>();

  /** The host table's wording - every string here comes from there, never from this component. */
  protected labels = this.filters.table.resolvedLabels;

  /** One value or several - a column says so with `filterSelection`. @default 'multiple' */
  protected selection = computed<TableFilterSelection>(() => this.column().filterSelection ?? 'multiple');

  /**
   * The menu's rows, resolved off the signals: the option, whether it is picked, and the template that
   * renders it (the column's `etTableFilterOption`, else the trigger's own label row). Built here so
   * the template binds fields rather than calling back into the feature per row.
   */
  protected options = computed(() => {
    const column = this.column();
    const template = this.filters.table.columnTemplate('filterOption', column.key);
    const selected = new Set(this.filters.table.filterValuesFor(column.key));

    return this.filters.optionsFor(column).map((option) => ({
      value: option.value,
      template,
      context: { $implicit: option, selected: selected.has(option.value) } satisfies TableFilterOptionContext,
    }));
  });
}
