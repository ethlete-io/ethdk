import { DayRows, dayCheckOptions } from '../rows/build-rows';
import {
  CheckDayOptions,
  DEFAULT_ROUND_OPTIONS,
  DayCheck,
  RoundOptions,
  checkDay,
  roundDurationUp,
} from '../rows/round';
import { formatDurationMs } from '../model/duration';
import { syncsWithoutReview } from '../model/evidence';
import { WorklogProposal, WorklogProposalState, syncsInState } from '../model/proposal';
import {
  DayReview,
  DayReviewEdits,
  EMPTY_DAY_REVIEW_EDITS,
  PinnedRow,
  ProposalOverride,
  ReviewedRow,
  isNamedRow,
} from './model';

/** What the engine offered for one band: a proposal, or a band nothing could name. */
type RowSource = Omit<WorklogProposal, 'issueKey'> & { issueKey?: string };

/**
 * The state an untouched row reviews in. A well-evidenced row is accepted on sight — asking for a
 * click on every certain row is what makes a reviewer stop reading them — while a weak one stays
 * `suggested` until somebody says otherwise, and so never syncs.
 *
 * A row with no issue is never accepted on sight however well evidenced it is. There is nothing to
 * accept: it says a stretch of work happened, not what it was for.
 */
const defaultState = (row: RowSource): WorklogProposalState =>
  row.issueKey && syncsWithoutReview(row.confidence) ? 'accepted' : 'suggested';

const withOverride = (row: RowSource, override: ProposalOverride | undefined): ReviewedRow => {
  const proposed = row.issueKey ? { ...row, issueKey: row.issueKey } : undefined;

  if (!override) return { ...row, state: defaultState(row), edited: false, hidden: false };

  const changed =
    override.issueKey !== undefined || override.description !== undefined || override.durationMs !== undefined;

  return {
    ...row,
    issueKey: override.issueKey ?? row.issueKey,
    description: override.description ?? row.description,
    durationMs: override.durationMs ?? row.durationMs,
    state: override.state ?? (changed ? 'edited' : defaultState(row)),
    edited: changed || override.state !== undefined,
    hidden: override.hidden === true,
    proposed,
  };
};

const fromPinned = (row: PinnedRow): ReviewedRow => ({
  id: row.id,
  issueKey: row.issueKey,
  storyKey: row.storyKey,
  from: row.from,
  to: row.to,
  durationMs: row.durationMs,
  observedMs: row.observedMs,
  laneKey: row.laneKey,
  description: row.description,
  confidence: row.confidence,
  evidence: row.evidence,
  state: row.state ?? 'edited',
  edited: true,
  hidden: row.hidden === true,
});

/**
 * Guarantees that every row a sync would write books a whole increment, whatever built it.
 *
 * A duration the reviewer typed is theirs and is left alone. A row `propose` already booked is a
 * whole number of increments, so it comes back out of this unchanged.
 */
const withRounding = (options: {
  rows: ReviewedRow[];
  edits: DayReviewEdits;
  round?: Partial<RoundOptions>;
}): ReviewedRow[] => {
  const byHand = new Set([
    ...options.edits.pinned.map((row) => row.id),
    ...Object.entries(options.edits.overrides)
      .filter(([, override]) => override.durationMs !== undefined)
      .map(([id]) => id),
  ]);
  const writes = options.rows.filter(
    (row) => isNamedRow(row) && syncsInState(row.state) && !byHand.has(row.id) && row.durationMs > 0,
  );
  const byId = new Map(writes.map((row) => [row.id, roundDurationUp(row.durationMs, options.round)]));

  return options.rows.map((row) => {
    const durationMs = byId.get(row.id);

    return durationMs === undefined || durationMs === row.durationMs ? row : { ...row, durationMs };
  });
};

/**
 * Applies a day's local edits to a freshly correlated day and reports what a sync would write.
 *
 * Edits always win. A proposal a split or a merge consumed is dropped rather than re-appearing beside
 * the row the reviewer built from it, so re-running the engine over a day — which happens on every
 * collector tick — can never resurrect a row somebody has already dealt with. What it can do is
 * observe *more* time under such a row, and that surplus is reported as `unreconciledMs` instead of
 * being folded in silently: the reviewer's numbers are theirs, but the day should still say so.
 */
export const reviewDay = (options: {
  rows: DayRows;
  edits?: DayReviewEdits;
  check?: CheckDayOptions;
  round?: Partial<RoundOptions>;
}): DayReview => {
  const edits = options.edits ?? EMPTY_DAY_REVIEW_EDITS;
  const consumed = new Set(edits.pinned.flatMap((row) => [row.id, ...row.replaces]));
  const reviewed = [
    ...options.rows.proposals
      .filter((proposal) => !consumed.has(proposal.id))
      .map((proposal) => withOverride(proposal, edits.overrides[proposal.id])),
    ...options.rows.unnamed
      .filter((row) => !consumed.has(row.id))
      .map((row) => withOverride(row, edits.overrides[row.id])),
    ...edits.pinned.map(fromPinned),
  ].sort((a, b) => a.from.getTime() - b.from.getTime() || (a.issueKey ?? '').localeCompare(b.issueKey ?? ''));

  const hidden = reviewed.filter((row) => row.hidden);
  // Rounding spreads a day's increments over the rows a sync writes, so a hidden row has to be out of
  // it before it runs: leaving one in would move minutes onto rows the reviewer can still see.
  const rows = withRounding({ rows: reviewed.filter((row) => !row.hidden), edits, round: options.round });

  const replacedMs = options.rows.proposals
    .filter((proposal) => consumed.has(proposal.id))
    .reduce((sum, proposal) => sum + proposal.observedMs, 0);
  const pinnedMs = edits.pinned.reduce((sum, row) => sum + row.observedMs, 0);
  const unreconciledMs = Math.max(0, replacedMs - pinnedMs);

  const check = checkDay({
    proposals: rows.filter(isNamedRow).filter((row) => syncsInState(row.state)),
    unattributed: options.rows.unattributed,
    options: { ...dayCheckOptions(options.rows), ...options.check },
  });

  return { rows, hidden, check: withDrift({ check, unreconciledMs, options: options.check }), unreconciledMs };
};

const withDrift = (options: { check: DayCheck; unreconciledMs: number; options?: CheckDayOptions }): DayCheck => {
  const tolerance = options.options?.toleranceMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;

  if (options.unreconciledMs < tolerance) return options.check;

  return {
    ...options.check,
    warnings: [
      ...options.check.warnings,
      {
        kind: 'edited-row-drift',
        detail: `${formatDurationMs(options.unreconciledMs)} of new evidence landed under a row you edited`,
      },
    ],
  };
};
