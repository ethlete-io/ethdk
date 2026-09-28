import { WorklogProposal, syncsInState } from '../model/proposal';
import { backgroundTest } from '../review/recut';
import { CALL_LANE_KEY, storedLaneKey } from '../rows/lane';
import { DEFAULT_ROUND_OPTIONS } from '../rows/round';

type Span = { from: number; to: number };

const PIECE_SUFFIX = /~\d+$/;

/** The id of the row a piece was split from. A row that was never split is its own source. */
export const pieceSourceId = (proposalId: string) => proposalId.replace(PIECE_SUFFIX, '');

const isMeeting = (proposal: WorklogProposal) =>
  storedLaneKey(proposal.laneKey) === CALL_LANE_KEY ||
  proposal.evidence.some((entry) => entry.kind === 'call' || entry.kind === 'calendar' || entry.kind === 'manual');

const freeSpansOf = (span: Span, taken: readonly Span[]) => {
  let free: Span[] = [span];

  for (const claim of taken) {
    free = free.flatMap((piece) =>
      claim.to <= piece.from || claim.from >= piece.to
        ? [piece]
        : [
            ...(piece.from < claim.from ? [{ from: piece.from, to: claim.from }] : []),
            ...(piece.to > claim.to ? [{ from: claim.to, to: piece.to }] : []),
          ],
    );
  }

  return free;
};

/**
 * Trims and splits the syncable proposals so no two of them book the same minute in Tempo. A meeting
 * or a hand-written row keeps its time, project work comes next and a background project's row keeps
 * only the minutes nothing else claims; within a rank the earlier start wins.
 *
 * A trimmed piece is floored to the increment. The first piece keeps the proposal's id and every
 * further one is `<id>~<n>` - read the source back with {@link pieceSourceId}. A proposal left with
 * nothing keeps its id at a duration of zero, so a worklog already synced for it is deleted.
 */
export const separateOverlappingProposals = (options: {
  proposals: readonly WorklogProposal[];
  backgroundProjects?: readonly string[];
  incrementMs?: number;
}): WorklogProposal[] => {
  const incrementMs = options.incrementMs ?? DEFAULT_ROUND_OPTIONS.incrementMs;
  const onBackground = backgroundTest(options.backgroundProjects);
  const rankOf = (proposal: WorklogProposal) => (isMeeting(proposal) ? 0 : onBackground(proposal) ? 2 : 1);
  const ranked = options.proposals
    .filter((proposal) => syncsInState(proposal.state) && proposal.durationMs > 0)
    .sort((a, b) => rankOf(a) - rankOf(b) || a.from.getTime() - b.from.getTime() || a.id.localeCompare(b.id));
  const taken: Span[] = [];
  const piecesById = new Map<string, WorklogProposal[]>();

  for (const proposal of ranked) {
    const span = { from: proposal.from.getTime(), to: proposal.from.getTime() + proposal.durationMs };
    const free = freeSpansOf(span, taken);

    if (free.length === 1 && free[0]?.from === span.from && free[0].to === span.to) {
      taken.push(span);
      continue;
    }

    const kept = free
      .map((piece) => ({
        from: piece.from,
        to: piece.from + Math.floor((piece.to - piece.from) / incrementMs) * incrementMs,
      }))
      .filter((piece) => piece.to > piece.from);

    taken.push(...kept);
    piecesById.set(
      proposal.id,
      kept.length
        ? kept.map((piece, index) => ({
            ...proposal,
            id: index ? `${proposal.id}~${index + 1}` : proposal.id,
            from: new Date(piece.from),
            to: new Date(piece.to),
            durationMs: piece.to - piece.from,
          }))
        : [{ ...proposal, durationMs: 0 }],
    );
  }

  return options.proposals.flatMap((proposal) => piecesById.get(proposal.id) ?? [proposal]);
};
