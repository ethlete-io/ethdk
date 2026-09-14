import { BehindStretch, LaneRow, joinTouching, meetLaneRows } from '../rows/cut';
import { RoundOptions } from '../rows/round';
import { projectKeyOf } from '../ticket/project';
import { ReviewedRow } from './model';

/**
 * The end a background row gives up to a foreground row that overlaps it, or nothing when the two do
 * not meet. A foreground row inside the background row takes neither end, so the row is left whole:
 * splitting it would invent a row the reviewer never made.
 */
const trimmedTo = (options: { row: ReviewedRow; covered: readonly LaneRow[] }) => {
  let from = options.row.from.getTime();
  let to = options.row.to.getTime();

  for (const other of options.covered) {
    const start = other.from.getTime();
    const end = other.to.getTime();

    if (end <= from || start >= to) continue;

    if (start <= from && end >= to) {
      from = to;
      break;
    }

    if (start <= from) from = end;
    else if (end >= to) to = start;
  }

  return { from, to };
};

/**
 * Cuts the day's background rows against the rows the reviewer ended up with, and reports what they
 * lost as bands drawn behind them.
 *
 * `cutBackground` runs on the machine's own blocks, before a reviewer has touched anything. Growing a
 * meeting over a background row afterwards leaves both claiming the same minutes, and the day books
 * them twice. Only a background row ever gives way, the same rule the first cut follows.
 *
 * A row it empties out is dropped: every minute it held went to the row that took them, and the band
 * left behind is what still says the work happened.
 */
export const recutReviewedRows = (options: {
  rows: readonly ReviewedRow[];
  behind: readonly BehindStretch[];
  backgroundProjects?: readonly string[];
  round?: Partial<RoundOptions>;
}): { rows: ReviewedRow[]; behind: BehindStretch[] } => {
  const background = new Set((options.backgroundProjects ?? []).map((key) => key.trim().toUpperCase()).filter(Boolean));
  const isBackground = (row: ReviewedRow) => {
    const project = row.issueKey ? projectKeyOf(row.issueKey) : undefined;

    return !!project && background.has(project);
  };

  if (!background.size || !options.rows.some(isBackground)) {
    return { rows: [...options.rows], behind: [...options.behind] };
  }

  const covered = options.rows.filter((row) => !isBackground(row));
  const rows: ReviewedRow[] = [];
  const lost: BehindStretch[] = [];

  for (const row of options.rows) {
    if (!isBackground(row) || !row.issueKey) {
      rows.push(row);
      continue;
    }

    const { from, to } = trimmedTo({ row, covered });
    const laneKey = row.laneKey;

    if (laneKey && from > row.from.getTime()) {
      lost.push({ from: row.from, to: new Date(from), issueKey: row.issueKey, laneKey });
    }

    if (laneKey && to < row.to.getTime()) {
      lost.push({ from: new Date(to), to: row.to, issueKey: row.issueKey, laneKey });
    }

    if (to <= from) continue;

    rows.push(
      from === row.from.getTime() && to === row.to.getTime() ? row : { ...row, from: new Date(from), to: new Date(to) },
    );
  }

  return {
    rows,
    behind: meetLaneRows({ behind: joinTouching([...options.behind, ...lost]), rows, round: options.round }),
  };
};
