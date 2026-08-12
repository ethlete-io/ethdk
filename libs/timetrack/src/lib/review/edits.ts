import { dominantConfidence, mergeEvidence } from '../correlate/merge';
import { RoundOptions, roundDurations } from '../correlate/round';
import { DayReviewEdits, PinnedRow, ProposalOverride, ReviewedRow } from './model';

const pinnedById = (edits: DayReviewEdits, id: string) => edits.pinned.find((row) => row.id === id);

/** What a row stands in for, so splitting or merging an already-edited row keeps the original's claim. */
const replacedBy = (edits: DayReviewEdits, row: ReviewedRow) => pinnedById(edits, row.id)?.replaces ?? [row.id];

const withoutOverrides = (overrides: Record<string, ProposalOverride>, ids: readonly string[]) => {
  const kept = { ...overrides };

  for (const id of ids) delete kept[id];

  return kept;
};

const pinnedIdFor = (options: { issueKey: string; from: Date; taken: ReadonlySet<string> }) => {
  const base = `${options.issueKey}@${options.from.toISOString()}`;
  let id = base;
  let suffix = 2;

  while (options.taken.has(id)) id = `${base}#${suffix++}`;

  return id;
};

const asPinned = (row: ReviewedRow, replaces: readonly string[]): PinnedRow => ({
  id: row.id,
  replaces: [...replaces],
  issueKey: row.issueKey,
  storyKey: row.storyKey,
  from: row.from,
  to: row.to,
  durationMs: row.durationMs,
  observedMs: row.observedMs,
  description: row.description,
  confidence: row.confidence,
  evidence: row.evidence,
  /**
   * A rejection has to survive being split or merged, or restructuring a row somebody had already
   * thrown out would quietly put its time back into the sync. Anything else re-reviews as `edited`.
   */
  state: row.state === 'rejected' ? 'rejected' : undefined,
});

const overrideOn = (options: { edits: DayReviewEdits; row: ReviewedRow; change: ProposalOverride }): DayReviewEdits => {
  const { edits, row, change } = options;
  const pinned = pinnedById(edits, row.id);

  if (pinned) {
    return {
      ...edits,
      pinned: edits.pinned.map((entry) => (entry.id === row.id ? { ...entry, ...change } : entry)),
    };
  }

  return {
    ...edits,
    overrides: { ...edits.overrides, [row.id]: { ...edits.overrides[row.id], ...change } },
  };
};

/** Re-attributes a row to a different issue. The evidence chain is untouched — it is what was seen. */
export const setRowIssue = (options: { edits: DayReviewEdits; row: ReviewedRow; issueKey: string }) =>
  overrideOn({ edits: options.edits, row: options.row, change: { issueKey: options.issueKey } });

export const setRowDescription = (options: { edits: DayReviewEdits; row: ReviewedRow; description: string }) =>
  overrideOn({ edits: options.edits, row: options.row, change: { description: options.description } });

/** Sets a row's logged duration. `observedMs` stays put: what was observed did not change. */
export const setRowDuration = (options: { edits: DayReviewEdits; row: ReviewedRow; durationMs: number }) =>
  overrideOn({
    edits: options.edits,
    row: options.row,
    change: { durationMs: Math.max(0, Math.round(options.durationMs)) },
  });

export const setRowState = (options: { edits: DayReviewEdits; row: ReviewedRow; state: 'accepted' | 'rejected' }) =>
  overrideOn({ edits: options.edits, row: options.row, change: { state: options.state } });

/**
 * Puts the engine's own rows back. Resetting one half of a split undoes the whole split rather than
 * that half alone — the other half's claim on the original proposal would otherwise keep it hidden and
 * turn the reset half's time into drift.
 */
export const resetRow = (options: { edits: DayReviewEdits; row: ReviewedRow }): DayReviewEdits => {
  const { edits, row } = options;
  const replaces = new Set(replacedBy(edits, row));
  const undone = edits.pinned.filter((entry) => entry.id === row.id || entry.replaces.some((id) => replaces.has(id)));
  const undoneIds = undone.flatMap((entry) => [entry.id, ...entry.replaces]);

  return {
    overrides: withoutOverrides(edits.overrides, [row.id, ...undoneIds]),
    pinned: edits.pinned.filter((entry) => !undone.includes(entry)),
  };
};

