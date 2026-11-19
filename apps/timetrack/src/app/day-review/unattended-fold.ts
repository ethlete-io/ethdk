import { ReviewedRow } from '@ethlete/timetrack';

const foldKeyOf = (row: ReviewedRow) =>
  row.unattended && !row.issueKey && !row.standInId && !row.excluded && row.state !== 'rejected'
    ? `${row.laneKey}|${row.withheldIssueKey ?? ''}|${row.workedOn ?? ''}`
    : null;

export const foldUnattended = (rows: readonly ReviewedRow[]): ReviewedRow[] => {
  const runs = new Map<ReviewedRow, ReviewedRow>();
  const open = new Map<string, ReviewedRow>();
  const absorbed = new Set<ReviewedRow>();

  for (const row of [...rows].sort((a, b) => a.from.getTime() - b.from.getTime())) {
    const key = foldKeyOf(row);

    if (!key) continue;

    const head = open.get(key);
    const run = head && runs.get(head);

    if (head && run && row.from <= run.to) {
      runs.set(head, {
        ...run,
        to: row.to > run.to ? row.to : run.to,
        observedMs: run.observedMs + row.observedMs,
        folded: [...(run.folded ?? []), row.id, ...(row.folded ?? [])],
      });
      absorbed.add(row);
      continue;
    }

    open.set(key, row);
    runs.set(row, row);
  }

  return rows.flatMap((row) => {
    if (absorbed.has(row)) return [];

    const run = runs.get(row);

    return run && run !== row ? [{ ...run, durationMs: run.to.getTime() - run.from.getTime() }] : [row];
  });
};
