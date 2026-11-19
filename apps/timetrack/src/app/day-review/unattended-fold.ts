import { ReviewedRow } from '@ethlete/timetrack';

type FoldKey = { key: string; joins: (run: ReviewedRow, row: ReviewedRow) => boolean; describes?: true };

const overlaps = (run: ReviewedRow, row: ReviewedRow) => row.from <= run.to;
const touches = (run: ReviewedRow, row: ReviewedRow) => row.from.getTime() === run.to.getTime();

const foldKeyOf = (row: ReviewedRow): FoldKey | null => {
  if (row.excluded) return null;

  if (row.standInId) {
    return row.issueKey || row.state === 'rejected'
      ? null
      : { key: `stand-in|${row.laneKey}|${row.standInId}|${!!row.unattended}`, joins: touches, describes: true };
  }

  if (row.state === 'accepted' && row.issueKey) {
    return { key: `accepted|${row.laneKey}|${row.issueKey}|${row.description}`, joins: touches };
  }

  return row.unattended && !row.issueKey && row.state !== 'rejected'
    ? { key: `${row.laneKey}|${row.withheldIssueKey ?? ''}|${row.workedOn ?? ''}`, joins: overlaps }
    : null;
};

const joinedDescription = (run: string, row: string) =>
  !row || run.split('; ').includes(row) ? run : run ? `${run}; ${row}` : row;

export const foldUnattended = (rows: readonly ReviewedRow[]): ReviewedRow[] => {
  const runs = new Map<ReviewedRow, ReviewedRow>();
  const open = new Map<string, ReviewedRow[]>();
  const absorbed = new Set<ReviewedRow>();

  for (const row of [...rows].sort((a, b) => a.from.getTime() - b.from.getTime())) {
    const fold = foldKeyOf(row);

    if (!fold) continue;

    const heads = open.get(fold.key) ?? [];
    const head = heads.find((candidate) => {
      const run = runs.get(candidate);

      return run && fold.joins(run, row);
    });
    const run = head && runs.get(head);

    if (head && run) {
      runs.set(head, {
        ...run,
        to: row.to > run.to ? row.to : run.to,
        observedMs: run.observedMs + row.observedMs,
        description: fold.describes ? joinedDescription(run.description, row.description) : run.description,
        folded: [...(run.folded ?? []), row.id, ...(row.folded ?? [])],
      });
      absorbed.add(row);
      continue;
    }

    open.set(fold.key, [...heads, row]);
    runs.set(row, row);
  }

  return rows.flatMap((row) => {
    if (absorbed.has(row)) return [];

    const run = runs.get(row);

    return run && run !== row ? [{ ...run, durationMs: run.to.getTime() - run.from.getTime() }] : [row];
  });
};
