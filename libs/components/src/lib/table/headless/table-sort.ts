import { TableColumns, TableSort, TableSortValue } from '../table.types';

const isNullish = (value: TableSortValue): value is null | undefined => value === null || value === undefined;

const compare = (a: TableSortValue, b: TableSortValue) => {
  if (isNullish(a) && isNullish(b)) return 0;
  if (isNullish(a)) return 1;
  if (isNullish(b)) return -1;

  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

export type SortRowsConfig<T> = {
  rows: readonly T[];
  sort: readonly TableSort[];
  columns: TableColumns<T>;
};

/**
 * Sort rows by a {@link TableSort} list, using each column's `sortValue` (or its
 * `value` accessor). Stable, multi-key, pure and tree-shakable — the base table
 * doesn't apply it unless in client sort mode; import it directly for custom flows.
 * Server-side callers ignore this and let the backend sort instead. Nullish values
 * always sink to the bottom, regardless of direction.
 */
export const sortRows = <T>({ rows, sort, columns }: SortRowsConfig<T>): T[] => {
  if (!sort.length) return [...rows];

  return [...rows].sort((rowA, rowB) => {
    for (const { key, direction } of sort) {
      const column = columns[key];

      if (!column) continue;

      const accessor = column.sortValue ?? column.value;
      const valueA = accessor(rowA) as TableSortValue;
      const valueB = accessor(rowB) as TableSortValue;

      if (isNullish(valueA) || isNullish(valueB)) {
        const nullCmp = compare(valueA, valueB);

        if (nullCmp !== 0) return nullCmp;

        continue;
      }

      const cmp = compare(valueA, valueB);

      if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
    }

    return 0;
  });
};
