export type SheetGrid = {
  columns: readonly string[];
  rows: Record<string, Partial<Record<string, string>>>;
};

export type SheetRow = { label: string; cells: (string | null)[] };

export type SheetLayout = { columns: string[]; rows: SheetRow[] };

/**
 * Lays every one of `states` out once: a row per `grid` row with its state under each column, then a row per state
 * the grid leaves out with only the first column filled. Without a grid every state is such a row under `rest`.
 */
export const sheetLayoutOf = (states: readonly string[], grid?: SheetGrid): SheetLayout => {
  const known = new Set(states);
  const columns = grid?.columns.length ? [...grid.columns] : ['rest'];
  const gridRows = Object.entries(grid?.rows ?? {})
    .map(([label, cells]): SheetRow => ({
      label,
      cells: columns.map((column) => {
        const state = cells[column];

        return state !== undefined && known.has(state) ? state : null;
      }),
    }))
    .filter((row) => row.cells.some((cell) => cell !== null));
  const placed = new Set(gridRows.flatMap((row) => row.cells));
  const loose = states
    .filter((state) => !placed.has(state))
    .map((state): SheetRow => ({ label: state, cells: columns.map((_, index) => (index === 0 ? state : null)) }));

  return { columns, rows: [...gridRows, ...loose] };
};

const escaped = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const SHEET_STYLES = `
.et-design-sheet{border-collapse:collapse;font:12px/1.3 system-ui,sans-serif;color:var(--et-surface-color-muted-solid,#888)}
.et-design-sheet th{padding:6px 12px;font-weight:500;white-space:nowrap;text-align:left;vertical-align:middle}
.et-design-sheet thead th{border-bottom:1px solid var(--et-surface-border-solid,rgb(128 128 128/.3))}
.et-design-sheet tbody tr+tr>*{border-top:1px solid var(--et-surface-border-solid,rgb(128 128 128/.3))}
.et-design-sheet td{padding:8px 12px;vertical-align:middle}
`;

/** The markup of `layout` as one table, with the drawn body of each state from `bodies` in its cell. */
export const sheetMarkupOf = (layout: SheetLayout, bodies: Readonly<Record<string, string>>) => {
  const head = layout.columns.map((column) => `<th scope="col">${escaped(column)}</th>`).join('');
  const rows = layout.rows
    .map(
      (row) =>
        `<tr><th scope="row">${escaped(row.label)}</th>` +
        row.cells
          .map((state) =>
            state === null ? '<td></td>' : `<td data-et-sheet-state="${escaped(state)}">${bodies[state] ?? ''}</td>`,
          )
          .join('') +
        '</tr>',
    )
    .join('');

  return `<table class="et-design-sheet"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
};
