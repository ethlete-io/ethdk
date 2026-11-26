import { TableColumns, TableFilter } from '../table.types';

export type FilterRowsConfig<T> = {
  rows: readonly T[];
  filters: readonly TableFilter[];
  columns: TableColumns<T>;
};

/**
 * Filter rows by a {@link TableFilter} list, using each column's `filterValue` (or its `value`
 * accessor). A row passes when, for **every** column with an active filter, its value is one of
 * that column's selected values (AND across columns, OR within a column). Pure and tree-shakable -
 * the base table applies it only in client filter mode; server-side callers let the backend filter.
 */
export const filterRows = <T>({ rows, filters, columns }: FilterRowsConfig<T>): T[] => {
  const active = filters.filter((filter) => filter.values.length > 0);

  if (!active.length) return [...rows];

  return rows.filter((row) =>
    active.every((filter) => {
      const column = columns[filter.key];

      if (!column) return true;

      const accessor = column.filterValue ?? column.value;
      const value = accessor(row);

      return filter.values.some((selected) => selected === value);
    }),
  );
};

/**
 * The selected values of one filter key, typed as `TValue` - for turning a source's `filters()` into
 * request params without a cast: `filterValues<Status>(filters(), 'status')`.
 */
export const filterValues = <TValue = unknown, TKey extends string = string>(
  filters: readonly TableFilter<TKey>[],
  key: NoInfer<TKey>,
): TValue[] => (filters.find((filter) => filter.key === key)?.values ?? []) as TValue[];
