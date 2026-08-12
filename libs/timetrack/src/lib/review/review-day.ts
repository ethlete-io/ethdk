import { DayCorrelation } from '../correlate/correlate-day';
import { CheckDayOptions, DEFAULT_ROUND_OPTIONS, DayCheck, checkDay } from '../correlate/round';
import { formatDurationMs } from '../model/duration';
import { syncsWithoutReview } from '../model/evidence';
import { WorklogProposal, WorklogProposalState, syncsInState } from '../model/proposal';
import { DayReview, DayReviewEdits, EMPTY_DAY_REVIEW_EDITS, PinnedRow, ProposalOverride, ReviewedRow } from './model';

/**
 * The state an untouched row reviews in. A well-evidenced row is accepted on sight — asking for a
 * click on every certain row is what makes a reviewer stop reading them — while a weak one stays
 * `suggested` until somebody says otherwise, and so never syncs.
 */
const defaultState = (proposal: WorklogProposal): WorklogProposalState =>
  syncsWithoutReview(proposal.confidence) ? 'accepted' : 'suggested';

const withOverride = (proposal: WorklogProposal, override: ProposalOverride | undefined): ReviewedRow => {
  if (!override) return { ...proposal, state: defaultState(proposal), edited: false };

  const changed =
    override.issueKey !== undefined || override.description !== undefined || override.durationMs !== undefined;

  return {
    ...proposal,
    issueKey: override.issueKey ?? proposal.issueKey,
    description: override.description ?? proposal.description,
    durationMs: override.durationMs ?? proposal.durationMs,
    state: override.state ?? (changed ? 'edited' : defaultState(proposal)),
    edited: changed || override.state !== undefined,
    proposed: proposal,
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
  description: row.description,
  confidence: row.confidence,
  evidence: row.evidence,
  state: row.state ?? 'edited',
  edited: true,
});

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
  correlation: DayCorrelation;
  edits?: DayReviewEdits;
  check?: CheckDayOptions;
}): DayReview => {
  const edits = options.edits ?? EMPTY_DAY_REVIEW_EDITS;
  const consumed = new Set(edits.pinned.flatMap((row) => [row.id, ...row.replaces]));
  const rows = [
    ...options.correlation.proposals
      .filter((proposal) => !consumed.has(proposal.id))
      .map((proposal) => withOverride(proposal, edits.overrides[proposal.id])),
    ...edits.pinned.map(fromPinned),
  ].sort((a, b) => a.from.getTime() - b.from.getTime() || a.issueKey.localeCompare(b.issueKey));

  const replacedMs = options.correlation.proposals
    .filter((proposal) => consumed.has(proposal.id))
    .reduce((sum, proposal) => sum + proposal.observedMs, 0);
  const pinnedMs = edits.pinned.reduce((sum, row) => sum + row.observedMs, 0);
  const unreconciledMs = Math.max(0, replacedMs - pinnedMs);

  const check = checkDay({
    proposals: rows.filter((row) => syncsInState(row.state)),
    unattributed: options.correlation.unattributed,
    options: options.check,
  });

  return { rows, check: withDrift({ check, unreconciledMs, options: options.check }), unreconciledMs };
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
