export const SNAPSHOT_ROW_FIELDS = [
  'fromMs',
  'toMs',
  'issueKey',
  'standInId',
  'state',
  'edited',
  'durationMs',
  'unbookedMs',
  'unattended',
  'withheldIssueKey',
  'disputedIssueKey',
  'description',
  'laneKey',
  'hidden',
] as const;

type RowField = (typeof SNAPSHOT_ROW_FIELDS)[number];

export type SnapshotRow = { id: string } & Partial<Record<RowField, unknown>>;

export type SnapshotDay = { day: string; loggedMs: number; proposedMs: number; rows: SnapshotRow[] };

export type Snapshot = {
  takenAt: string;
  head?: string;
  uncommitted?: string[];
  days: SnapshotDay[];
};

export type FieldChange = { field: string; from: unknown; to: unknown };

export type RowChange = { id: string; laneKey?: unknown; fromMs?: unknown; changes: FieldChange[] };

export type DayDiff = {
  day: string;
  totals: FieldChange[];
  gone: SnapshotRow[];
  added: SnapshotRow[];
  changed: RowChange[];
};

export type SnapshotDiff = {
  changedDays: number;
  changedRows: number;
  days: DayDiff[];
  uncommittedDiffers: boolean;
  uncommittedNow: string[];
  uncommittedThen: string[];
};

type DayRowsLike = { day: string; loggedMs: number; proposedMs: number; rows: object[]; hidden: object[] };

export const snapshotDayOf = (found: DayRowsLike): SnapshotDay => ({
  day: found.day,
  loggedMs: found.loggedMs,
  proposedMs: found.proposedMs,
  rows: [...found.rows, ...found.hidden].map((row) => {
    const source = row as Record<string, unknown>;
    const kept: SnapshotRow = { id: String(source['id']) };

    SNAPSHOT_ROW_FIELDS.forEach((field) => {
      if (source[field] !== undefined) kept[field] = source[field];
    });

    return kept;
  }),
});

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const changesOf = (before: SnapshotRow, after: SnapshotRow): FieldChange[] =>
  SNAPSHOT_ROW_FIELDS.filter((field) => !same(before[field], after[field])).map((field) => ({
    field,
    from: before[field],
    to: after[field],
  }));

const laneStart = (row: SnapshotRow) => `${String(row.laneKey)}@${String(row.fromMs)}`;

const diffDay = (before: SnapshotDay, after: SnapshotDay): DayDiff => {
  const totals: FieldChange[] = (['loggedMs', 'proposedMs'] as const)
    .filter((field) => before[field] !== after[field])
    .map((field) => ({ field, from: before[field], to: after[field] }));
  const unmatched = [...after.rows];
  const take = (match: (row: SnapshotRow) => boolean) => {
    const index = unmatched.findIndex(match);

    return index === -1 ? undefined : unmatched.splice(index, 1)[0];
  };
  const gone: SnapshotRow[] = [];
  const changed: RowChange[] = [];
  const leftover: SnapshotRow[] = [];

  before.rows.forEach((row) => {
    const match = take((candidate) => candidate.id === row.id);

    if (!match) return void leftover.push(row);

    const changes = changesOf(row, match);

    if (changes.length) changed.push({ id: row.id, laneKey: row.laneKey, fromMs: row.fromMs, changes });
  });

  leftover.forEach((row) => {
    const match = row.laneKey === undefined ? undefined : take((candidate) => laneStart(candidate) === laneStart(row));

    if (!match) return void gone.push(row);

    changed.push({
      id: row.id,
      laneKey: row.laneKey,
      fromMs: row.fromMs,
      changes: [{ field: 'id', from: row.id, to: match.id }, ...changesOf(row, match)],
    });
  });

  return { day: before.day, totals, gone, added: unmatched, changed };
};

const sameSet = (left: readonly string[], right: readonly string[]) => same([...left].sort(), [...right].sort());

/** Compares a recorded snapshot with the current one, day by day. Days only one side holds are skipped. */
export const diffSnapshots = (before: Snapshot, after: Snapshot): SnapshotDiff => {
  const days = before.days
    .map((day) => {
      const now = after.days.find((candidate) => candidate.day === day.day);

      return now ? diffDay(day, now) : undefined;
    })
    .filter((diff): diff is DayDiff => diff !== undefined)
    .filter((diff) => diff.totals.length || diff.gone.length || diff.added.length || diff.changed.length);
  const uncommittedThen = before.uncommitted ?? [];
  const uncommittedNow = after.uncommitted ?? [];

  return {
    changedDays: days.length,
    changedRows: days.reduce((sum, diff) => sum + diff.gone.length + diff.added.length + diff.changed.length, 0),
    days,
    uncommittedDiffers: !sameSet(uncommittedThen, uncommittedNow),
    uncommittedNow,
    uncommittedThen,
  };
};

const shown = (value: unknown) =>
  value === undefined ? '-' : typeof value === 'string' ? value : JSON.stringify(value);

const rowLabel = (row: SnapshotRow) =>
  `${row.id}${row.issueKey ? ` ${String(row.issueKey)}` : ''}${row.standInId ? ` stand-in ${String(row.standInId)}` : ''}`;

export const diffLines = (diff: SnapshotDiff) => {
  const lines = [`${diff.changedDays} day(s), ${diff.changedRows} row(s) changed`];

  if (diff.uncommittedDiffers) {
    const added = diff.uncommittedNow.filter((file) => !diff.uncommittedThen.includes(file));
    const removed = diff.uncommittedThen.filter((file) => !diff.uncommittedNow.includes(file));

    lines.push(
      `! The uncommitted files differ from the snapshot (another session may have edits live in the app): +${added.length} -${removed.length}`,
      ...added.map((file) => `    + ${file}`),
      ...removed.map((file) => `    - ${file}`),
    );
  }

  diff.days.forEach((day) => {
    lines.push(day.day);
    day.totals.forEach((total) => lines.push(`  ${total.field}: ${shown(total.from)} → ${shown(total.to)}`));
    day.gone.forEach((row) => lines.push(`  gone  ${rowLabel(row)}`));
    day.added.forEach((row) => lines.push(`  new   ${rowLabel(row)}`));
    day.changed.forEach((row) => {
      lines.push(`  changed  ${row.id}`);
      row.changes.forEach((change) => lines.push(`    ${change.field}: ${shown(change.from)} → ${shown(change.to)}`));
    });
  });

  return lines;
};
