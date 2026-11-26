/**
 * Puts `participantId` on `rank` (1-based) of a standing order by swapping it with whoever stood there. Always
 * returns a new array; it equals `order` when the participant is not in it or `rank` is outside the order.
 */
export const swapStandingRank = (options: {
  order: readonly string[];
  rank: number;
  participantId: string;
}): string[] => {
  const { order, rank, participantId } = options;
  const next = [...order];
  const to = rank - 1;
  const from = next.indexOf(participantId);

  if (from < 0 || !Number.isInteger(rank) || to < 0 || to >= next.length) return next;

  [next[from], next[to]] = [next[to] as string, participantId];

  return next;
};
