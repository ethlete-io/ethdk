import { WorklogProposal } from '../model/proposal';

/** A worklog already in Tempo that this app did not write, with its issue key resolved. */
export type ForeignWorklog = {
  issueKey: string;
  from: Date;
  durationMs: number;
};

export type ForeignSubtraction = {
  proposalId: string;
  issueKey: string;
  subtractedMs: number;
  /** What is left of the proposal. Zero means Tempo already accounts for all of it. */
  remainingMs: number;
};

export type ForeignSubtractionResult = {
  /** Every input proposal, in the original order, with its duration reduced by what Tempo holds. */
  proposals: WorklogProposal[];
  /** The ids Tempo already accounts for in full. Shown as already-logged; a sync writes nothing. */
  coveredProposalIds: string[];
  subtractions: ForeignSubtraction[];
  /** Foreign time on issues the day proposed nothing for. Already-accounted time all the same. */
  unmatchedMs: number;
};

/**
 * Reduces a day's proposals by the time Tempo already holds for the same issues, so re-syncing a day
 * cannot log the same hour twice.
 *
 * Matching is per issue over the given day, not per overlapping interval: a worklog's start time in
 * Tempo is frequently nominal — entered by hand, or carried over by a template — so an hour logged
 * against an issue at 14:00 is the same hour whether the evidence puts the work at 09:00 or not. Time
 * that outlives its proposals is reported as `unmatchedMs` rather than driving a duration negative.
 *
 * Pass one day of proposals and that same day's foreign worklogs; this does not filter by date.
 */
export const subtractForeignTime = (options: {
  proposals: WorklogProposal[];
  foreign: ForeignWorklog[];
}): ForeignSubtractionResult => {
  const accountedByKey = new Map<string, number>();

  for (const worklog of options.foreign) {
    accountedByKey.set(worklog.issueKey, (accountedByKey.get(worklog.issueKey) ?? 0) + worklog.durationMs);
  }

  const ordered = [...options.proposals].sort((a, b) => a.from.getTime() - b.from.getTime());
  const subtractions: ForeignSubtraction[] = [];
  const remainingById = new Map<string, number>();

  for (const proposal of ordered) {
    const accounted = accountedByKey.get(proposal.issueKey) ?? 0;
    const subtracted = Math.min(accounted, proposal.durationMs);

    remainingById.set(proposal.id, proposal.durationMs - subtracted);

    if (subtracted <= 0) continue;

    accountedByKey.set(proposal.issueKey, accounted - subtracted);
    subtractions.push({
      proposalId: proposal.id,
      issueKey: proposal.issueKey,
      subtractedMs: subtracted,
      remainingMs: proposal.durationMs - subtracted,
    });
  }

  const reduced = options.proposals.map((proposal) => {
    const remaining = remainingById.get(proposal.id) ?? proposal.durationMs;

    return remaining === proposal.durationMs ? proposal : { ...proposal, durationMs: remaining };
  });

  return {
    proposals: reduced,
    coveredProposalIds: subtractions.filter((entry) => entry.remainingMs === 0).map((entry) => entry.proposalId),
    subtractions,
    unmatchedMs: [...accountedByKey.values()].reduce((sum, ms) => sum + ms, 0),
  };
};
