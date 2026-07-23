import { AnyTableColumn } from './table.types';

/**
 * Declare typed table columns. Binding the row type once here makes every column's
 * `value` accessor typed against `T` (and, for the data-driven path, keeps the same
 * column model), without wiring templates to data by string.
 *
 * @example
 * const columns = tableColumns<User>([
 *   { key: 'name', header: 'Name', value: (user) => user.name },
 *   { key: 'joined', header: 'Joined', value: (user) => user.joinedAt, cell: dateCell },
 * ]);
 */
export const tableColumns = <T>(columns: AnyTableColumn<T>[]): AnyTableColumn<T>[] => columns;
