import { isDevMode } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TABLE_ERROR_CODES } from '../table-errors';
import { TableColumns, TableSort, TableSortValue } from '../table.types';

const isMissing = (value: TableSortValue) =>
  value === null ||
  value === undefined ||
  (typeof value === 'number' && Number.isNaN(value)) ||
  (value instanceof Date && Number.isNaN(value.getTime()));

const isSortValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value instanceof Date ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

const assertSortValue = (value: unknown, key: string) => {
  if (isSortValue(value)) return;

  throw new RuntimeError(
    TABLE_ERROR_CODES.UNSORTABLE_COLUMN_VALUE,
    `[et-table] Sorting read a ${Array.isArray(value) ? 'list' : typeof value} from the "${key}" column's value, which cannot be compared. Add \`sortValue\` to the column.`,
  );
};

const compare = (a: TableSortValue, b: TableSortValue) => {
  if (isMissing(a) && isMissing(b)) return 0;
  if (isMissing(a)) return 1;
  if (isMissing(b)) return -1;

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
 * `value` accessor). Stable, multi-key, pure and tree-shakable - the base table
 * doesn't apply it unless in client sort mode; import it directly for custom flows.
 * Server-side callers ignore this and let the backend sort instead. Nullish values,
 * `NaN` and invalid dates always sink to the bottom, regardless of direction. In dev mode, a column
 * without `sortValue` whose `value` returns an object, list or function throws `ET3514`.
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

      if (isDevMode() && !column.sortValue) {
        assertSortValue(valueA, key);
        assertSortValue(valueB, key);
      }

      if (isMissing(valueA) || isMissing(valueB)) {
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
