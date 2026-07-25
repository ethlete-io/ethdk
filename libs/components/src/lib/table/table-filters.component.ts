import { Component, input, signal, TemplateRef, ViewEncapsulation, viewChild } from '@angular/core';
import {
  MenuCheckboxGroupComponent,
  MenuCheckboxItemComponent,
  MenuComponent,
  MenuDirective,
  MenuSearchDirective,
  MenuSurfaceDirective,
  MenuTriggerDirective,
} from '../menu';
import { injectTableFeatureHost, TableColumnMeta, TableHeaderAdornmentContext } from './table-features';
import { TableFilterOption, TableFilterOptionsProvider } from './table.types';

/**
 * Opt-in filter menus for `et-table`: renders a filter trigger on every `filterable` column and a
 * checkbox menu of that column's `filterOptions`, with an optional in-menu search and async
 * (provider-backed) options. Place it inside the table — it renders nothing itself, it registers its
 * menu template with the table's header cells.
 *
 * It carries the whole [menu](/components/menu) system with it, which is exactly why it is separate:
 * a table without filters never pulls that in.
 *
 * @example
 * <et-table [data]="rows()" [columns]="columns">
 *   <et-table-filters />
 * </et-table>
 */
@Component({
  selector: 'et-table-filters',
  templateUrl: './table-filters.component.html',
  styleUrl: './table-filters.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuSearchDirective,
    MenuCheckboxGroupComponent,
    MenuCheckboxItemComponent,
  ],
})
export class TableFiltersComponent {
  /** The host table this feature registered with — filter state lives there, so it serializes. */
  protected table = injectTableFeatureHost('et-table-filters');

  /** Text shown in the menu when a column has no options to offer. @default 'No options' */
  public emptyLabel = input('No options');

  // The menu, handed to the table to render inside each header cell (see registerHeaderAdornment).
  private adornment = viewChild<TemplateRef<TableHeaderAdornmentContext>>('filterAdornment');

  // Per-column filter-menu search text — client-side for a static option list, and forwarded to a
  // provider's setQuery for an async one.
  private searchQueries = signal<Record<string, string>>({});

  constructor() {
    // Filters sit at the trailing edge of the header cell, before the resize grip.
    this.table.registerHeaderAdornment({ template: this.adornment, order: 0 });
  }

  protected isFiltered(key: string) {
    return this.table.filterValuesFor(key).length > 0;
  }

  /** Whether the column's menu gets a search box — asked for explicitly, or implied by an async provider. */
  protected hasSearch(column: TableColumnMeta) {
    return column.filterSearch === true || this.providerOf(column) !== null;
  }

  protected searchQuery(key: string) {
    return this.searchQueries()[key] ?? '';
  }

  protected setSearchQuery(column: TableColumnMeta, query: string) {
    this.searchQueries.update((current) => ({ ...current, [column.key]: query }));
    this.providerOf(column)?.setQuery?.(query);
  }

  /** The options for a column's menu — provider-backed, or the static list narrowed by the search text. */
  protected optionsFor(column: TableColumnMeta): TableFilterOption[] {
    const provider = this.providerOf(column);

    if (provider) return provider.options();

    const options = (column.filterOptions as TableFilterOption[] | undefined) ?? [];

    if (!column.filterSearch) return options;

    const query = this.searchQuery(column.key).trim().toLowerCase();

    return query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
  }

  protected loading(column: TableColumnMeta) {
    return this.providerOf(column)?.loading?.() ?? false;
  }

  protected hasMore(column: TableColumnMeta) {
    return this.providerOf(column)?.hasMore?.() ?? false;
  }

  protected loadMore(column: TableColumnMeta) {
    this.providerOf(column)?.loadMore?.();
  }

  /** The menu's checkbox group emits a single value or an array — normalize to the filter's list. */
  protected asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  }

  /** The async options provider for a column, or `null` when its options are a static list. */
  private providerOf(column: TableColumnMeta): TableFilterOptionsProvider | null {
    const options = column.filterOptions;

    return options && !Array.isArray(options) ? options : null;
  }
}
