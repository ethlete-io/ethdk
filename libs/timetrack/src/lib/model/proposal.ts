import { TimeWindow } from './time-window';
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
  /**
   * Kept separate from `to - from`: a row that spans a gap between its blocks books less than the
   * clock window it is drawn in. The window never books less than this, only more.
   */
  durationMs: number;
  /** The evidence-backed duration behind `durationMs`, so review can show what rounding did. */
  observedMs: number;
  /**
   * The stretches the row's blocks held, for a screen to draw a band per stretch. Absent on a row the
   * reviewer built, which is drawn as the one band they cut - and on a row read back from an older
   * store, which never carried them.
   */
  stretches?: TimeWindow[];
  /**
   * The checkout whose work this row mostly is, as a `streamKey`. Absent when nothing behind the row
   * resolved to a checkout or an application, and on a row read back from an older store.
   */
  laneKey?: string;
  description: string;
  confidence: Confidence;
  evidence: Evidence[];
  state: WorklogProposalState;
  /**
   * True where nothing said a person was at the machine for this band: no window came to the front, no
   * idle transition fired, and every prompt in it was one an agent gave itself. An agent worked and
   * nobody watched.
   *
   * It is the machine's time rather than the user's, so `propose` never makes a Tempo row of such a
   * band — it is drawn, its tokens are counted, and naming it stays a deliberate act of the user's.
   */
  unattended?: boolean;
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
  /**
   * The local calendar day the worklog sits on. Ownership is read per day, so an entry whose proposal
   * the day stopped producing is still found — without it, the worklog it points at would be foreign.
   */
  day: string;
  tempoWorklogId: string;
  contentHash: string;
  syncedAt: Date;
};
