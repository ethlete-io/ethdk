import { BracketMatchId, MatchParticipantSide } from '../core';
import { Bracket } from './bracket';

export type BracketStandingRankSide = {
  side: MatchParticipantSide;
  standingId: string;
  rank: number;
  standingName: string | null;
  /** The participant really standing on the side, or `null` while the standing is not decided. */
  participantId: string | null;
};

/** The sides of a match whose source is a `standing-rank` slot, home first. Empty for an unknown match. */
export const standingRankSides = (options: {
  bracket: Bracket<unknown, unknown>;
  matchId: string;
}): BracketStandingRankSide[] => {
  const match = options.bracket.matches.get(options.matchId as BracketMatchId);

  if (!match) return [];

  return (['home', 'away'] as const).flatMap((side) => {
    const source = side === 'home' ? match.homeSource : match.awaySource;

    if (source?.kind !== 'standing-rank') return [];

    return [
      {
        side,
        standingId: source.standingId,
        rank: source.rank,
        standingName: source.standingName ?? null,
        participantId: match[side]?.id ?? null,
      },
    ];
  });
};
