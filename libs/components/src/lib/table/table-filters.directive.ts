import { computed, Directive, inject, Injector, input, signal } from '@angular/core';
import { TableFilterTriggerComponent } from './table-filter-trigger.component';
import {
  injectTableFeatureHost,
  TableColumnMeta,
  TableFeatureConfig,
  tableFeatureConfig,
} from './headless/table-features';
import { TableFilterOption, TableFilterOptionsProvider } from './table.types';

/** Options for {@link TableFiltersDirective}. */
export type TableFiltersConfig = TableFeatureConfig;

/**
 * Opt-in filter menus for `et-table`: renders a filter trigger on every `filterable` column and a
 * checkbox menu of that column's `filterOptions`, with an optional in-menu search and async
 * (provider-backed) options. The trigger and menu are stamped into the table's header cells (see
 * {@link TableFilterTriggerComponent}), so this directive itself renders nothing.
 *
 * It carries the whole [menu](/components/menu) system with it, which is exactly why it is separate:
 * a table without filters never pulls that in.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" etTableFilters />
 *
 * <!-- switched off at runtime; wording lives in the table's label set -->
 * <et-table [etTableFilters]="{ enabled: canFilter() }" … />
 */
@Directive({
  selector: '[etTableFilters]',
  exportAs: 'etTableFilters',
})
export class TableFiltersDirective {
  /** The host table this feature registered with - filter state lives there, so it serializes. */
  public table = injectTableFeatureHost('etTableFilters');

  /** See {@link TableFiltersConfig}. */
  public config = input({} as TableFiltersConfig, {
    alias: 'etTableFilters',
    transform: tableFeatureConfig<TableFiltersConfig>,
  });

  // Per-column filter-menu search text - client-side for a static option list, and forwarded to a
  // provider's setQuery for an async one.
  private searchQueries = signal<Record<string, string>>({});

  constructor() {
    // Filters sit at the trailing edge of the header cell, before the resize grip. The trigger is
    // created with this feature's injector, so it can inject the feature back.
    this.table.registerHeaderAdornment({
      component: TableFilterTriggerComponent,
      injector: inject(Injector),
      order: 0,
      enabled: computed(() => this.config().enabled ?? true),
    });
  }

  public isFiltered(key: string) {
    return this.table.filterValuesFor(key).length > 0;
  }

  /** Whether the column's menu gets a search box - asked for explicitly, or implied by an async provider. */
  public hasSearch(column: TableColumnMeta) {
    return column.filterSearch === true || this.providerOf(column) !== null;
  }

  public searchQuery(key: string) {
    return this.searchQueries()[key] ?? '';
  }

  public setSearchQuery(column: TableColumnMeta, query: string) {
    this.searchQueries.update((current) => ({ ...current, [column.key]: query }));
    this.providerOf(column)?.setQuery?.(query);
  }

  /** The options for a column's menu - provider-backed, or the static list narrowed by the search text. */
  public optionsFor(column: TableColumnMeta): TableFilterOption[] {
    const provider = this.providerOf(column);

    if (provider) return provider.options();

    const options = (column.filterOptions as TableFilterOption[] | undefined) ?? [];

    if (!column.filterSearch) return options;

    const query = this.searchQuery(column.key).trim().toLowerCase();

    return query ? options.filter((option) => option.label.toLowerCase().includes(query)) : options;
  }

  public loading(column: TableColumnMeta) {
    return this.providerOf(column)?.loading?.() ?? false;
  }

  public hasMore(column: TableColumnMeta) {
    return this.providerOf(column)?.hasMore?.() ?? false;
  }

  public loadMore(column: TableColumnMeta) {
    this.providerOf(column)?.loadMore?.();
  }

  /** A single-choice column's picked value, or `null` - the filter list holds at most one entry. */
  public singleValueFor(key: string): unknown {
    return this.table.filterValuesFor(key)[0] ?? null;
  }

  /**
   * Pick a single-choice column's value, or clear it by picking the one already selected - the only way
   * out of a radio group, which has no "none" row to go back to. Driven by each item's `activate`
   * rather than the group's `valueChange`: a radio group emits nothing when the checked item is chosen
   * again, which is exactly the gesture that has to clear here.
   */
  public toggleSingleValue(key: string, value: unknown) {
    const current = this.singleValueFor(key);

    this.table.setFilterValues(key, value === null || value === undefined || value === current ? [] : [value]);
  }

  /** The menu's checkbox group emits a single value or an array - normalize to the filter's list. */
  public asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  }

  /** The async options provider for a column, or `null` when its options are a static list. */
  private providerOf(column: TableColumnMeta): TableFilterOptionsProvider | null {
    const options = column.filterOptions;

    return options && !Array.isArray(options) ? options : null;
  }
}
