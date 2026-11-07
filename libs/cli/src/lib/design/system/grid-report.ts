import { INTERACTIONS } from '../force-interactions';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const countOf = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * The summary line of a part's `grid` and the problems that fail it: a state in two cells, a cell
 * naming no state. `null` when the part declares no grid.
 */
const isInteractionColumn = (column: string) =>
  column === 'rest' || INTERACTIONS.some((interaction) => interaction === column);

const coverageWarningsOf = (columns: string[], rows: [string, unknown][]) => {
  const interactions = columns.filter(isInteractionColumn);

  if (interactions.length < 2) return [];

  const filled = rows.map(([row, cells]) => {
    const has = (column: string) => isRecord(cells) && typeof cells[column] === 'string';

    return {
      row,
      missing: interactions.filter((column) => !has(column)),
      interactive: interactions.some((column) => column !== 'rest' && has(column)),
    };
  });
  const full = filled.filter(({ missing }) => missing.length === 0).map(({ row }) => row);
  const partial = filled.filter(({ missing, interactive }) => interactive && missing.length > 0);

  if (full.length === 0 || partial.length === 0) return [];

  const byMissing = new Map<string, string[]>();

  for (const { row, missing } of partial)
    byMissing.set(missing.join(', '), [...(byMissing.get(missing.join(', ')) ?? []), row]);

  const skips = [...byMissing].map(([missing, skipping]) =>
    skipping.length === 1
      ? `row ${skipping[0]} leaves out ${missing}`
      : `rows ${skipping.join(', ')} leave out ${missing}`,
  );

  return [
    `grid ${skips.join('; ')}, which ${full.join(', ')} ${full.length === 1 ? 'fills' : 'fill'} - a state can break there unseen`,
  ];
};

export const gridReportOf = (
  grid: unknown,
  states: string[],
): { line: string; problems: string[]; warnings: string[] } | null => {
  if (!isRecord(grid) || !Array.isArray(grid['columns']) || !isRecord(grid['rows'])) return null;

  const columns = grid['columns'].filter((column): column is string => typeof column === 'string');
  const rows = Object.entries(grid['rows']);
  const cellsOf = new Map<string, string[]>();
  const problems: string[] = [];

  for (const [row, cells] of rows)
    for (const column of columns) {
      const state = isRecord(cells) ? cells[column] : undefined;

      if (typeof state !== 'string') continue;
      if (!states.includes(state)) problems.push(`grid cell ${row} ${column} names ${state}, which is no state`);
      else cellsOf.set(state, [...(cellsOf.get(state) ?? []), `${row} ${column}`]);
    }

  const twice = [...cellsOf].flatMap(([state, cells]) =>
    cells.length > 1
      ? [
          `grid names the state ${state} ${cells.length === 2 ? 'twice' : `${cells.length} times`} (${cells.join(', ')})`,
        ]
      : [],
  );
  const left = states.filter((state) => !cellsOf.has(state));
  const size = `grid ${countOf(rows.length, 'row')} x ${countOf(columns.length, 'column')}`;
  const empty = rows.flatMap(([row, cells]) =>
    isRecord(cells) && columns.some((column) => typeof cells[column] === 'string')
      ? columns.filter((column) => typeof cells[column] !== 'string').map((column) => `${row} ${column}`)
      : [],
  );
  const gaps = [
    ...(left.length > 0 ? [`leaves out ${left.join(', ')}`] : []),
    ...(empty.length > 0 ? [`draws no ${empty.join(', ')}`] : []),
  ];

  return {
    line: gaps.length === 0 ? `${size} ok` : `${size}, ${gaps.join('; ')}`,
    problems: [...twice, ...problems],
    warnings: coverageWarningsOf(columns, rows),
  };
};