/**
 * Cuts a row in two at a clock instant, giving each side the evidence observed within it and the share
 * of the observed and logged time that falls inside it. The pair's logged total is preserved and both
 * sides land on whole increments, so splitting a row never changes the day's total.
 *
 * A cut outside the row returns the edits unchanged — there is no half of a row to hand back.
 */
export const splitRow = (options: {
  edits: DayReviewEdits;
  row: ReviewedRow;
  at: Date;
  round?: Partial<RoundOptions>;
}): DayReviewEdits => {
  const { edits, row, at } = options;
  const span = row.to.getTime() - row.from.getTime();
  const offset = at.getTime() - row.from.getTime();

  if (span <= 0 || offset <= 0 || offset >= span) return edits;

  const fraction = offset / span;
  const observed = Math.round(row.observedMs * fraction);
  const [leftMs, rightMs] = roundDurations({
    durationsMs: [row.durationMs * fraction, row.durationMs * (1 - fraction)],
    options: options.round,
  });
  const replaces = replacedBy(edits, row);
  const kept = edits.pinned.filter((entry) => entry.id !== row.id);
  const taken = new Set(kept.map((entry) => entry.id));

  const left: PinnedRow = {
    ...asPinned(row, replaces),
    id: pinnedIdFor({ issueKey: row.issueKey, from: row.from, taken }),
    to: at,
    durationMs: leftMs ?? 0,
    observedMs: observed,
    evidence: row.evidence.filter((entry) => entry.at < at),
  };

  taken.add(left.id);

  const right: PinnedRow = {
    ...asPinned(row, replaces),
    id: pinnedIdFor({ issueKey: row.issueKey, from: at, taken }),
    from: at,
    durationMs: rightMs ?? 0,
    observedMs: row.observedMs - observed,
    evidence: row.evidence.filter((entry) => entry.at >= at),
  };

  return {
    overrides: withoutOverrides(edits.overrides, [row.id, ...replaces]),
    pinned: [...kept, left, right],
  };
};

/**
 * Combines rows into one. The first row given supplies the issue and the description, so the caller
 * decides which of them the merged row is about; the clock spans all of them and the durations add up.
 *
 * Fewer than two rows returns the edits unchanged.
 */
export const mergeRows = (options: { edits: DayReviewEdits; rows: readonly ReviewedRow[] }): DayReviewEdits => {
  const { edits, rows } = options;
  const [first] = rows;

  if (!first || rows.length < 2) return edits;

  const ids = rows.map((row) => row.id);
  const replaces = [...new Set(rows.flatMap((row) => replacedBy(edits, row)))];
  const kept = edits.pinned.filter((entry) => !ids.includes(entry.id));
  const from = new Date(Math.min(...rows.map((row) => row.from.getTime())));

  const merged: PinnedRow = {
    id: pinnedIdFor({ issueKey: first.issueKey, from, taken: new Set(kept.map((entry) => entry.id)) }),
    replaces,
    issueKey: first.issueKey,
    storyKey: first.storyKey,
    from,
    to: new Date(Math.max(...rows.map((row) => row.to.getTime()))),
    durationMs: rows.reduce((sum, row) => sum + row.durationMs, 0),
    observedMs: rows.reduce((sum, row) => sum + row.observedMs, 0),
    description: first.description,
    confidence: dominantConfidence(rows),
    evidence: mergeEvidence(rows.map((row) => row.evidence)),
    /** Only a merge of nothing but rejected rows is still a rejection — the rest is time being kept. */
    state: rows.every((row) => row.state === 'rejected') ? 'rejected' : undefined,
  };

  return { overrides: withoutOverrides(edits.overrides, [...ids, ...replaces]), pinned: [...kept, merged] };
};
