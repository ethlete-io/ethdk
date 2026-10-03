import { BracketDataSource, BracketMatchSource } from '../integrations';
import { BracketMap } from './bracket-map';
import { BracketMatchId } from './match';
import { MatchParticipantId, BracketParticipantBase, BracketParticipantWithRelationsBase } from './participant';
import {
  BracketRoundId,
  COMMON_BRACKET_ROUND_TYPE,
  DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE,
  BracketRoundWithRelationsBase,
} from './round';
import { SWISS_ELIMINATE_LOSSES, TOURNAMENT_MODE } from './tournament';
import { BracketRuntimeError } from '../bracket-runtime-error';
import { BRACKET_ERROR_CODES } from '../bracket-errors';

export type ParticipantMatchResult = 'win' | 'loss' | 'tie';
export type MatchParticipantSide = 'home' | 'away';

export type BracketMatchParticipantBase = BracketParticipantBase & {
  result: ParticipantMatchResult | null;
  isEliminated: boolean;
  isEliminationMatch: boolean;
  tieCount: number;
  winCount: number;
  lossCount: number;
  side: MatchParticipantSide;
};

export type BracketMatchParticipantWithRelationsBase = BracketMatchParticipantBase &
  BracketParticipantWithRelationsBase;

export const createNewMatchParticipantBase = <TRoundData, TMatchData>(
  source: BracketDataSource<TRoundData, TMatchData>,
  participantId: MatchParticipantId | null,
  match: BracketMatchSource<TMatchData>,
  rounds: BracketMap<BracketRoundId, BracketRoundWithRelationsBase<TRoundData>>,
  matchRoundId: BracketRoundId,
  participants: BracketMap<MatchParticipantId, BracketParticipantWithRelationsBase>,
  sourceMatchesById?: ReadonlyMap<string, BracketMatchSource<TMatchData>>,
  // eslint-disable-next-line max-params -- builder maps one source participant to a bracket node; its lookups are distinct positional inputs
) => {
  if (!participantId) return null;

  const findSourceMatch = (matchId: string | undefined) =>
    matchId === undefined
      ? undefined
      : sourceMatchesById
        ? sourceMatchesById.get(matchId)
        : source.matches.find((m) => m.id === matchId);

  const participantBase = participants.getOrThrow(participantId);
  const roundBase = rounds.getOrThrow(matchRoundId as BracketRoundId);

  const matchIndex = participantBase.matchIds.indexOf(match.id as BracketMatchId);
  if (matchIndex === -1)
    throw new BracketRuntimeError(
      BRACKET_ERROR_CODES.MATCH_RELATION_INVALID,
      `Match with id ${match.id} not found in participant with id ${participantId}`,
    );

  const participantSide = match.home === participantId ? 'home' : 'away';
  const isWinner = match.winner === participantSide;
  const isLooser = match.winner && match.winner !== participantSide;
  const isTie = match.status === 'completed' && !match.winner;

  let winsTilNow = isWinner ? 1 : 0;
  let lossesTilNow = isLooser ? 1 : 0;
  let tiesTilNow = isTie ? 1 : 0;

  for (let i = 0; i < matchIndex; i++) {
    const previousMatchId = participantBase.matchIds[i];
    const previousMatch = findSourceMatch(previousMatchId);
    const myPreviousMatchSide =
      previousMatch?.home === participantId ? 'home' : previousMatch?.away === participantId ? 'away' : null;

    if (!previousMatch || !myPreviousMatchSide) continue;

    const previousIsWinner = previousMatch.winner === myPreviousMatchSide;
    const previousIsLooser = previousMatch.winner && previousMatch.winner !== myPreviousMatchSide;
    const previousIsTie = previousMatch.status === 'completed' && !previousMatch.winner;

    if (previousIsWinner) {
      winsTilNow++;
    } else if (previousIsLooser) {
      lossesTilNow++;
    } else if (previousIsTie) {
      tiesTilNow++;
    }
  }

  const hasElimination =
    source.mode === TOURNAMENT_MODE.SINGLE_ELIMINATION ||
    source.mode === TOURNAMENT_MODE.DOUBLE_ELIMINATION ||
    source.mode === TOURNAMENT_MODE.SWISS_WITH_ELIMINATION;

  let isEliminated = false;
  let isEliminationMatch = false;

  if (hasElimination) {
    switch (source.mode) {
      case TOURNAMENT_MODE.SINGLE_ELIMINATION: {
        isEliminationMatch = true;
        isEliminated = isLooser ?? false;
        break;
      }
      case TOURNAMENT_MODE.DOUBLE_ELIMINATION: {
        isEliminationMatch =
          roundBase.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET ||
          roundBase.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL ||
          roundBase.type === COMMON_BRACKET_ROUND_TYPE.THIRD_PLACE;

        // Final is only an elimination match if there is no reverse final or there is one and this participant came from the lower bracket
        if (roundBase.type === COMMON_BRACKET_ROUND_TYPE.FINAL) {
          const hasReverseFinal = source.rounds.some(
            (r) => r.type === DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.REVERSE_FINAL,
          );

          if (!hasReverseFinal) {
            isEliminationMatch = true;
            isEliminated = isLooser ?? false;
            break;
          }

          isEliminationMatch = participantBase.matchIds.some((matchId) => {
            const playedMatch = findSourceMatch(matchId);

            return (
              !!playedMatch &&
              source.rounds.find((round) => round.id === playedMatch.roundId)?.type ===
                DOUBLE_ELIMINATION_BRACKET_ROUND_TYPE.LOWER_BRACKET
            );
          });
        }

        isEliminated = (isEliminationMatch && isLooser) ?? false;
        break;
      }
      case TOURNAMENT_MODE.SWISS_WITH_ELIMINATION: {
        // `lossesTilNow` counts this match too, so the losses carried *into* it are one fewer for a
        // loser - it is those that decide whether losing here is what puts the participant out.
        const priorLosses = lossesTilNow - (isLooser ? 1 : 0);

        isEliminationMatch = priorLosses >= SWISS_ELIMINATE_LOSSES - 1;

        isEliminated = (isEliminationMatch && isLooser) ?? false;
      }
    }
  }

  const matchParticipantBase: BracketMatchParticipantWithRelationsBase = {
    ...participantBase,
    isEliminated,
    isEliminationMatch,
    lossCount: lossesTilNow,
    tieCount: tiesTilNow,
    winCount: winsTilNow,
    result: isWinner ? 'win' : isLooser ? 'loss' : isTie ? 'tie' : null,
    side: participantSide,
  };

  return matchParticipantBase;
};
