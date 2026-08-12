import { Confidence, Evidence } from './evidence';

export type WorklogProposalState = 'suggested' | 'accepted' | 'rejected' | 'edited' | 'synced';

/** A block, or a set of merged blocks, attributed to one issue and ready for review. */
export type WorklogProposal = {
  id: string;
  issueKey: string;
  /** The Story the issue rolls up to, when the branch grammar or Jira supplied one. */
  storyKey?: string;
  from: Date;
  to: Date;
  /** Kept separate from `to - from`: rounding moves the duration without moving the clock times. */
  durationMs: number;
  /** The evidence-backed duration behind `durationMs`, so review can show what rounding did. */
  observedMs: number;
  description: string;
  confidence: Confidence;
  evidence: Evidence[];
  state: WorklogProposalState;
};

/**
 * Whether a sync writes a proposal in this state. `suggested` is still awaiting review and `rejected`
 * is a deletion, so neither is written.
 */
export const syncsInState = (state: WorklogProposalState) =>
  state === 'accepted' || state === 'edited' || state === 'synced';

/** A proposal that exists in Tempo. The hash is over the synced content, for change detection. */
export type SyncedWorklog = {
  proposalId: string;
  tempoWorklogId: string;
  contentHash: string;
  syncedAt: Date;
};
