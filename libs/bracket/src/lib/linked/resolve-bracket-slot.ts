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

type ResolveBracketSlotOptions = {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  matchId: string;
  side: MatchParticipantSide;
};

const sourceFor = (match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) =>
  side === 'home' ? match.homeSource : match.awaySource;

const participantIdFor = (match: BracketMatch<unknown, unknown>, side: MatchParticipantSide) => match[side]?.id ?? null;

type ResolveState = {
  visited: Set<string>;
  resolved: Map<string, string | null>;
  cycleHits: number;
};

const resolveMatchOutcome = (options: {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  source: BracketSlotSource;
  state: ResolveState;
}): string | null => {
  const { bracket, picks, source, state } = options;
  if (!source.matchId || !source.role) return null;

  const feeder = bracket.matches.get(source.matchId as BracketMatchId);

  if (!feeder) return null;

  const homeSource = sourceFor(feeder, 'home');
  const awaySource = sourceFor(feeder, 'away');
  const home = resolveSlot({ bracket, picks, match: feeder, side: 'home', state });
  const away = resolveSlot({ bracket, picks, match: feeder, side: 'away', state });

  if (homeSource?.kind === 'bye' && awaySource?.kind !== 'bye') {
    return source.role === 'winner' ? away : null;
  }

  if (awaySource?.kind === 'bye' && homeSource?.kind !== 'bye') {
    return source.role === 'winner' ? home : null;
  }

  if (!home || !away) return null;

  const pickedWinner = picks.matchWinner(feeder.id);

  if (pickedWinner !== home && pickedWinner !== away) return null;

  return source.role === 'winner' ? pickedWinner : pickedWinner === home ? away : home;
};

const resolveSource = (options: {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  match: BracketMatch<unknown, unknown>;
  side: MatchParticipantSide;
  source: BracketSlotSource;
  state: ResolveState;
}): string | null => {
  const { bracket, picks, match, side, source, state } = options;

  switch (source.kind) {
    case 'match-outcome':
      return resolveMatchOutcome({ bracket, picks, source, state });
    case 'standing-rank':
      return source.standingId && source.rank !== null
        ? picks.standingRank({ standingId: source.standingId, rank: source.rank })
        : null;
    case 'seed':
      return participantIdFor(match, side);
    case 'swiss-bucket':
    case 'external':
      return participantIdFor(match, side);
    case 'bye':
      return null;
  }
};

const resolveSlot = (options: {
  bracket: Bracket<unknown, unknown>;
  picks: BracketPickSet;
  match: BracketMatch<unknown, unknown>;
  side: MatchParticipantSide;
  state: ResolveState;
}): string | null => {
  const { bracket, picks, match, side, state } = options;
  const visitKey = `${match.id}:${side}`;

  if (state.visited.has(visitKey)) {
    state.cycleHits++;

    return null;
  }

  const resolved = state.resolved.get(visitKey);

  if (resolved !== undefined) return resolved;

  state.visited.add(visitKey);

  const cycleHitsBefore = state.cycleHits;

  try {
    const source = sourceFor(match, side);
    const result = source
      ? resolveSource({ bracket, picks, match, side, source, state })
      : participantIdFor(match, side);

    // Only a result the visit guard never interfered with is a function of the slot alone. One that
    // did hit the guard depends on the path that reached it, so caching it would answer a later path
    // with a cycle's `null`.
    if (state.cycleHits === cycleHitsBefore) state.resolved.set(visitKey, result);

    return result;
  } finally {
    state.visited.delete(visitKey);
  }
};

/** Who the viewer's own picks put in a slot, or `null` while their picks do not reach it. */
export const resolveBracketSlot = (options: ResolveBracketSlotOptions): string | null => {
  const match = options.bracket.matches.get(options.matchId as BracketMatchId);

  return match
    ? resolveSlot({
        bracket: options.bracket,
        picks: options.picks,
        match,
        side: options.side,
        state: { visited: new Set(), resolved: new Map(), cycleHits: 0 },
      })
    : null;
};
