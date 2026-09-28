import { inject, untracked } from '@angular/core';
import { RuntimeError } from '@ethlete/core';
import { TableFeatureHost } from './headless/table-features';
import { TABLE_ERROR_CODES } from './table-errors';
import { TableComponent } from './table.component';

export const injectHostTable = <T>(feature: string) => {
  const table = inject(TableComponent, { optional: true }) as TableComponent<T> | null;

  if (!table) {
    throw new RuntimeError(TABLE_ERROR_CODES.FEATURE_OUTSIDE_TABLE, `[${feature}] must be used on an <et-table>.`);
  }

  return table;
};

/** The body cell an event came from, with its absolute position - `null` outside the grid body. */
export const bodyCellFromEvent = (table: TableFeatureHost, event: Event) => {
  const cells = table.bodyCellElements();
  const path = event.composedPath();
  const index = cells.findIndex((candidate) => path.includes(candidate));
  const cell = index === -1 ? undefined : cells[index];

  if (!cell) return null;

  const columns = untracked(() => table.visibleColumnsMeta()).length;

  if (!columns) return null;

  return {
    cell,
    position: {
      row: table.renderedRowOffset() + Math.floor(index / columns),
      column: index % columns,
    },
  };
};
