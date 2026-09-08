import { BracketMatchId, MatchParticipantSide } from '../core';
import { BracketSlotSource } from '../integrations';
import { Bracket, BracketMatch } from './bracket';

export type BracketPickSet = {
  /** The participant the viewer picked to win a match. */
  matchWinner: (matchId: string) => string | null;
  /** The participant the viewer put on a table position. */
  standingRank: (options: { standingId: string; rank: number }) => string | null;
};

export const isBracketSlotPredictable = (source: BracketSlotSource | null): boolean =>
  source?.kind === 'match-outcome' || source?.kind === 'standing-rank' || source?.kind === 'seed';

/** How a resolution weighs a prediction against what is already known. Both parts default to the stricter answer. */
export type BracketSlotResolutionPolicy = {
  /**
   * Whether the participant really standing on a slot of the given match outranks whatever the picks
   * predict for it. Must answer from the match alone, and answer the same way throughout one
   * resolution: the walk memoizes per slot.
   *
   * `true` answers with the real participant wherever one is known - the pairing a pick was made
   * against, which is what an open round should show. `false`, the default, answers with the
   * prediction even where reality already disagrees, which is what a locked round should show: the
   * record of the guess.
   */
  realParticipantOutranksPick?: (match: BracketMatch<unknown, unknown>) => boolean;

  /**
   * Whether a predicted winner still counts while one side of the match it was made on is unknown.
   * `false`, the default, drops it until both sides resolve. `true` keeps it until both sides are
   * known and it is neither of them - until then nothing contradicts it.
   */
  keepPickWhileFeederSideIsOpen?: boolean;
};

type ResolveBracketSlotOptions = BracketSlotResolutionPolicy & {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  matchId: string;
  side: MatchParticipantSide;
};

const sourceFor = (match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) =>
  side === 'home' ? match.homeSource : match.awaySource;

const participantIdFor = (match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) => match[side]?.id ?? null;

type ResolveWalk = {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  realParticipantOutranksPick: (match: BracketMatch<unknown, unknown>) => boolean;
  keepPickWhileFeederSideIsOpen: boolean;
  visited: Set<string>;
  resolved: Map<string, string | null>;
  cycleHits: number;
};

const resolveMatchOutcome = (options: { walk: ResolveWalk; source: BracketSlotSource }): string | null => {
  const { walk, source } = options;

  if (!source.matchId || !source.role) return null;

  const feeder = walk.bracket.matches.get(source.matchId as BracketMatchId);

  if (!feeder) return null;

  const homeSource = sourceFor(feeder, 'home');
  const awaySource = sourceFor(feeder, 'away');
  const home = resolveSlot({ walk, match: feeder, side: 'home' });
  const away = resolveSlot({ walk, match: feeder, side: 'away' });

  if (homeSource?.kind === 'bye' && awaySource?.kind !== 'bye') {
    return source.role === 'winner' ? away : null;
  }

  if (awaySource?.kind === 'bye' && homeSource?.kind !== 'bye') {
    return source.role === 'winner' ? home : null;
  }

  if (!home || !away) {
    return walk.keepPickWhileFeederSideIsOpen && source.role === 'winner' ? walk.picks.matchWinner(feeder.id) : null;
  }

  const pickedWinner = walk.picks.matchWinner(feeder.id);

  if (pickedWinner !== home && pickedWinner !== away) return null;

  return source.role === 'winner' ? pickedWinner : pickedWinner === home ? away : home;
};

const resolveSource = (options: {
  walk: ResolveWalk;
  match: BracketMatch<unknown, unknown>;
  side: MatchParticipantSide;
  source: BracketSlotSource;
}): string | null => {
  const { walk, match, side, source } = options;

  switch (source.kind) {
    case 'match-outcome':
      return resolveMatchOutcome({ walk, source });
    case 'standing-rank':
      return source.standingId && source.rank !== null
        ? walk.picks.standingRank({ standingId: source.standingId, rank: source.rank })
        : null;
    case 'seed':
    case 'swiss-bucket':
    case 'external':
      return participantIdFor(match, side);
    case 'bye':
      return null;
  }
};

const resolveSlotOccupant = (options: {
  walk: ResolveWalk;
  match: BracketMatch<unknown, unknown>;
  side: MatchParticipantSide;
}): string | null => {
  const { walk, match, side } = options;
  const real = participantIdFor(match, side);

  if (real !== null && walk.realParticipantOutranksPick(match)) return real;

  const source = sourceFor(match, side);

  return source ? resolveSource({ walk, match, side, source }) : real;
};

const resolveSlot = (options: {
  walk: ResolveWalk;
  match: BracketMatch<unknown, unknown>;
  side: MatchParticipantSide;
}): string | null => {
  const { walk, match, side } = options;
  const visitKey = `${match.id}:${side}`;

  if (walk.visited.has(visitKey)) {
    walk.cycleHits++;

    return null;
  }

  const resolved = walk.resolved.get(visitKey);

  if (resolved !== undefined) return resolved;

  walk.visited.add(visitKey);

  const cycleHitsBefore = walk.cycleHits;

  try {
    const result = resolveSlotOccupant({ walk, match, side });

    // Only a result the visit guard never interfered with is a function of the slot alone. One that
    // did hit the guard depends on the path that reached it, so caching it would answer a later path
    // with a cycle's `null`.
    if (walk.cycleHits === cycleHitsBefore) walk.resolved.set(visitKey, result);

    return result;
  } finally {
    walk.visited.delete(visitKey);
  }
};

const createResolveWalk = (
  options: BracketSlotResolutionPolicy & { bracket: Bracket<unknown, unknown>; picks: BracketPickSet },
): ResolveWalk => ({
  bracket: options.bracket,
  picks: options.picks,
  realParticipantOutranksPick: options.realParticipantOutranksPick ?? (() => false),
  keepPickWhileFeederSideIsOpen: options.keepPickWhileFeederSideIsOpen ?? false,
  visited: new Set(),
  resolved: new Map(),
  cycleHits: 0,
});

/** Who the viewer's own picks put in a slot, or `null` while their picks do not reach it. */
export const resolveBracketSlot = (options: ResolveBracketSlotOptions): string | null => {
  const match = options.bracket.matches.get(options.matchId as BracketMatchId);

  return match ? resolveSlot({ walk: createResolveWalk(options), match, side: options.side }) : null;
};
