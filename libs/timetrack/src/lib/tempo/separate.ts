import { WorklogProposal, syncsInState } from '../model/proposal';
import { backgroundTest } from '../review/recut';
import { CALL_LANE_KEY, storedLaneKey } from '../rows/lane';
import { DEFAULT_ROUND_OPTIONS, sharingTicket } from '../rows/round';
import { floorToGrid } from '../rows/grid';

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

const overlapsAny = (span: Span, taken: readonly Span[]) =>
  taken.some((claim) => claim.from < span.to && span.from < claim.to);

const appendSpan = (spans: Span[], span: Span) => {
  const last = spans[spans.length - 1];

  if (last && last.to === span.from) last.to = span.to;
  else spans.push(span);
};

/**
 * Places the booked minutes of the rows {@link sharingTicket} returns into the free increments of their
 * own spans, earliest deadline first. Two sessions' rows on one ticket interleave and each books less
 * than its span, so booking each from its own start would put the second one's minutes on the first's.
 */
const placeShared = (options: {
  proposals: readonly WorklogProposal[];
  taken: readonly Span[];
  incrementMs: number;
}): Map<WorklogProposal, Span[]> => {
  const { incrementMs } = options;
  const jobs = options.proposals.map((proposal) => ({
    proposal,
    from: proposal.from.getTime(),
    to: proposal.to.getTime(),
    left: Math.floor(proposal.durationMs / incrementMs),
    spans: [] as Span[],
  }));
  const start = floorToGrid(Math.min(...jobs.map((job) => job.from)), incrementMs);
  const end = Math.max(...jobs.map((job) => job.to));

  for (let at = start; at + incrementMs <= end; at += incrementMs) {
    const slot = { from: at, to: at + incrementMs };

    if (overlapsAny(slot, options.taken)) continue;

    const [job] = jobs
      .filter((entry) => entry.left > 0 && entry.from <= slot.from && slot.to <= entry.to)
      .sort((a, b) => a.to - b.to || a.from - b.from || a.proposal.id.localeCompare(b.proposal.id));

    if (!job) continue;

    job.left--;
    appendSpan(job.spans, slot);
  }

  return new Map(jobs.map((job) => [job.proposal, job.spans]));
};

/**
 * Trims and splits the syncable proposals so no two of them book the same minute in Tempo. A meeting
 * or a hand-written row keeps its time, project work comes next and a background project's row keeps
 * only the minutes nothing else claims; within a rank the earlier start wins.
 *
 * The rows of two agent sessions on one ticket (`sharingTicket`) come last in their rank, and book their
 * minutes in whichever free increments of their own span are left, rather than from their start.
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
  const syncable = options.proposals.filter((proposal) => syncsInState(proposal.state) && proposal.durationMs > 0);
  const shared = sharingTicket(syncable);
  const ranked = syncable.sort(
    (a, b) => rankOf(a) - rankOf(b) || a.from.getTime() - b.from.getTime() || a.id.localeCompare(b.id),
  );
  const taken: Span[] = [];
  const piecesById = new Map<string, WorklogProposal[]>();

  const book = (proposal: WorklogProposal, kept: readonly Span[]) => {
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
  };

  for (const rank of [0, 1, 2]) {
    const inRank = ranked.filter((proposal) => rankOf(proposal) === rank);

    for (const proposal of inRank.filter((entry) => !shared.has(entry))) {
      const span = { from: proposal.from.getTime(), to: proposal.from.getTime() + proposal.durationMs };
      const free = freeSpansOf(span, taken);

      if (free.length === 1 && free[0]?.from === span.from && free[0].to === span.to) {
        taken.push(span);
        continue;
      }

      book(
        proposal,
        free
          .map((piece) => ({
            from: piece.from,
            to: piece.from + Math.floor((piece.to - piece.from) / incrementMs) * incrementMs,
          }))
          .filter((piece) => piece.to > piece.from),
      );
    }

    const sharedInRank = inRank.filter((entry) => shared.has(entry));

    if (!sharedInRank.length) continue;

    for (const [proposal, spans] of placeShared({ proposals: sharedInRank, taken, incrementMs })) {
      const [only] = spans;
      const whole =
        spans.length === 1 &&
        only?.from === proposal.from.getTime() &&
        only.to === proposal.from.getTime() + proposal.durationMs;

      if (whole) taken.push(only);
      else book(proposal, spans);
    }
  }

  return options.proposals.flatMap((proposal) => piecesById.get(proposal.id) ?? [proposal]);
};
