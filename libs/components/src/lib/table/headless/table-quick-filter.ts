import { TableColumns } from '../table.types';

export type QuickFilterRowsConfig<T> = {
  rows: readonly T[];
  /** The text to match. Split on whitespace; every word has to appear in the row. */
  query: string | null | undefined;
  /** The columns searched - pass only the visible ones to match what the reader sees. */
  columns: TableColumns<T>;
};

const searchText = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).toLocaleLowerCase() : null;

/**
 * Keep the rows in which every whitespace-separated word of `query` appears, case-insensitively, in
 * at least one column's text. A column's text is its `quickFilterValue`, else its `value` when that is
 * a string or a number; `quickFilter: false` leaves a column out. Pure and tree-shakable - the base
 * table applies it in client filter mode; server-side callers pass the query to the backend instead.
 */
export const quickFilterRows = <T>({ rows, query, columns }: QuickFilterRowsConfig<T>): T[] => {
  const words = (query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);

  if (!words.length) return [...rows];

  const searched = Object.values(columns).filter((column) => column.quickFilter !== false);

  return rows.filter((row) => {
    const texts = searched
      .map((column) => searchText(column.quickFilterValue ? column.quickFilterValue(row) : column.value(row)))
      .filter((text): text is string => text !== null);

    return words.every((word) => texts.some((text) => text.includes(word)));
  });
};
