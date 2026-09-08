/** A prediction already stored for one position of a group table. */
export type StandingPick = {
  /** The position it was stored on, 1-based. */
  position: number;
  /** The participant predicted to finish there. */
  participantId: string;
};

/**
 * The order to show a group table in before anyone moves a row: every stored pick takes the position it was
 * stored on, and the participants without one follow in the order the backend listed them, filling the gaps.
 *
 * A pick the field cannot hold is dropped rather than drawn - a position outside
 * `1..participantIds.length`, an id that is not in the field, a second pick for a position or for a
 * participant already placed (the lowest position keeps it). The result is therefore always a permutation
 * of `participantIds`.
 */
export const standingPickStartOrder = (options: {
  /** The participants, in the order the backend listed them. */
  participantIds: readonly string[];
  /** What is already stored, in any order. */
  picks: readonly StandingPick[];
}): string[] => {
  const { participantIds, picks } = options;
  const field = new Set(participantIds);
  const byPosition = new Map<number, string>();
  const placed = new Set<string>();

  for (const pick of [...picks].sort((left, right) => left.position - right.position)) {
    const holds =
      pick.position >= 1 &&
      pick.position <= participantIds.length &&
      field.has(pick.participantId) &&
      !placed.has(pick.participantId) &&
      !byPosition.has(pick.position);

    if (!holds) continue;

    byPosition.set(pick.position, pick.participantId);
    placed.add(pick.participantId);
  }

  const rest = participantIds.filter((id) => !placed.has(id));
  const order: string[] = [];

  for (let position = 1; position <= participantIds.length; position++) {
    const id = byPosition.get(position) ?? rest.shift();

    if (id !== undefined) order.push(id);
  }

  return order;
};
